import cron from 'node-cron'
import { createChildLogger } from './logger.js'
import { isRedisConfigured } from './redis.js'
import { enqueueJob } from '../queues/index'

const log = createChildLogger({ module: 'scheduler' })

interface ScheduledJob {
  name: 'dailySummary' | 'weeklySummary' | 'monthlySummary' | 'overdueReminders'
  schedule: string
  queue: 'email' | 'messaging'
  jobType: string
  cronTask: ReturnType<typeof cron.schedule> | null
}

const scheduledJobs: ScheduledJob[] = [
  { name: 'dailySummary', schedule: '0 9 * * *', queue: 'email', jobType: 'daily-summary', cronTask: null },
  { name: 'weeklySummary', schedule: '0 9 * * 1', queue: 'email', jobType: 'weekly-summary', cronTask: null },
  { name: 'monthlySummary', schedule: '0 9 1 * *', queue: 'email', jobType: 'monthly-summary', cronTask: null },
  { name: 'overdueReminders', schedule: '0 10 * * *', queue: 'messaging', jobType: 'overdue-reminders', cronTask: null },
]

let running = false

/**
 * Execution mode:
 * - 'queue': Redis configured — scheduled jobs are enqueued into BullMQ and
 *   executed exactly once by the workers (deterministic daily jobId dedupes
 *   across restarts and multiple app instances).
 * - 'local': Redis unavailable — cron runs the job directly in this process,
 *   with an in-memory last-run guard so a job never executes twice in the
 *   same day even if cron fires again (restart / overlap).
 */
export type SchedulerMode = 'queue' | 'local'

export function getSchedulerMode(): SchedulerMode {
  return isRedisConfigured() ? 'queue' : 'local'
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0]
}

// Local-fallback duplicate guard: one execution per job per calendar day.
const lastLocalRunDate = new Map<string, string>()

export async function runScheduledJobNow(name: ScheduledJob['name']): Promise<void> {
  const job = scheduledJobs.find((j) => j.name === name)
  if (!job) return

  // Queue mode: deterministic jobId (name + date) makes the enqueue idempotent —
  // BullMQ ignores duplicates, so the job executes exactly once per day no
  // matter how many times this fires (restarts, multi-instance deployments).
  const jobId = `${job.name}-${todayKey()}`

  if (getSchedulerMode() === 'queue') {
    const result = await enqueueJob(job.queue, job.jobType, { type: job.jobType }, { jobId })
    if (result.success) {
      log.info({ job: job.name, mode: 'queue', jobId: result.jobId }, 'Scheduled job enqueued to BullMQ')
    } else {
      log.warn({ job: job.name, mode: 'queue' }, 'Failed to enqueue scheduled job (Redis may be unreachable)')
    }
    return
  }

  // Local fallback — guard against duplicate execution within the same day.
  const lastRun = lastLocalRunDate.get(job.name)
  if (lastRun === todayKey()) {
    log.warn({ job: job.name, mode: 'local' }, 'Scheduled job already ran today — skipping duplicate execution')
    return
  }
  lastLocalRunDate.set(job.name, todayKey())

  log.info({ job: job.name, mode: 'local' }, 'Redis unavailable — executing scheduled job locally')
  const { runDailySummaryJob } = await import('./jobs/dailySummary.js')
  const { runWeeklySummaryJob } = await import('./jobs/weeklySummary.js')
  const { runMonthlySummaryJob } = await import('./jobs/monthlySummary.js')
  const { runOverdueReminderJob } = await import('./jobs/overdueReminders.js')

  const runners: Record<ScheduledJob['name'], () => Promise<unknown>> = {
    dailySummary: runDailySummaryJob,
    weeklySummary: runWeeklySummaryJob,
    monthlySummary: runMonthlySummaryJob,
    overdueReminders: runOverdueReminderJob,
  }

  await runners[job.name]()
}

export function startScheduler(): void {
  if (running) {
    log.warn('startScheduler called while scheduler already running — ignoring duplicate call')
    return
  }

  const mode = getSchedulerMode()

  for (const job of scheduledJobs) {
    job.cronTask = cron.schedule(job.schedule, () => {
      runScheduledJobNow(job.name).catch((err) => {
        log.error({ err, job: job.name }, 'Scheduled job execution failed')
      })
    }, { timezone: 'Asia/Karachi' })
  }

  running = true
  log.info(
    { mode, jobs: scheduledJobs.map((j) => `${j.name}@${j.schedule}`) },
    mode === 'queue'
      ? 'Scheduler started in BullMQ mode — jobs are enqueued (deduped by daily jobId)'
      : 'Scheduler started in LOCAL fallback mode (Redis unconfigured) — jobs execute in-process with daily duplicate guard'
  )
}

export function stopScheduler(): void {
  for (const job of scheduledJobs) {
    job.cronTask?.stop()
    job.cronTask = null
  }
  running = false
  log.info('Scheduler stopped')
}

export function getScheduledJobs(): { name: string; schedule: string; active: boolean; mode: SchedulerMode }[] {
  const mode = getSchedulerMode()
  return scheduledJobs.map((j) => ({
    name: j.name,
    schedule: j.schedule,
    active: running,
    mode,
  }))
}

/** Test helper: reset local-fallback guard state. */
export function resetSchedulerForTests(): void {
  lastLocalRunDate.clear()
  for (const job of scheduledJobs) {
    job.cronTask?.stop()
    job.cronTask = null
  }
  running = false
}
