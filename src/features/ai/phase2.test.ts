import { beforeEach, describe, expect, it } from 'vitest'
import {
  getToolPermission,
  requiresConfirmation,
  validateToolArgs,
  TOOL_REGISTRY,
} from './tools'
import { detectIntent } from './intents'
import {
  logActionConfirmed,
  logActionCancelled,
  logActionFailed,
  getAuditLog,
  clearAuditLog,
  getAuditLogCount,
} from './auditLog'
import type { ActionProposal } from '../../core/types'

describe('Tool Permission System', () => {
  describe('TOOL_REGISTRY', () => {
    it('has all expected tools registered', () => {
      const expectedTools = [
        'searchCustomer', 'getCustomer', 'getCustomerBalance', 'getCustomerLedger',
        'getPaymentsByCustomer', 'getUdhaarByCustomer',
        'createCustomer', 'addUdhaar', 'recordPayment', 'recordSale',
        'deleteCustomer', 'deleteUdhaar', 'deletePayment',
      ]
      for (const tool of expectedTools) {
        expect(TOOL_REGISTRY[tool]).toBeDefined()
        expect(TOOL_REGISTRY[tool].name).toBe(tool)
      }
    })

    it('classifies read tools correctly', () => {
      expect(getToolPermission('searchCustomer')).toBe('read')
      expect(getToolPermission('getCustomer')).toBe('read')
      expect(getToolPermission('getCustomerBalance')).toBe('read')
      expect(getToolPermission('getCustomerLedger')).toBe('read')
    })

    it('classifies write tools correctly', () => {
      expect(getToolPermission('createCustomer')).toBe('write')
      expect(getToolPermission('addUdhaar')).toBe('write')
      expect(getToolPermission('recordPayment')).toBe('write')
      expect(getToolPermission('recordSale')).toBe('write')
    })

    it('classifies high-risk tools correctly', () => {
      expect(getToolPermission('deleteCustomer')).toBe('high_risk')
      expect(getToolPermission('deleteUdhaar')).toBe('high_risk')
      expect(getToolPermission('deletePayment')).toBe('high_risk')
    })

    it('defaults unknown tools to high_risk', () => {
      expect(getToolPermission('unknownTool')).toBe('high_risk')
    })
  })

  describe('requiresConfirmation', () => {
    it('read tools do not require confirmation', () => {
      expect(requiresConfirmation('searchCustomer')).toBe(false)
      expect(requiresConfirmation('getCustomerBalance')).toBe(false)
    })

    it('write tools require confirmation', () => {
      expect(requiresConfirmation('createCustomer')).toBe(true)
      expect(requiresConfirmation('addUdhaar')).toBe(true)
      expect(requiresConfirmation('recordPayment')).toBe(true)
    })

    it('high-risk tools require confirmation', () => {
      expect(requiresConfirmation('deleteCustomer')).toBe(true)
      expect(requiresConfirmation('deleteUdhaar')).toBe(true)
    })

    it('unknown tools default to requiring confirmation', () => {
      expect(requiresConfirmation('unknownTool')).toBe(true)
    })
  })

  describe('validateToolArgs', () => {
    it('validates createCustomer requires name', () => {
      expect(validateToolArgs('createCustomer', {})).toBe('Customer name is required')
      expect(validateToolArgs('createCustomer', { name: '' })).toBe('Customer name is required')
      expect(validateToolArgs('createCustomer', { name: 'Ahmed' })).toBeNull()
    })

    it('validates createCustomer phone must be string', () => {
      expect(validateToolArgs('createCustomer', { name: 'Ahmed', phone: 123 })).toBe('Phone must be a string')
      expect(validateToolArgs('createCustomer', { name: 'Ahmed', phone: '03001234567' })).toBeNull()
    })

    it('validates amount must be positive for write tools', () => {
      expect(validateToolArgs('addUdhaar', { amount: 0 })).toBe('Amount must be a positive number')
      expect(validateToolArgs('addUdhaar', { amount: -100 })).toBe('Amount must be a positive number')
      expect(validateToolArgs('recordPayment', { amount: 0 })).toBe('Amount must be a positive number')
      expect(validateToolArgs('recordSale', { amount: -50 })).toBe('Amount must be a positive number')
    })

    it('validates amount must not exceed maximum', () => {
      expect(validateToolArgs('addUdhaar', { amount: 1000000000 })).toBe('Amount exceeds maximum allowed value')
      expect(validateToolArgs('addUdhaar', { amount: 5000 })).toBeNull()
    })

    it('validates delete tools require ID', () => {
      expect(validateToolArgs('deleteCustomer', {})).toBe('Record ID is required for deletion')
      expect(validateToolArgs('deleteCustomer', { id: 'c1' })).toBeNull()
      expect(validateToolArgs('deleteUdhaar', { id: 123 })).toBe('Record ID is required for deletion')
    })

    it('returns null for unknown tools', () => {
      expect(validateToolArgs('unknownTool', {})).toBeNull()
    })
  })
})

describe('Navigation Intent', () => {
  it('detects navigation intent for customers', () => {
    expect(detectIntent('customers kholo')).toBe('NAVIGATE')
    expect(detectIntent('gahak dikhao')).toBe('NAVIGATE')
  })

  it('detects navigation intent for udhaar', () => {
    expect(detectIntent('udhaar kholo')).toBe('NAVIGATE')
  })

  it('detects navigation intent for payments', () => {
    expect(detectIntent('payments dikhao')).toBe('NAVIGATE')
  })

  it('detects navigation intent for reports', () => {
    expect(detectIntent('reports kholo')).toBe('NAVIGATE')
  })

  it('detects navigation intent for sales', () => {
    expect(detectIntent('sales dikhao')).toBe('NAVIGATE')
  })

  it('detects navigation intent for reminders', () => {
    expect(detectIntent('reminders kholo')).toBe('NAVIGATE')
  })

  it('detects navigation intent for settings', () => {
    expect(detectIntent('settings kholo')).toBe('NAVIGATE')
  })

  it('detects navigation intent for dashboard', () => {
    expect(detectIntent('dashboard dikhao')).toBe('NAVIGATE')
  })

  it('does not detect navigation for questions', () => {
    expect(detectIntent('customers kahan hain?')).not.toBe('NAVIGATE')
  })
})

describe('Theme Intent', () => {
  it('detects dark theme intent', () => {
    expect(detectIntent('theme dark kar do')).toBe('SET_THEME')
    expect(detectIntent('dark mode')).toBe('SET_THEME')
  })

  it('detects light theme intent', () => {
    expect(detectIntent('theme light kar do')).toBe('SET_THEME')
    expect(detectIntent('light mode')).toBe('SET_THEME')
  })
})

describe('Audit Logging', () => {
  beforeEach(() => {
    clearAuditLog()
  })

  const sampleProposal: ActionProposal = {
    kind: 'ADD_UDHAAR',
    customerId: 'c1',
    customerName: 'Ahmed',
    amount: 5000,
  }

  it('logs confirmed actions', () => {
    logActionConfirmed(sampleProposal)
    const log = getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0].action).toBe('ADD_UDHAAR')
    expect(log[0].result).toBe('confirmed')
    expect(log[0].customerId).toBe('c1')
    expect(log[0].amount).toBe(5000)
    expect(log[0].timestamp).toBeDefined()
  })

  it('logs cancelled actions', () => {
    logActionCancelled(sampleProposal)
    const log = getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0].result).toBe('cancelled')
  })

  it('logs failed actions with error message', () => {
    logActionFailed(sampleProposal, 'Database error')
    const log = getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0].result).toBe('failed')
    expect(log[0].errorMessage).toBe('Database error')
  })

  it('truncates long error messages', () => {
    const longError = 'x'.repeat(500)
    logActionFailed(sampleProposal, longError)
    const log = getAuditLog()
    expect(log[0].errorMessage!.length).toBeLessThanOrEqual(200)
  })

  it('tracks audit log count', () => {
    expect(getAuditLogCount()).toBe(0)
    logActionConfirmed(sampleProposal)
    expect(getAuditLogCount()).toBe(1)
    logActionCancelled(sampleProposal)
    expect(getAuditLogCount()).toBe(2)
  })

  it('clears audit log', () => {
    logActionConfirmed(sampleProposal)
    logActionCancelled(sampleProposal)
    expect(getAuditLogCount()).toBe(2)
    clearAuditLog()
    expect(getAuditLogCount()).toBe(0)
  })

  it('does not log sensitive data', () => {
    logActionConfirmed(sampleProposal)
    const log = getAuditLog()
    const logStr = JSON.stringify(log)
    // Audit log should not contain raw customer messages or PINs
    expect(logStr).not.toContain('pin')
    expect(logStr).not.toContain('password')
    expect(logStr).not.toContain('apiKey')
  })

  it('caps log at MAX_LOG_ENTRIES', () => {
    // Add more than 500 entries
    for (let i = 0; i < 510; i++) {
      logActionConfirmed({ ...sampleProposal, amount: i })
    }
    expect(getAuditLogCount()).toBeLessThanOrEqual(500)
  })
})
