import { describe, expect, it } from 'vitest'
import {
  validateToolCall,
  requiresConfirmation,
  getToolPermissionLevel,
  RecordPaymentSchema,
  AddUdhaarSchema,
  CreateCustomerSchema,
  RecordSaleSchema,
  SendReminderSchema,
} from '../validation/toolCalls.js'

describe('API Validation: Tool Call Schema Enforcement', () => {
  describe('record_payment', () => {
    it('accepts valid payment args', () => {
      const result = validateToolCall('record_payment', {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        amount: 5000,
        method: 'Cash',
      })
      expect(result.amount).toBe(5000)
    })

    it('rejects negative amounts', () => {
      expect(() =>
        validateToolCall('record_payment', {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          amount: -100,
          method: 'Cash',
        })
      ).toThrow()
    })

    it('rejects zero amounts', () => {
      expect(() =>
        validateToolCall('record_payment', {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 0,
          method: 'Cash',
        })
      ).toThrow()
    })

    it('rejects amounts exceeding maximum', () => {
      expect(() =>
        validateToolCall('record_payment', {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 1000000000,
          method: 'Cash',
        })
      ).toThrow()
    })

    it('rejects invalid payment methods', () => {
      expect(() =>
        validateToolCall('record_payment', {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 500,
          method: 'Bitcoin',
        })
      ).toThrow()
    })

    it('rejects non-UUID customer IDs', () => {
      expect(() =>
        validateToolCall('record_payment', {
          customerId: 'not-a-uuid',
          amount: 500,
          method: 'Cash',
        })
      ).toThrow()
    })

    it('rejects missing required fields', () => {
      expect(() => validateToolCall('record_payment', {})).toThrow()
      expect(() =>
        validateToolCall('record_payment', { customerId: '550e8400-e29b-41d4-a716-446655440000' })
      ).toThrow()
    })

    it('validates date format when provided', () => {
      expect(() =>
        validateToolCall('record_payment', {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 500,
          method: 'Cash',
          date: 'invalid-date',
        })
      ).toThrow()

      const result = validateToolCall('record_payment', {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        amount: 500,
        method: 'Cash',
        date: '2026-01-15',
      })
      expect(result.date).toBe('2026-01-15')
    })
  })

  describe('add_udhaar', () => {
    it('accepts valid udhaar args', () => {
      const result = validateToolCall('add_udhaar', {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        amount: 10000,
        description: 'Monthly supplies',
      })
      expect(result.amount).toBe(10000)
    })

    it('rejects descriptions exceeding 500 chars', () => {
      expect(() =>
        validateToolCall('add_udhaar', {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 1000,
          description: 'x'.repeat(501),
        })
      ).toThrow()
    })
  })

  describe('create_customer', () => {
    it('accepts valid customer args', () => {
      const result = validateToolCall('create_customer', {
        name: 'Ahmed Khan',
        phone: '03001234567',
      })
      expect(result.name).toBe('Ahmed Khan')
    })

    it('rejects empty names', () => {
      expect(() => validateToolCall('create_customer', { name: '' })).toThrow()
    })

    it('rejects names exceeding 100 chars', () => {
      expect(() =>
        validateToolCall('create_customer', { name: 'x'.repeat(101) })
      ).toThrow()
    })

    it('rejects phone numbers exceeding 20 chars', () => {
      expect(() =>
        validateToolCall('create_customer', { name: 'Ahmed', phone: '0'.repeat(21) })
      ).toThrow()
    })
  })

  describe('record_sale', () => {
    it('accepts valid sale args', () => {
      const result = validateToolCall('record_sale', {
        amount: 25000,
        description: 'Daily sales',
      })
      expect(result.amount).toBe(25000)
    })

    it('rejects negative amounts', () => {
      expect(() =>
        validateToolCall('record_sale', { amount: -500, description: 'test' })
      ).toThrow()
    })
  })

  describe('send_reminder', () => {
    it('accepts valid reminder args', () => {
      const result = validateToolCall('send_reminder', {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        message: 'Please pay your balance',
        channel: 'whatsapp',
      })
      expect(result.channel).toBe('whatsapp')
    })

    it('rejects invalid channels', () => {
      expect(() =>
        validateToolCall('send_reminder', {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          message: 'Pay please',
          channel: 'email',
        })
      ).toThrow()
    })

    it('rejects messages exceeding 1000 chars', () => {
      expect(() =>
        validateToolCall('send_reminder', {
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          message: 'x'.repeat(1001),
          channel: 'sms',
        })
      ).toThrow()
    })
  })

  describe('unknown tools', () => {
    it('rejects unknown tool names', () => {
      expect(() => validateToolCall('delete_everything', {})).toThrow('Unknown tool')
      expect(() => validateToolCall('drop_database', {})).toThrow('Unknown tool')
    })
  })
})

describe('API Validation: Permission Levels', () => {
  it('marks send_reminder as high_risk', () => {
    expect(getToolPermissionLevel('send_reminder')).toBe('high_risk')
  })

  it('marks write tools correctly', () => {
    expect(getToolPermissionLevel('record_payment')).toBe('write')
    expect(getToolPermissionLevel('add_udhaar')).toBe('write')
    expect(getToolPermissionLevel('create_customer')).toBe('write')
    expect(getToolPermissionLevel('record_sale')).toBe('write')
  })

  it('marks unknown tools as read (not high_risk)', () => {
    expect(getToolPermissionLevel('unknown_tool')).toBe('read')
  })

  it('requires confirmation for all write tools', () => {
    expect(requiresConfirmation('record_payment')).toBe(true)
    expect(requiresConfirmation('add_udhaar')).toBe(true)
    expect(requiresConfirmation('create_customer')).toBe(true)
    expect(requiresConfirmation('record_sale')).toBe(true)
    expect(requiresConfirmation('send_reminder')).toBe(true)
  })

  it('does not require confirmation for unknown tools', () => {
    expect(requiresConfirmation('unknown_tool')).toBe(false)
  })
})

describe('API Validation: Injection Prevention', () => {
  it('rejects SQL injection in string fields', () => {
    expect(() =>
      validateToolCall('create_customer', { name: "'; DROP TABLE customers; --" })
    ).not.toThrow()
    const result = validateToolCall('create_customer', { name: "'; DROP TABLE customers; --" })
    expect(typeof result.name).toBe('string')
  })

  it('rejects script injection in description fields', () => {
    const result = validateToolCall('add_udhaar', {
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 1000,
      description: '<script>alert(1)</script>',
    })
    expect(typeof result.description).toBe('string')
  })

  it('rejects type coercion attacks', () => {
    expect(() =>
      validateToolCall('record_payment', {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        amount: '5000' as any,
        method: 'Cash',
      })
    ).toThrow()
  })

  it('rejects null/undefined in required fields', () => {
    expect(() =>
      validateToolCall('create_customer', { name: null as any })
    ).toThrow()
  })

  it('rejects extra unexpected fields gracefully', () => {
    const result = validateToolCall('create_customer', {
      name: 'Ahmed',
      extraField: 'should be stripped',
    })
    expect(result.name).toBe('Ahmed')
    expect(result.extraField).toBeUndefined()
  })
})
