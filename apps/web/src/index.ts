import { Context } from '@custom-harness/core-context'
import * as webAppBundle from '@custom-harness/bundle-web-app'

async function main() {
  console.log('⚡ Custom Harness (Web Server - @custom-harness/bundle-web-app) başlatılıyor...')

  const ctx = new Context()
  ctx.plugin(webAppBundle)
  await ctx.start()
}

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
