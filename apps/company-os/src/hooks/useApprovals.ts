import { useState, useEffect } from 'react'
import type { ApprovalItem } from '../types.js'
import { wsClient } from '../ws.js'

export type ApprovalPolicyType = 'auto' | 'ask_dangerous' | 'ask_all'

export function useApprovals() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([])
  const [approvalPolicy, setApprovalPolicy] = useState<ApprovalPolicyType>('ask_dangerous')

  const handleSelectApprovalPolicy = (newPolicy: ApprovalPolicyType) => {
    setApprovalPolicy(newPolicy)
    try {
      localStorage.setItem('company_os_approval_policy', newPolicy)
    } catch {}
    wsClient.send('approval_policy', { policy: newPolicy })
  }

  const handleApprove = (id: string, outcome: 'allow_once' | 'allow_always' = 'allow_once') => {
    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'approved', resolvedAt: Date.now() } : a))
    )
    wsClient.send('approval_response', { id, outcome })
  }

  const handleDeny = (id: string) => {
    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'denied', resolvedAt: Date.now() } : a))
    )
    wsClient.send('approval_response', { id, outcome: 'deny' })
  }

  return {
    approvals,
    setApprovals,
    approvalPolicy,
    setApprovalPolicy,
    handleSelectApprovalPolicy,
    handleApprove,
    handleDeny
  }
}
