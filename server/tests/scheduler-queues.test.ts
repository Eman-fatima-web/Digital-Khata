import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/logger.js', () => ({
  createChildLogger: () => ({ info: () => { }, warn: () => { }, error: () => { }, debug: () => { } }),
  logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } },
}))

const mockEnqueueJob = vi.fn()
vi.mock('../queues/index', () => ({
  enqueueJob: (...args: unknown[]) => mockEnqueueJob(...args),
}))

const mockRunDaily = vi.fn()
const mockRunOverdue = vi.fn()
vi.mock('../services/jobs/dailySummary.js', () => ({ runDailySummaryJob: (...a: unknown[]) => mockRunDaily(...a) }))
vi.mock('../services/jobs/overdueReminders.js', () => ({ runOverdueReminderJob: (...a: unknown[]) => mockRunOverdue(...a) }))
vi.mock('../services/jobs/weeklySummary.js', () => ({ runWeeklySummaryJob: vi.fn().mockResolvedValue({ sent: 0 }) }))
vi.mock('../services/jobs/monthlySummary.js', () => ({ runMonthlySummaryJob: vi.fn().mockResolvedValue({ sent: 0 }) }))

const cronTasks: any[] = []
vi.mock('node-cron', () => ({
  default: {
    schedule: (_schedule: string, _fn: () => void) => {
      const task = { stop: () => { task.stopped = true }, stopped: false }
      cronTasks.push(task)
      return task
    },
  },
}))

describe('Scheduler (Integration 7)', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    cronTasks.length = 0
    process.env = { ...ORIGINAL_ENV }
    delete process.env.REDIS_URL
    mockEnqueueJob.mockReset()
    mockRunDaily.mockReset()
    mockRunOverdue.mockReset()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('starts all four jobs and stops them cleanly', async () => {
    const { startScheduler, stopScheduler, getScheduledJobs } = await import('../services/scheduler')
    startScheduler()
    const jobs = getScheduledJobs()
    expect(jobs).toHaveLength(4)
    expect(jobs.map((j) => j.name)).toEqual(['dailySummary', 'weeklySummary', 'monthlySummary', 'overdueReminders'])
    expect(jobs.every((j) => j.active)).toBe(true)

    stopScheduler()
    expect(getScheduledJobs().every((j) => !j.active)).toBe(true)
  })

  it('ignores duplicate startScheduler calls (no double cron registration)', async () => {
    const { startScheduler } = await import('../services/scheduler')
    startScheduler()
    startScheduler()
    expect(cronTasks).toHaveLength(4)
  })

  describe('queue mode (Redis configured)', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379'
    })

    it('reports queue mode and enqueues with deterministic dedupe jobId', async () => {
      mockEnqueueJob.mockResolvedValue({ success: true, jobId: 'dailySummary-2026-01-01' })
      const { startScheduler, runScheduledJobNow, getSchedulerMode } = await import('../services/scheduler')
      startScheduler()
      expect(getSchedulerMode()).toBe('queue')

      await runScheduledJobNow('dailySummary')
      expect(mockEnqueueJob).toHaveBeenCalledOnce()
      const [queue, jobName, data, opts] = mockEnqueueJob.mock.calls[0]
      expect(queue).toBe('email')
      expect(jobName).toBe('daily-summary')
      expect(data).toEqual({ type: 'daily-summary' })
      expect(opts.jobId).toMatch(/^dailySummary-\d{4}-\d{2}-\d{2}$/)
    })

    it('never executes the job locally in queue mode', async () => {
      mockEnqueueJob.mockResolvedValue({ success: true, jobId: 'x' })
      const { runScheduledJobNow } = await import('../services/scheduler')
      await runScheduledJobNow('dailySummary')
      expect(mockRunDaily).not.toHaveBeenCalled()
    })

    it('routes overdueReminders to the messaging queue', async () => {
      mockEnqueueJob.mockResolvedValue({ success: true, jobId: 'x' })
      const { runScheduledJobNow } = await import('../services/scheduler')
      await runScheduledJobNow('overdueReminders')
      expect(mockEnqueueJob.mock.calls[0][0]).toBe('messaging')
      expect(mockEnqueueJob.mock.calls[0][1]).toBe('overdue-reminders')
    })
  })

  describe('local fallback mode (Redis unconfigured)', () => {
    it('reports local mode and executes in-process', async () => {
      const { startScheduler, runScheduledJobNow, getSchedulerMode, resetSchedulerForTests } = await import('../services/scheduler')
      startScheduler()
      expect(getSchedulerMode()).toBe('local')

      mockRunDaily.mockResolvedValue({ sent: 1, failed: 0, skipped: 0 })
      await runScheduledJobNow('dailySummary')
      expect(mockRunDaily).toHaveBeenCalledOnce()
      expect(mockEnqueueJob).not.toHaveBeenCalled()
      resetSchedulerForTests()
    })

    it('does not execute the same scheduled job twice in one day', async () => {
      const { runScheduledJobNow, resetSchedulerForTests } = await import('../services/scheduler')
      mockRunOverdue.mockResolvedValue({ businessesProcessed: 0, totalSent: 0, totalSkipped: 0, totalFailed: 0 })

      await runScheduledJobNow('overdueReminders')
      await runScheduledJobNow('overdueReminders')
      await runScheduledJobNow('overdueReminders')

      expect(mockRunOverdue).toHaveBeenCalledOnce()
      resetSchedulerForTests()
    })

    it('duplicate guard is per-job, not global', async () => {
      const { runScheduledJobNow, resetSchedulerForTests } = await import('../services/scheduler')
      mockRunDaily.mockResolvedValue({ sent: 0, failed: 0, skipped: 0 })
      mockRunOverdue.mockResolvedValue({ businessesProcessed: 0, totalSent: 0, totalSkipped: 0, totalFailed: 0 })

      await runScheduledJobNow('dailySummary')
      await runScheduledJobNow('dailySummary')
      await runScheduledJobNow('overdueReminders')

      expect(mockRunDaily).toHaveBeenCalledOnce()
      expect(mockRunOverdue).toHaveBeenCalledOnce()
      resetSchedulerForTests()
    })
  })
})
