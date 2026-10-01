import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { executeContractDelegation } from '../src/contract-delegator.js'

describe('contract-delegator (Contract-Safe Delegation Execution)', () => {
  const erpValidatorPreset = {
    id: 'erp-validator',
    name: 'ERP Validator',
    contract: {
      contractVersion: 1,
      isCallableByAgents: true,
      allowedCallers: ['invoice-reviewer-v1', 'procurement-agent', 'p3'],
      budget: { maxDelegationDepth: 3 },
      inputSchema: {
        type: 'object',
        required: ['po_number'],
        properties: {
          po_number: { type: 'string', minLength: 2 },
          amount: { type: 'number' }
        }
      },
      outputSchema: {
        type: 'object',
        required: ['match_status'],
        properties: {
          match_status: { enum: ['MATCHED', 'DISCREPANCY'] }
        }
      }
    }
  }

  function createMockContext(agentRunResult = '{"match_status": "MATCHED"}', existingStack?: string[]) {
    const sessions = new Map<string, any>()
    const parentSession = {
      id: 'session_parent_123',
      traceId: 'trace_test_001',
      delegationCallStack: existingStack || ['invoice-reviewer-v1']
    }
    sessions.set(parentSession.id, parentSession)

    const events: any[] = []

    return {
      session: {
        getSession: (id: string) => sessions.get(id),
        createSession: (title: string, cwd?: string, userId?: string, clientType?: string, isInternal?: boolean) => {
          const s = { id: `sub_${Date.now()}`, title, messages: [] }
          sessions.set(s.id, s)
          return s
        },
        saveSession: (s: any) => sessions.set(s.id, s)
      },
      agentPresets: {
        get: (id: string) => (id === 'erp-validator' ? erpValidatorPreset : undefined)
      },
      agent: {
        run: async (opts: any) => agentRunResult
      },
      emit: (evt: string, data: any) => events.push({ evt, data }),
      _events: events
    } as any
  }

  test('successfully executes contract delegation and validates schemas', async () => {
    const ctx = createMockContext('{"match_status": "MATCHED"}')
    const execContext: any = {
      sessionId: 'session_parent_123',
      userId: 'user_admin',
      activePreset: {
        id: 'invoice-reviewer-v1',
        contract: { allowedDelegates: ['erp-validator'] }
      },
      cwd: '/test/workspace'
    }

    const res = await executeContractDelegation(
      ctx,
      { id: 'call_1', name: 'delegate_to_erp_validator', arguments: JSON.stringify({ po_number: 'PO-999', amount: 500 }) },
      execContext
    )

    assert.equal(res.status, 'success')
    assert.equal(res.delegatedTo, 'erp-validator')
    assert.deepEqual(res.data, { match_status: 'MATCHED' })
    assert.equal(ctx._events.some((e: any) => e.evt === 'agent/delegation_completed'), true)
  })

  test('fails fast when input schema validation fails', async () => {
    const ctx = createMockContext()
    const execContext: any = {
      sessionId: 'session_parent_123',
      activePreset: {
        id: 'invoice-reviewer-v1',
        contract: { allowedDelegates: ['erp-validator'] }
      }
    }

    // po_number is missing!
    const res = await executeContractDelegation(
      ctx,
      { id: 'call_2', name: 'delegate_to_erp_validator', arguments: JSON.stringify({ amount: 500 }) },
      execContext
    )

    assert.equal(res.status, 'error')
    assert.equal(res.code, 'INPUT_SCHEMA_VIOLATION')
    assert.ok(res.validationErrors.some((e: string) => e.includes('missing required property "po_number"')))
  })

  test('prevents cyclic delegation (A -> B -> A)', async () => {
    // Current stack already contains 'erp-validator'
    const ctx = createMockContext('{}', ['invoice-reviewer-v1', 'erp-validator', 'procurement-agent'])
    const execContext: any = {
      sessionId: 'session_parent_123',
      activePreset: {
        id: 'procurement-agent',
        contract: { allowedDelegates: ['erp-validator'] }
      }
    }

    const res = await executeContractDelegation(
      ctx,
      { id: 'call_3', name: 'delegate_to_erp_validator', arguments: JSON.stringify({ po_number: 'PO-1' }) },
      execContext
    )

    assert.equal(res.status, 'error')
    assert.equal(res.code, 'CYCLIC_DELEGATION_DETECTED')
  })

  test('enforces maxDelegationDepth', async () => {
    // Current stack depth is 3, max depth is 3
    const ctx = createMockContext('{}', ['p1', 'p2', 'p3'])
    const execContext: any = {
      sessionId: 'session_parent_123',
      activePreset: {
        id: 'p3',
        contract: { allowedDelegates: ['erp-validator'] }
      }
    }

    const res = await executeContractDelegation(
      ctx,
      { id: 'call_4', name: 'delegate_to_erp_validator', arguments: JSON.stringify({ po_number: 'PO-1' }) },
      execContext
    )

    assert.equal(res.status, 'error')
    assert.equal(res.code, 'MAX_DELEGATION_DEPTH_EXCEEDED')
  })
})
