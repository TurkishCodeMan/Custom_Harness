import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { resolveProviderAndModel, resolveActivePreset } from '../src/resolver.js'
import { createMockContext } from './test-harness.js'

describe('resolveProviderAndModel (Fail-Fast)', () => {
  const mockSettings = {
    getSettings: () => ({
      providers: {
        vllm: {
          id: 'vllm',
          name: 'vLLM Local',
          models: [
            { id: 'qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', contextWindow: 32768 },
            { id: 'deepseek-v3', name: 'DeepSeek V3', contextWindow: 65536 }
          ]
        },
        openai: {
          id: 'openai',
          name: 'OpenAI API',
          models: [
            { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 }
          ]
        }
      }
    }),
    getActiveProvider: () => ({
      id: 'vllm',
      name: 'vLLM Local',
      models: [{ id: 'qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder 32B' }]
    }),
    getActiveModel: () => ({
      id: 'qwen-2.5-coder-32b',
      name: 'Qwen 2.5 Coder 32B',
      contextWindow: 32768
    })
  }

  test('resolves provider and model by exact modelId', () => {
    const { provider, model } = resolveProviderAndModel({ sessionId: 's1', prompt: 'hi', modelId: 'gpt-4o' }, mockSettings)
    assert.equal(provider.id, 'openai')
    assert.equal(model.id, 'gpt-4o')
    assert.equal(model.contextWindow, 128000)
  })

  test('resolves modelId with case-insensitive and partial matching', () => {
    const { provider, model } = resolveProviderAndModel({ sessionId: 's1', prompt: 'hi', modelId: 'QWEN-2.5-CODER-32B' }, mockSettings)
    assert.equal(provider.id, 'vllm')
    assert.equal(model.id, 'qwen-2.5-coder-32b')
  })

  test('falls back to active provider and model when no explicit modelId is given', () => {
    const { provider, model } = resolveProviderAndModel({ sessionId: 's1', prompt: 'hi' }, mockSettings)
    assert.equal(provider.id, 'vllm')
    assert.equal(model.id, 'qwen-2.5-coder-32b')
  })

  test('throws fail-fast error when requested model does NOT exist in any provider', () => {
    assert.throws(
      () => resolveProviderAndModel({ sessionId: 's1', prompt: 'hi', modelId: 'non-existent-model-xyz' }, mockSettings),
      /konfigüre edilmiş hiçbir sağlayıcıda/
    )
  })

  test('throws fail-fast error when requested providerId is invalid', () => {
    assert.throws(
      () => resolveProviderAndModel({ sessionId: 's1', prompt: 'hi', providerId: 'ghost-provider' }, mockSettings),
      /İstenen sağlayıcı \('ghost-provider'\) konfigürasyonda bulunamadı/
    )
  })

  test('throws fail-fast error when settings service is missing', () => {
    assert.throws(
      () => resolveProviderAndModel({ sessionId: 's1', prompt: 'hi' }, null),
      /'settings' servisi Context üzerinde bulunamadı/
    )
  })
})

describe('resolveActivePreset (Fail-Fast)', () => {
  test('resolves active preset when matching presetId is found', () => {
    const mockCtx = createMockContext({
      agentPresets: {
        get: (id: string) => id === 'architect' ? { id: 'architect', name: 'Architect' } : undefined,
        getActive: () => ({ id: 'developer', name: 'Developer' })
      }
    })

    const preset = resolveActivePreset(
      { sessionId: 's1', prompt: 'hi', presetId: 'architect' },
      {},
      {},
      {},
      mockCtx
    )

    assert.equal(preset.id, 'architect')
    assert.equal(preset.name, 'Architect')
  })

  test('throws fail-fast error when an explicitly requested presetId does NOT exist', () => {
    const mockCtx = createMockContext({
      agentPresets: {
        get: () => undefined,
        getActive: () => ({ id: 'developer' })
      },
      settings: {
        getPreset: () => undefined,
        getActivePreset: () => undefined
      }
    })

    assert.throws(
      () => resolveActivePreset(
        { sessionId: 's1', prompt: 'hi', presetId: 'unknown-preset' },
        {},
        {},
        {},
        mockCtx
      ),
      /İstenen preset \('unknown-preset'\) tanımlı değil veya bulunamadı/
    )
  })
})
