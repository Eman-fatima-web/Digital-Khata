import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const schemaPath = resolve(__dirname, '../database/schema.sql')
const schema = readFileSync(schemaPath, 'utf-8')

describe('RLS Cross-Tenant Isolation', () => {
  const tables = [
    'businesses',
    'users',
    'customers',
    'udhaar',
    'payments',
    'sales',
    'reminders',
    'sync_queue',
    'audit_logs',
  ]

  it('enables RLS on all tenant-scoped tables', () => {
    for (const table of tables) {
      const pattern = new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`, 'i')
      expect(schema).toMatch(pattern)
    }
  })

  it('creates business_isolation policy on all tenant-scoped tables', () => {
    for (const table of tables) {
      const enablePattern = new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`, 'i')
      expect(schema).toMatch(enablePattern)

      const policyPattern = new RegExp(
        `CREATE POLICY business_isolation ON ${table} USING`,
        'i'
      )
      expect(schema).toMatch(policyPattern)
    }
  })

  it('uses app.business_id session variable for tenant scoping', () => {
    const policyMatches = schema.match(/CREATE POLICY business_isolation ON \w+ USING \([^)]+\)/gi) ?? []
    expect(policyMatches.length).toBeGreaterThanOrEqual(tables.length)

    for (const policy of policyMatches) {
      expect(policy).toContain("current_setting('app.business_id'")
    }
  })

  it('references business_id column in all isolation policies', () => {
    const customerPolicy = schema.match(/CREATE POLICY business_isolation ON customers USING \([^)]+\)/i)
    expect(customerPolicy).toBeTruthy()
    expect(customerPolicy![0]).toContain('business_id')

    const udhaarPolicy = schema.match(/CREATE POLICY business_isolation ON udhaar USING \([^)]+\)/i)
    expect(udhaarPolicy).toBeTruthy()
    expect(udhaarPolicy![0]).toContain('business_id')

    const paymentsPolicy = schema.match(/CREATE POLICY business_isolation ON payments USING \([^)]+\)/i)
    expect(paymentsPolicy).toBeTruthy()
    expect(paymentsPolicy![0]).toContain('business_id')
  })

  it('tenant middleware rejects requests without businessId', async () => {
    const { tenantIsolation } = await import('../middleware/tenant.js')

    const req = { businessId: undefined } as any
    const res = {
      statusCode: 0,
      body: null as any,
      status(code: number) {
        this.statusCode = code
        return this
      },
      json(data: any) {
        this.body = data
        return this
      },
    } as any
    const next = () => { throw new Error('next() should not be called') }

    tenantIsolation(req, res, next)

    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('Business context required')
  })

  it('validateTenantOwnership returns false for mismatched tenants', async () => {
    const { validateTenantOwnership } = await import('../middleware/tenant.js')

    expect(validateTenantOwnership('tenant-a', 'tenant-b')).toBe(false)
    expect(validateTenantOwnership('tenant-a', 'tenant-a')).toBe(true)
  })
})
