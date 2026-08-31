import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/logger.js', () => ({
  createChildLogger: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }),
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}))

const mockQuery = vi.fn()
vi.mock('../database/index.js', () => ({ query: (...args: unknown[]) => mockQuery(...args) }))

const mockSendMail = vi.fn()
vi.mock('../config/mail.js', () => ({ sendMail: (...args: unknown[]) => mockSendMail(...args) }))

const mockSendOverdueReminders = vi.fn()
vi.mock('../services/reminderService.js', () => ({
  sendOverdueReminders: (...args: unknown[]) => mockSendOverdueReminders(...args),
}))

vi.mock('node-cron', () => ({
  default: { schedule: () => ({ stop: () => {} }) },
}))

describe('Scheduler', () => {
  it('starts and reports active jobs', async () => {
    const { startScheduler, getScheduledJobs, stopScheduler } = await import('../services/scheduler.js')

    startScheduler()
    const jobs = getScheduledJobs()
    expect(jobs).toHaveLength(2)
    expect(jobs[0].name).toBe('dailySummary')
    expect(jobs[0].schedule).toBe('0 9 * * *')
    expect(jobs[0].active).toBe(true)
    expect(jobs[1].name).toBe('overdueReminders')
    expect(jobs[1].schedule).toBe('0 10 * * *')
    expect(jobs[1].active).toBe(true)

    stopScheduler()
    const afterStop = getScheduledJobs()
    expect(afterStop[0].active).toBe(false)
    expect(afterStop[1].active).toBe(false)
  })
})

describe('Daily Summary Job', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockSendMail.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends emails to verified business owners', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'biz-1', name: 'Test Shop', owner_email: 'owner@test.com' }] })
      .mockResolvedValueOnce({ rows: [{ total: '15000', count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ total: '8000', count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ total: '12000', count: '4' }] })
      .mockResolvedValueOnce({ rows: [{ total: '45000' }] })
      .mockResolvedValueOnce({ rows: [{ total: '20000' }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Ahmed', amount: '15000', due_date: '2026-08-15' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [] })
    mockSendMail.mockResolvedValue(true)

    const { runDailySummaryJob } = await import('../services/jobs/dailySummary.js')
    const result = await runDailySummaryJob()

    expect(result.sent).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('counts skipped when mail not sent', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'biz-1', name: 'Test Shop', owner_email: 'owner@test.com' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0', count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0', count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0', count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
    mockSendMail.mockResolvedValue(false)

    const { runDailySummaryJob } = await import('../services/jobs/dailySummary.js')
    const result = await runDailySummaryJob()

    expect(result.skipped).toBe(1)
    expect(result.sent).toBe(0)
  })

  it('handles database errors gracefully', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection lost'))

    const { runDailySummaryJob } = await import('../services/jobs/dailySummary.js')
    const result = await runDailySummaryJob()

    expect(result.sent).toBe(0)
    expect(result.failed).toBe(0)
  })

  it('skips businesses with no verified email users', async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    const { runDailySummaryJob } = await import('../services/jobs/dailySummary.js')
    const result = await runDailySummaryJob()

    expect(result.sent).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.skipped).toBe(0)
  })
})

describe('Overdue Reminder Job', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockSendOverdueReminders.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('processes all active businesses', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { id: 'biz-1', name: 'Shop A', preferred_language: null },
          { id: 'biz-2', name: 'Shop B', preferred_language: 'ur' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
    mockSendOverdueReminders.mockResolvedValue({ sent: 2, skipped: 1, failed: 0, details: [] })

    const { runOverdueReminderJob } = await import('../services/jobs/overdueReminders.js')
    const result = await runOverdueReminderJob()

    expect(result.businessesProcessed).toBe(2)
    expect(result.totalSent).toBe(4)
  })

  it('handles reminder service errors per business', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'biz-1', name: 'Shop A', preferred_language: null }],
    })
    mockSendOverdueReminders.mockRejectedValue(new Error('WhatsApp API down'))

    const { runOverdueReminderJob } = await import('../services/jobs/overdueReminders.js')
    const result = await runOverdueReminderJob()

    expect(result.businessesProcessed).toBe(0)
    expect(result.totalFailed).toBe(1)
  })

  it('handles empty business list', async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    const { runOverdueReminderJob } = await import('../services/jobs/overdueReminders.js')
    const result = await runOverdueReminderJob()

    expect(result.businessesProcessed).toBe(0)
    expect(result.totalSent).toBe(0)
  })

  it('uses Urdu language for businesses with ur preference', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'biz-1', name: 'Shop', preferred_language: 'ur' }] })
      .mockResolvedValueOnce({ rows: [] })
    mockSendOverdueReminders.mockResolvedValue({ sent: 1, skipped: 0, failed: 0, details: [] })

    const { runOverdueReminderJob } = await import('../services/jobs/overdueReminders.js')
    await runOverdueReminderJob()

    expect(mockSendOverdueReminders).toHaveBeenCalledWith('biz-1', 'ur')
  })
})
