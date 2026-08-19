import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'
import type { AskUserQuestionAnswer, AskUserQuestionItem, AskUserQuestionOption, AskUserQuestionIntent, AskUserQuestionAnswerItem } from './types.js'

export type {
  AskUserQuestionAnswer,
  AskUserQuestionAnswerItem,
  AskUserQuestionIntent,
  AskUserQuestionItem,
  AskUserQuestionOption
}

export interface AskUserQuestionRequest {
  questions: AskUserQuestionItem[]
  signal?: AbortSignal
}

export interface UserQuestionProvider {
  ask(request: AskUserQuestionRequest): Promise<AskUserQuestionAnswer>
}

export const name = 'user-questions'

export class UserQuestionService extends Service {
  private provider: UserQuestionProvider | undefined

  constructor(ctx: Context) {
    super(ctx, 'userQuestions')
  }

  public registerProvider(provider: UserQuestionProvider): () => void {
    this.provider = provider
    return () => {
      if (this.provider === provider) {
        this.provider = undefined
      }
    }
  }

  public async ask(request: AskUserQuestionRequest): Promise<AskUserQuestionAnswer> {
    if (request.signal?.aborted) {
      throw new Error('ask_user_question was aborted before the user answered')
    }
    if (!request.questions || request.questions.length === 0) {
      throw new Error('ask_user_question requires at least one question')
    }

    if (this.provider) {
      return this.provider.ask(request)
    }

    console.log('[UserQuestions] Default headless answer used for:', request.questions)
    return {
      answers: request.questions.map(q => ({
        id: q.id,
        selected: q.options && q.options.length > 0 ? [q.options[0].label] : ['Confirmed']
      }))
    }
  }
}

export function apply(ctx: Context) {
  ctx.set('userQuestions', new UserQuestionService(ctx))
}

export default UserQuestionService
