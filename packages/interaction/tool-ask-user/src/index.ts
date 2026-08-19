import type { Context } from '@custom-harness/core-context'
import { defineTool } from '@custom-harness/core-tools'

export const name = 'tool-ask-user'
export const inject = ['tools', 'userQuestions']

const description = 'Ask the user a concise question when you need confirmation, a choice, or missing information before proceeding. '
  + 'Send one or more questions, each with a stable id that will be echoed in the answer.'

export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'ask_user_question',
    description,
    parameters: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          description: 'Questions to ask the user before continuing.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Stable id for this question; echoed in the answer.' },
              question: { type: 'string', description: 'The specific question to ask the user.' },
              header: {
                type: 'string',
                description: 'Optional short heading for the question, such as "Confirm" or "Choose Mode".',
              },
              options: {
                type: 'array',
                description: 'Optional choices to show the user. If you recommend one, put it first and append "(Recommended)" to that label.',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string', description: 'Short user-facing option label.' },
                    description: { type: 'string', description: 'One sentence explaining the tradeoff or impact.' },
                  },
                  required: ['label']
                },
              },
              multi_select: {
                type: 'boolean',
                description: 'Whether the user may select more than one option. Defaults to false.',
              },
            },
            required: ['id', 'question']
          },
        },
      },
      required: ['questions']
    },
    async execute(args: { questions: any[] }, exec?: { signal?: AbortSignal }) {
      const result = await ctx.userQuestions.ask({
        questions: args.questions.map(question => ({
          id: question.id,
          question: question.question,
          ...(question.header !== undefined ? { header: question.header } : {}),
          ...(question.options !== undefined ? { options: question.options } : {}),
          ...(question.multi_select !== undefined ? { multiSelect: question.multi_select } : {}),
        })),
        signal: exec?.signal,
      })
      return JSON.stringify(result, null, 2)
    },
  }))
}
