import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/logger.js', () => ({
  createChildLogger: () => ({ info: () => { }, warn: () => { }, error: () => { }, debug: () => { } }),
  logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } },
}))

// Minimal in-memory BullMQ Queue mock
const mockQueueInstances: any[] = []
vi.mock('bullmq', () => {
  return {
    Queue: class {
      name: string
      opts: any
      added: { jobName: string; data: unknown; opts: unknown }[] = []
      constructor(name: string, opts: any) {
        this.name = name
        this.opts = opts
        mockQueueInstances.push(this)
      }
      async add(jobName: string, data: unknown, opts?: unknown) {
        this.added.push({ jobName, data, opts })
        return { id: `job-${this.added.length}` }
      }
      async getJobCounts() {
        return { waiting: 2, active: 1, completed: 10, failed: 3 }
      }
      async close() { }
      on() { }
    },
  }
})

describe('Redis + queues (Integration 7)', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    mockQueueInstances.length = 0
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.REDIS_URL
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  describe('Redis unavailable / unconfigured', () => {
    it('reports Redis as not configured without REDIS_URL', async () => {
      const { isRedisConfigured } = await import('../services/redis.js')
      expect(isRedisConfigured()).toBe(false)
    })

    it('getQueue returns null and app does not crash', async () => {
      const { getQueue } = await import('../queues/index.js')
      expect(getQueue('email')).toBeNull()
    })

    it('enqueueJob returns controlled failure without throwing', async () => {
      const { enqueueJob } = await import('../queues/index.js')
      const result = await enqueueJob('email', 'send-email', { type: 'send-email' })
      expect(result.success).toBe(false)
      expect(result.jobId).toBeUndefined()
    })

    it('getQueueMetrics returns zeroed metrics when unconfigured', async () => {
      const { getQueueMetrics } = await import('../queues/index.js')
      const metrics = await getQueueMetrics()
      expect(Object.keys(metrics).sort()).toEqual(['email', 'messaging', 'sync'])
      for (const m of Object.values(metrics)) {
        expect(m).toEqual({ waiting: 0, active: 0, completed: 0, failed: 0 })
      }
    })

    it('exposes only safe operational metrics (no payloads)', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'
      const { getQueueMetrics } = await import('../queues/index.js')
      const metrics = await getQueueMetrics()
      const serialized = JSON.stringify(metrics)
      expect(serialized).not.toContain('html')
      expect(serialized).not.toContain('body')
      expect(Object.keys(Object.values(metrics)[0])).toEqual(['waiting', 'active', 'completed', 'failed'])
    })
  })

  describe('Redis configured', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379'
    })

    it('reports Redis as configured', async () => {
      const { isRedisConfigured } = await import('../services/redis.js')
      expect(isRedisConfigured()).toBe(true)
    })

    it('creates each queue exactly once (no duplicate initialization)', async () => {
      const { getQueue } = await import('../queues/index.js')
      const a = getQueue('email')
      const b = getQueue('email')
      expect(a).not.toBeNull()
      expect(a).toBe(b)
      expect(mockQueueInstances.filter((q) => q.name === 'email')).toHaveLength(1)

      getQueue('messaging')
      getQueue('sync')
      expect(mockQueueInstances).toHaveLength(3)
    })

    it('applies retry/backoff and retention defaults', async () => {
      const { getQueue } = await import('../queues/index.js')
      const queue = getQueue('messaging')!
      const djo = queue.opts.defaultJobOptions as Record<string, any>
      expect(djo.attempts).toBe(3)
      expect(djo.backoff.type).toBe('exponential')
      expect(djo.removeOnComplete).toBe(100)
      expect(djo.removeOnFail).toBe(500)
    })

    it('enqueues successfully and returns jobId', async () => {
      const { enqueueJob } = await import('../queues/index.js')
      const result = await enqueueJob('sync', 'sync-apply', { businessId: 'b1', action: { table: 'sales', recordId: 'r1' } })
      expect(result.success).toBe(true)
      expect(result.jobId).toBe('job-1')
    })

    it('enqueued jobs carry deterministic jobId for scheduler dedupe', async () => {
      const { enqueueJob } = await import('../queues/index.js')
      await enqueueJob('email', 'daily-summary', { type: 'daily-summary' }, { jobId: 'dailySummary-2026-01-01' })
      const q = mockQueueInstances.find((x) => x.name === 'email')
      expect(q.added[0].opts.jobId).toBe('dailySummary-2026-01-01')
    })

    it('rejects non-serializable payloads with controlled failure', async () => {
      const { enqueueJob } = await import('../queues/index.js')
      const circular: Record<string, unknown> = {}
      circular['self'] = circular
      const result = await enqueueJob('email', 'send-email', circular)
      expect(result.success).toBe(false)
    })

    it('rejects oversized payloads (bounded job size)', async () => {
      const { enqueueJob } = await import('../queues/index.js')
      const huge = { html: 'x'.repeat(300 * 1024) }
      const result = await enqueueJob('email', 'send-email', huge)
      expect(result.success).toBe(false)
      const q = mockQueueInstances.find((x) => x.name === 'email')
      expect(q.added).toHaveLength(0)
    })
  })
})
