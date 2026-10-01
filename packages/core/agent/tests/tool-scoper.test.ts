import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { prepareToolsForPreset, resolveAvailableSkills } from '../src/tool-scoper.js'

describe('tool-scoper (Zero-Trust Tool & Skill Scoping)', () => {
  const dummyTools = [
    { type: 'function', function: { name: 'bash', description: 'Run bash' } },
    { type: 'function', function: { name: 'read_file', description: 'Read file' } },
    {
      type: 'function',
      function: {
        name: 'skill',
        description: 'Generic skill loader',
        parameters: {
          type: 'object',
          properties: { skillName: { type: 'string' } },
          required: ['skillName']
        }
      }
    }
  ]

  const mockToolsService = {
    getOpenAiSchemas: (enabledTools?: string[]) => {
      if (!enabledTools) return dummyTools
      return dummyTools.filter(t => enabledTools.includes(t.function.name))
    }
  }

  test('returns empty array when preset has no enabledTools or empty enabledTools', () => {
    const result1 = prepareToolsForPreset(mockToolsService, { id: 'p_none' })
    assert.deepEqual(result1, [])

    const result2 = prepareToolsForPreset(mockToolsService, { id: 'p_empty', enabledTools: [] })
    assert.deepEqual(result2, [])
  })

  test('removes skill tool when activePreset has empty or missing enabledSkills', () => {
    const result1 = prepareToolsForPreset(mockToolsService, { id: 'p1', enabledTools: ['bash', 'read_file', 'skill'], enabledSkills: [] })
    assert.equal(result1.some(t => t.function.name === 'skill'), false)

    const result2 = prepareToolsForPreset(mockToolsService, { id: 'p2', enabledTools: ['bash', 'read_file', 'skill'] })
    assert.equal(result2.some(t => t.function.name === 'skill'), false)
  })

  test('customizes skill tool schema when preset has enabledSkills', () => {
    const preset = { id: 'p3', enabledTools: ['bash', 'read_file', 'skill'], enabledSkills: ['invoice-review-skill', 'budget-check'] }
    const result = prepareToolsForPreset(mockToolsService, preset)
    const skillTool = result.find(t => t.function.name === 'skill')

    assert.ok(skillTool)
    assert.ok(skillTool.function.description.includes('invoice-review-skill, budget-check'))
    assert.ok(skillTool.function.parameters.properties.skillName.description.includes('invoice-review-skill, budget-check'))
  })

  test('resolveAvailableSkills filters down to active allowed skills only', () => {
    const mockSkillsService = {
      listActiveSkills: () => [
        { id: 's1', name: 'Invoice-Review-Skill', description: 'Review invoices', enabled: true },
        { id: 's2', name: 'Other-Skill', description: 'Other', enabled: true }
      ]
    }

    const res = resolveAvailableSkills(mockSkillsService, { enabledSkills: ['invoice-review-skill'] })
    assert.equal(res.length, 1)
    assert.equal(res[0].id, 's1')
  })
})
