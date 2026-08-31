import { describe, expect, it } from 'vitest'
import { buildDailySummaryEmail } from '../services/jobs/emailTemplates.js'

describe('Email Templates', () => {
  describe('buildDailySummaryEmail', () => {
    const baseData = {
      businessName: 'Test Shop',
      date: '2026-09-01',
      totalSales: 15000,
      salesCount: 5,
      totalPayments: 8000,
      paymentsCount: 3,
      totalUdhaar: 12000,
      udhaarCount: 4,
      totalOutstanding: 45000,
      totalOverdue: 20000,
      overdueCustomerCount: 2,
      topOverdueCustomers: [
        { name: 'Ahmed', amount: 15000, dueDate: '2026-08-15' },
        { name: 'Bilal', amount: 5000, dueDate: '2026-08-20' },
      ],
    }

    it('generates subject with business name and date', () => {
      const { subject } = buildDailySummaryEmail(baseData)
      expect(subject).toBe('Daily Summary — Test Shop (2026-09-01)')
    })

    it('includes business name in HTML', () => {
      const { html } = buildDailySummaryEmail(baseData)
      expect(html).toContain('Test Shop')
    })

    it('includes formatted currency amounts', () => {
      const { html } = buildDailySummaryEmail(baseData)
      expect(html).toContain('Rs 15,000')
      expect(html).toContain('Rs 8,000')
      expect(html).toContain('Rs 12,000')
    })

    it('includes sales count and payment count', () => {
      const { html } = buildDailySummaryEmail(baseData)
      expect(html).toContain('5 entries')
      expect(html).toContain('3 payments')
      expect(html).toContain('4 entries')
    })

    it('includes outstanding and overdue totals', () => {
      const { html } = buildDailySummaryEmail(baseData)
      expect(html).toContain('Rs 45,000')
      expect(html).toContain('Rs 20,000')
    })

    it('includes overdue customer names and amounts', () => {
      const { html } = buildDailySummaryEmail(baseData)
      expect(html).toContain('Ahmed')
      expect(html).toContain('Bilal')
      expect(html).toContain('2026-08-15')
      expect(html).toContain('2026-08-20')
    })

    it('shows "No overdue customers" when list is empty', () => {
      const data = { ...baseData, topOverdueCustomers: [] }
      const { html } = buildDailySummaryEmail(data)
      expect(html).toContain('No overdue customers')
    })

    it('produces valid HTML structure', () => {
      const { html } = buildDailySummaryEmail(baseData)
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('Digital Khata')
    })

    it('formats large amounts with locale separators', () => {
      const data = { ...baseData, totalSales: 1234567 }
      const { html } = buildDailySummaryEmail(data)
      expect(html).toContain('Rs 1,234,567')
    })
  })
})
