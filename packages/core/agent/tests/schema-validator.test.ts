import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validateJsonSchema } from '../src/schema-validator.js'

describe('schema-validator (Contract JSON Schema Validation)', () => {
  const invoiceSchema = {
    type: 'object',
    required: ['case_id', 'decision', 'amount'],
    additionalProperties: false,
    properties: {
      case_id: { type: 'string', minLength: 1 },
      decision: { enum: ['CLEAR', 'REVIEW', 'NEEDS_INFO'] },
      amount: { type: 'number', minimum: 0 },
      tags: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  }

  test('valid payload passes', () => {
    const payload = {
      case_id: 'D01',
      decision: 'CLEAR',
      amount: 1500.50,
      tags: ['vat', 'urgent']
    }
    const res = validateJsonSchema(invoiceSchema, payload)
    assert.equal(res.valid, true)
    assert.deepEqual(res.errors, [])
  })

  test('detects missing required property', () => {
    const payload = {
      case_id: 'D01',
      decision: 'CLEAR'
      // amount is missing
    }
    const res = validateJsonSchema(invoiceSchema, payload)
    assert.equal(res.valid, false)
    assert.equal(res.errors.some(e => e.includes('missing required property "amount"')), true)
  })

  test('detects enum violation', () => {
    const payload = {
      case_id: 'D01',
      decision: 'INVALID_DECISION',
      amount: 100
    }
    const res = validateJsonSchema(invoiceSchema, payload)
    assert.equal(res.valid, false)
    assert.equal(res.errors.some(e => e.includes('is not in enum')), true)
  })

  test('detects additionalProperties violation', () => {
    const payload = {
      case_id: 'D01',
      decision: 'CLEAR',
      amount: 100,
      hackerField: true
    }
    const res = validateJsonSchema(invoiceSchema, payload)
    assert.equal(res.valid, false)
    assert.equal(res.errors.some(e => e.includes('unrecognized additional property "hackerField"')), true)
  })

  test('validates nested array items', () => {
    const payload = {
      case_id: 'D01',
      decision: 'CLEAR',
      amount: 100,
      tags: ['ok', 123 as any] // 123 is not string
    }
    const res = validateJsonSchema(invoiceSchema, payload)
    assert.equal(res.valid, false)
    assert.equal(res.errors.some(e => e.includes('expected type string, got number')), true)
  })
})
