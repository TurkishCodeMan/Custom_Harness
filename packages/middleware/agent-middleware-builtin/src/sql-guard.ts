import { defineMiddleware } from '@custom-harness/agent-middleware'

const DESTRUCTIVE_SQL_KEYWORDS = ['DROP TABLE', 'TRUNCATE TABLE', 'ALTER TABLE', 'DROP DATABASE'] as const

/**
 * sql-safety-guard (beforeTool, order: 0, presets: ['test'])
 *
 * Active only for the Analysis SQL Agent preset.
 * Blocks two categories of dangerous bash commands:
 *
 * 1. SQLite file creation — the database is PostgreSQL (port 15432), not SQLite.
 * 2. Destructive DDL/DML queries (DROP, TRUNCATE, ALTER, etc.) — read-only policy.
 */
export const sqlSafetyGuardMiddleware = defineMiddleware({
  name: 'sql-safety-guard',
  order: 0,
  presets: ['test'],
  beforeTool: async (ctx, next) => {
    if (ctx.toolName !== 'bash') {
      await next()
      return
    }

    const cmd = String(ctx.params?.command ?? '')

    // Guard 1: Prevent accidental SQLite usage instead of PostgreSQL
    if (cmd.includes('sqlite3') && cmd.includes('far_trans_demo.db')) {
      ctx.skipExecution = true
      ctx.customOutput =
        '[GÜVENLİK KORUMASI / SQL GUARD]: SQLite kullanımı engellendi! ' +
        'Veritabanı bir PostgreSQL demo veritabanıdır (127.0.0.1:15432, dbname: far_trans_demo). ' +
        "Lütfen psycopg2 veya sqlalchemy ile PostgreSQL'e bağlanın."
      return
    }

    // Guard 2: Prevent destructive DDL/DML queries
    const cmdUpper = cmd.toUpperCase()
    for (const kw of DESTRUCTIVE_SQL_KEYWORDS) {
      if (cmdUpper.includes(kw)) {
        ctx.skipExecution = true
        ctx.customOutput =
          `[GÜVENLİK KORUMASI / SQL GUARD]: '${kw}' sorgusu veri güvenliği politikası gereği engellenmiştir. ` +
          'Yalnızca salt okunur (SELECT) analitik sorgular çalıştırabilirsiniz.'
        return
      }
    }

    await next()
  }
})
