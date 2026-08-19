import { Service } from 'cordis'
import type { Context } from '@custom-harness/core-context'

export const name = 'persona'
export const inject = ['settings', 'agentPresets']

export interface PersonaConfig {
  text?: string
}

export class PersonaService extends Service {
  declare ctx: Context
  private customPersona?: string

  constructor(ctx: Context) {
    super(ctx, 'persona')
  }

  public setCustomPersona(text: string) {
    this.customPersona = text
  }

  public getActivePersona(): string {
    if (this.customPersona) {
      return this.customPersona
    }
    const activePreset = this.ctx.agentPresets?.getActive()
    if (activePreset?.systemPrompt) {
      return activePreset.systemPrompt
    }
    return 'You are an elite autonomous AI software engineer and coding assistant.'
  }
}

export function apply(ctx: Context) {
  ctx.set('persona', new PersonaService(ctx))
}
