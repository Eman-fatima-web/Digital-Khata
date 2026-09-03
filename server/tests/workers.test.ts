import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/logger.js', () => ({
  createChildLogger: () => ({ info: () => { }, warn: () => { }, error: () => { }, debug: () => { } }),
  logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } },
}))

const mockSendMail = vi.fn()
vi.mock('../config/mail.js', () => ({ sendMail: (...args: unknown[]) => mockSendMail(...args) }))

const mockNotificationSend = vi.fn()
vi.mock('../services/messaging/index.js', () => ({
  notificationService: { send: (...args: unknown[]) => mockNotificationSend(...args) },
}))

const mockRunDaily = vi.fn()
const mockRunWeekly = vi.fn()
const mockRunMonthly = vi.fn()
vi.mock('../services/jobs/dailySummary.js', () => ({ runDailySummaryJob: (...a: unknown[]) => mockRunDaily(...a) }))
vi.mock('../services/jobs/weeklySummary.js', () => ({ runWeeklySummaryJob: (...a: unknown[]) => mockRunWeekly(...a) }))
vi.mock('../services/jobs/monthlySummary.js', () => ({ runMonthlySummaryJob: (...a: unknown[]) => mockRunMonthly(...a) }))

const mockRunOverdue = vi.fn()
vi.mock('../services/jobs/overdueReminders.js', () => ({ runOverdueReminderJob: (...a: unknown[]) => mockRunOverdue(...a) }))

const mockApplyAction = vi.fn()
vi.mock('../services/sync/applySyncActions.js', () => ({
  applyAction: (...args: unknown[]) => mockApplyAction(...args),
}))

vi.mock('bullmq', () => {
  const workers: any[] = []
  return {
    Worker: class {
      name: string
      processor: (job: any) => Promise<unknown>
      opts: any
      handlers: Record<string, (...args: unknown[]) => void> = {}
      static instances: any[] = workers
      constructor(name: string, processor: (job: any) => Promise<unknown>, opts: any) {
        this.name = name
        this.processor = processor
        this.opts = opts
        workers.push(this)
      }
      on(event: string, fn: (...args: unknown[]) => void) {
        this.handlers[event] = fn
        return this
      }
      async close() {
        this.closed = true
      }
      closed = false
    },
  }
})

function makeJob(data: unknown) {
  return { id: 'test-job-1', name: 'test', data }
}

describe('Workers (Integration 7)', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.REDIS_URL
    mockSendMail.mockReset()
    mockNotificationSend.mockReset()
    mockRunDaily.mockReset()
    mockRunWeekly.mockReset()
    mockRunMonthly.mockReset()
    mockRunOverdue.mockReset()
    mockApplyAction.mockReset()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  describe('disabled without Redis', () => {
    it('createEmailWorker returns null and never touches BullMQ', async () => {
      const { createEmailWorker } = await import('../workers/emailWorker')
      const { Worker } = await import('bullmq')
      expect(createEmailWorker()).toBeNull()
      expect((Worker as any).instances).toHaveLength(0)
    })

    it('createMessagingWorker returns null', async () => {
      const { createMessagingWorker } = await import('../workers/messagingWorker')
      expect(createMessagingWorker()).toBeNull()
    })

    it('createSyncWorker returns null', async () => {
      const { createSyncWorker } = await import('../workers/syncWorker')
      expect(createSyncWorker()).toBeNull()
    })

    it('startWorkers is a safe no-op with zero workers', async () => {
      const { startWorkers, getWorkerStatus } = await import('../workers/index')
      const result = startWorkers()
      expect(result.started).toBe(false)
      expect(result.workerCount).toBe(0)
      expect(getWorkerStatus().started).toBe(false)
    })
  })

  describe('worker creation with Redis', () => {
    beforeEach(async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'
      const { Worker } = await import('bullmq')
      ;(Worker as any).instances.length = 0
    })

    it('creates email worker with configurable concurrency', async () => {
      const { createEmailWorker } = await import('../workers/emailWorker')
      const worker = createEmailWorker(3)
      expect(worker).not.toBeNull()
      expect(worker!.opts.concurrency).toBe(3)
    })

    it('creates all three workers via central manager, exactly once each', async () => {
      const { startWorkers, getWorkerStatus } = await import('../workers/index')
      const result = startWorkers()
      expect(result.started).toBe(true)
      expect(result.workerCount).toBe(3)
      expect(getWorkerStatus().names.sort()).toEqual(['email', 'messaging', 'sync'])

      // duplicate call must not create more workers
      startWorkers()
      const { Worker } = await import('bullmq')
      expect((Worker as any).instances).toHaveLength(3)
    })

    it('graceful shutdown closes all workers cleanly', async () => {
      const { startWorkers, stopWorkers, getWorkerStatus } = await import('../workers/index')
      startWorkers()
      await stopWorkers()
      expect(getWorkerStatus().started).toBe(false)
      const { Worker } = await import('bullmq')
      expect((Worker as any).instances.every((w: any) => w.closed)).toBe(true)
    })

    it('stopWorkers is a safe no-op when never started', async () => {
      const { stopWorkers } = await import('../workers/index')
      await expect(stopWorkers()).resolves.toBeUndefined()
    })
  })

  describe('email worker routing (existing sendMail service)', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379'
    })

    it('routes send-email jobs through the existing sendMail', async () => {
      mockSendMail.mockResolvedValue(true)
      const { processEmailJob } = await import('../workers/emailWorker')
      const result = await processEmailJob(makeJob({
        type: 'send-email', to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>',
      }) as any)
      expect(mockSendMail).toHaveBeenCalledWith('a@b.com', 'Hi', '<p>Hi</p>')
      expect(result).toEqual({ status: 'sent', to: 'a@b.com', subject: 'Hi' })
    })

    it('returns controlled skipped result when sendMail reports false (no fake success)', async () => {
      mockSendMail.mockResolvedValue(false)
      const { processEmailJob } = await import('../workers/emailWorker')
      const result = await processEmailJob(makeJob({
        type: 'send-email', to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>',
      }) as any)
      expect(result.status).toBe('skipped')
    })

    it('routes daily-summary job to existing daily summary service', async () => {
      mockRunDaily.mockResolvedValue({ sent: 1, failed: 0, skipped: 0 })
      const { processEmailJob } = await import('../workers/emailWorker')
      const result = await processEmailJob(makeJob({ type: 'daily-summary' }) as any)
      expect(mockRunDaily).toHaveBeenCalledOnce()
      expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 })
    })

    it('routes weekly and monthly summary jobs to existing services', async () => {
      const { processEmailJob } = await import('../workers/emailWorker')
      await processEmailJob(makeJob({ type: 'weekly-summary' }) as any)
      await processEmailJob(makeJob({ type: 'monthly-summary' }) as any)
      expect(mockRunWeekly).toHaveBeenCalledOnce()
      expect(mockRunMonthly).toHaveBeenCalledOnce()
    })

    it('fails unknown email job types with a clear error (no silent pretend-success)', async () => {
      const { processEmailJob } = await import('../workers/emailWorker')
      await expect(processEmailJob(makeJob({ type: 'bogus' }) as any)).rejects.toThrow('Unknown email job type')
    })

    it('rejects send-email jobs missing required fields', async () => {
      const { processEmailJob } = await import('../workers/emailWorker')
      await expect(processEmailJob(makeJob({ type: 'send-email', to: 'a@b.com' }) as any)).rejects.toThrow('requires to, subject and html')
    })
  })

  describe('messaging worker routing (existing provider abstraction)', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379'
    })

    it('routes send-message jobs through the existing notificationService', async () => {
      mockNotificationSend.mockResolvedValue({ messageId: 'm1', channel: 'whatsapp', status: 'queued', provider: 'whatsapp', sentAt: new Date().toISOString() })
      const { processMessagingJob } = await import('../workers/messagingWorker')
      const result = await processMessagingJob(makeJob({
        type: 'send-message', channel: 'whatsapp', to: '+923001234567', body: 'Reminder', businessId: 'b1', customerId: 'c1',
      }) as any)
      expect(mockNotificationSend).toHaveBeenCalledOnce()
      expect(result.status).toBe('queued')
      expect(result.provider).toBe('whatsapp')
    })

    it('throws (job retry) when provider reports failed delivery', async () => {
      mockNotificationSend.mockResolvedValue({ messageId: 'm2', channel: 'sms', status: 'failed', provider: 'sms', errorMessage: 'SMS API not configured', sentAt: new Date().toISOString() })
      const { processMessagingJob } = await import('../workers/messagingWorker')
      await expect(processMessagingJob(makeJob({
        type: 'send-message', channel: 'sms', to: '+923001234567', body: 'Hi', businessId: 'b1',
      }) as any)).rejects.toThrow('SMS API not configured')
    })

    it('routes overdue-reminders job to existing reminder job service', async () => {
      mockRunOverdue.mockResolvedValue({ businessesProcessed: 1, totalSent: 1, totalSkipped: 0, totalFailed: 0 })
      const { processMessagingJob } = await import('../workers/messagingWorker')
      const result = await processMessagingJob(makeJob({ type: 'overdue-reminders' }) as any)
      expect(mockRunOverdue).toHaveBeenCalledOnce()
      expect(result.totalSent).toBe(1)
    })

    it('rejects invalid channels', async () => {
      const { processMessagingJob } = await import('../workers/messagingWorker')
      await expect(processMessagingJob(makeJob({ type: 'send-message', channel: 'fax' }) as any)).rejects.toThrow('Invalid or missing channel')
    })

    it('rejects messages with unbounded body size', async () => {
      const { processMessagingJob } = await import('../workers/messagingWorker')
      await expect(processMessagingJob(makeJob({
        type: 'send-message', channel: 'sms', to: '+923001234567', body: 'x'.repeat(10_000), businessId: 'b1',
      }) as any)).rejects.toThrow('exceeds maximum allowed size')
      expect(mockNotificationSend).not.toHaveBeenCalled()
    })
  })

  describe('sync worker (preserves applyAction safety rules)', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379'
    })

    it('delegates to the shared applyAction with tenant context', async () => {
      mockApplyAction.mockResolvedValue(null)
      const { processSyncJob } = await import('../workers/syncWorker')
      const action = { id: 'a1', table: 'sales', recordId: 'r1', operation: 'create' as const, payload: { version: 1 }, createdAt: new Date().toISOString(), attempts: 0 }
      const result = await processSyncJob(makeJob({ businessId: 'biz-1', action }) as any)
      expect(mockApplyAction).toHaveBeenCalledWith('biz-1', action)
      expect(result.status).toBe('applied')
    })

    it('refuses to apply sync actions without tenant isolation context', async () => {
      const { processSyncJob } = await import('../workers/syncWorker')
      await expect(processSyncJob(makeJob({ action: { table: 'sales', recordId: 'r1' } }) as any)).rejects.toThrow('missing businessId')
      expect(mockApplyAction).not.toHaveBeenCalled()
    })

    it('reports conflicts without swallowing them', async () => {
      mockApplyAction.mockResolvedValue({ table: 'sales', recordId: 'r1', local: {}, remote: {} })
      const { processSyncJob } = await import('../workers/syncWorker')
      const result = await processSyncJob(makeJob({
        businessId: 'biz-1',
        action: { id: 'a1', table: 'sales', recordId: 'r1', operation: 'update', payload: { version: 1 }, createdAt: '', attempts: 0 },
      }) as any)
      expect(result.status).toBe('conflict')
    })

    it('rejects oversized sync payloads', async () => {
      const { processSyncJob } = await import('../workers/syncWorker')
      const bigAction = { id: 'a1', table: 'sales', recordId: 'r1', operation: 'create', payload: { blob: 'x'.repeat(200_000) }, createdAt: '', attempts: 0 }
      await expect(processSyncJob(makeJob({ businessId: 'b1', action: bigAction }) as any)).rejects.toThrow('exceeds maximum allowed size')
    })

    it('creates sync worker with lower default concurrency (safety)', async () => {
      const { createSyncWorker } = await import('../workers/syncWorker')
      const worker = createSyncWorker()
      expect(worker).not.toBeNull()
      expect(worker!.opts.concurrency).toBe(2)
    })
  })
})
