import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-todo'
export const inject = ['tools']

export interface TodoItem {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

export function apply(ctx: Context) {
  const sessionTodos = new Map<string, TodoItem[]>()

  ctx.tools.register(defineTool({
    name: 'manage_todo',
    description: 'Create, update, and manage a structured task list / checklist for tracking progress across multi-step objectives.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['set_tasks', 'update_status', 'list', 'clear'],
          description: 'The action to perform on the todo list.'
        },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] }
            },
            required: ['id', 'title']
          },
          description: 'Used with `set_tasks` to initialize or replace the task checklist.'
        },
        taskId: { type: 'string', description: 'The task ID to update when action is `update_status`.' },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'cancelled'],
          description: 'The new status when action is `update_status`.'
        }
      },
      required: ['action']
    },
    execute: async (args: {
      action: 'set_tasks' | 'update_status' | 'list' | 'clear'
      tasks?: TodoItem[]
      taskId?: string
      status?: TodoItem['status']
    }) => {
      const sessionId = 'current'
      let list = sessionTodos.get(sessionId) || []

      if (args.action === 'set_tasks' && args.tasks) {
        list = args.tasks.map((t, idx) => ({
          id: t.id || `task_${idx + 1}`,
          title: t.title,
          status: t.status || 'pending'
        }))
        sessionTodos.set(sessionId, list)
      } else if (args.action === 'update_status' && args.taskId && args.status) {
        const item = list.find(t => t.id === args.taskId)
        if (item) {
          item.status = args.status
        } else {
          list.push({ id: args.taskId, title: args.taskId, status: args.status })
        }
        sessionTodos.set(sessionId, list)
      } else if (args.action === 'clear') {
        sessionTodos.delete(sessionId)
        list = []
      }

      // Render markdown checklist view
      if (list.length === 0) {
        return 'Görev listesi boş.'
      }

      const formatted = list.map(t => {
        const icon = t.status === 'completed' ? '[x]' : t.status === 'in_progress' ? '[-]' : t.status === 'cancelled' ? '[~]' : '[ ]'
        const badge = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '⚡ (Çalışılıyor)' : t.status === 'cancelled' ? '✕ (İptal)' : '⏳'
        return `${icon} ${t.id}: ${t.title} ${badge}`
      }).join('\n')

      return `📋 Aktif Görev Listesi (${list.filter(t => t.status === 'completed').length}/${list.length} Tamamlandı):\n${formatted}`
    }
  }))
}
