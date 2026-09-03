import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getClient: vi.fn(),
}))

vi.mock('../database/index.js', () => ({
  query: mocks.query,
  getClient: mocks.getClient,
}))

const {
  addUdhaar,
} = await import('../repositories/udhaarRepository.js')
const { recordSale } = await import('../repositories/saleRepository.js')
const { recordPayment } = await import('../repositories/paymentRepository.js')

describe('cross-tenant repository ownership guards', () => {
  beforeEach(() => {
    mocks.query.mockReset()
    mocks.getClient.mockReset()
  })

  describe('addUdhaar', () => {
    it('rejects a customerId that does not belong to the business (no insert)', async () => {
      // First query is the ownership check -> no customer found for this business.
      mocks.query.mockResolvedValueOnce({ rows: [] })

      await expect(
        addUdhaar('business-A', 'customer-of-business-B', 100, 'desc'),
      ).rejects.toThrow('Customer not found in this business')

      // Only the ownership check should have run — never the INSERT across tenants.
      expect(mocks.query).toHaveBeenCalledTimes(1)
      const q = mocks.query.mock.calls[0][0] as string
      expect(q.toLowerCase()).toContain('select 1 from customers')
    })

    it('inserts when the customer belongs to the business', async () => {
      mocks.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] })
      mocks.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'u1',
            business_id: 'business-A',
            customer_id: 'c1',
            amount: 100,
            remaining_amount: '100',
            description: 'desc',
            due_date: null,
            sync_status: 'pending',
            version: 1,
            is_deleted: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      })

      const entry = await addUdhaar('business-A', 'c1', 100, 'desc')
      expect(entry.id).toBe('u1')
      expect(mocks.query).toHaveBeenCalledTimes(2)
    })
  })

  describe('recordSale', () => {
    it('rejects a customerId from another business', async () => {
      mocks.query.mockResolvedValueOnce({ rows: [] })

      await expect(
        recordSale('business-A', 100, 'desc', '2026-01-01', 'customer-of-business-B'),
      ).rejects.toThrow('Customer not found in this business')

      expect(mocks.query).toHaveBeenCalledTimes(1)
    })

    it('allows a sale without a customerId', async () => {
      mocks.query.mockResolvedValueOnce({
        rows: [
          {
            id: 's1',
            business_id: 'business-A',
            customer_id: null,
            amount: 100,
            description: 'desc',
            date: '2026-01-01',
            sync_status: 'pending',
            version: 1,
            is_deleted: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      })

      const sale = await recordSale('business-A', 100, 'desc', '2026-01-01')
      expect(sale.id).toBe('s1')
    })
  })

  describe('recordPayment', () => {
    function makeClient() {
      let committed = false
      let rolledBack = false
      const queries: string[] = []
      const client = {
        query: vi.fn(async (sql: string) => {
          queries.push(sql)
          const lower = sql.toLowerCase()
          if (lower.startsWith('begin')) return { rows: [] }
          if (lower.startsWith('commit')) {
            committed = true
            return { rows: [] }
          }
          if (lower.startsWith('rollback')) {
            rolledBack = true
            return { rows: [] }
          }
          if (lower.includes('from customers')) {
            return { rows: [{ present: true }] }
          }
          if (lower.includes('from udhaar')) {
            return { rows: [{ present: true }] }
          }
          if (lower.startsWith('insert into payments')) {
            return {
              rows: [
                {
                  id: 'p1',
                  business_id: 'business-A',
                  customer_id: 'c1',
                  udhaar_id: 'u1',
                  amount: 50,
                  method: 'Cash',
                  date: '2026-01-01',
                  sync_status: 'pending',
                  version: 1,
                  is_deleted: false,
                  created_at: new Date(),
                  updated_at: new Date(),
                },
              ],
            }
          }
          return { rows: [] }
        }),
        release: vi.fn(),
      }
      return { client, get committed() { return committed }, get rolledBack() { return rolledBack }, queries }
    }

    it('rejects a customerId from another business and rolls back', async () => {
      const { client } = makeClient()
      // Force the customer ownership check to return nothing (foreign tenant).
      client.query.mockImplementation(async (sql: string) => {
        const lower = (sql as string).toLowerCase()
        if (lower.startsWith('begin')) return { rows: [] }
        if (lower.startsWith('rollback')) return { rows: [] }
        if (lower.includes('from customers')) return { rows: [] }
        throw new Error('unexpected query: ' + sql)
      })
      mocks.getClient.mockResolvedValue(client)

      await expect(
        recordPayment('business-A', 'customer-of-business-B', 50, 'Cash', '2026-01-01', 'u1'),
      ).rejects.toThrow('Customer not found in this business')

      // The transaction must not commit and the connection must be released.
      expect(client.query.mock.calls.some((c) => /commit/i.test(String(c[0])))).toBe(false)
      expect(client.release).toHaveBeenCalled()
    })

    it('rejects an udhaarId that belongs to another business/customer', async () => {
      const { client } = makeClient()
      // Customer check passes, but udhaar belongs to a different tenant -> empty.
      client.query.mockImplementation(async (sql: string) => {
        const lower = (sql as string).toLowerCase()
        if (lower.startsWith('begin')) return { rows: [] }
        if (lower.startsWith('rollback')) return { rows: [] }
        if (lower.includes('from customers')) return { rows: [{ present: true }] }
        if (lower.includes('from udhaar')) return { rows: [] }
        throw new Error('unexpected query: ' + sql)
      })
      mocks.getClient.mockResolvedValue(client)

      await expect(
        recordPayment('business-A', 'c1', 50, 'Cash', '2026-01-01', 'foreign-udhaar'),
      ).rejects.toThrow('Udhaar not found for this customer in this business')

      expect(client.query.mock.calls.some((c) => /commit/i.test(String(c[0])))).toBe(false)
      expect(client.release).toHaveBeenCalled()
    })

    it('records a payment when customer and udhaar belong to the business', async () => {
      const { client } = makeClient()
      mocks.getClient.mockResolvedValue(client)

      const payment = await recordPayment('business-A', 'c1', 50, 'Cash', '2026-01-01', 'u1')
      expect(payment.id).toBe('p1')
      expect(client.query.mock.calls.some((c) => /commit/i.test(String(c[0])))).toBe(true)
      expect(client.release).toHaveBeenCalled()
    })
  })
})
