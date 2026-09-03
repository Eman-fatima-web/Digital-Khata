import { Queue, type JobsOptions } from 'bullmq';
import { getRedisUrl } from '../services/redis';
import { createChildLogger } from '../services/logger';

const log = createChildLogger({ module: 'queues' });

export type QueueName = 'email' | 'messaging' | 'sync';

const queues = new Map<QueueName, Queue>();

export function getQueue(queueName: QueueName): Queue | null {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return null;
  }

  if (!queues.has(queueName)) {
    try {
      const queue = new Queue(queueName, {
        connection: {
          url: redisUrl,
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });

      queue.on('error', (err) => {
        log.warn({ queueName, err: err.message }, 'Queue connection error');
      });

      queues.set(queueName, queue);
      log.info({ queueName }, 'BullMQ queue initialized');
    } catch (err) {
      log.error({ queueName, err }, 'Failed to initialize BullMQ queue');
      return null;
    }
  }

  return queues.get(queueName) || null;
}

const MAX_JOB_PAYLOAD_BYTES = 256 * 1024;

export async function enqueueJob(
  queueName: QueueName,
  jobName: string,
  data: Record<string, unknown>,
  opts?: JobsOptions
): Promise<{ success: boolean; jobId?: string }> {
  const queue = getQueue(queueName);
  if (!queue) {
    log.info({ queueName, jobName }, 'Redis/BullMQ queue unconfigured — skipping background queue insertion');
    return { success: false };
  }

  // Reject unbounded payloads before they enter Redis
  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch (err) {
    log.error({ queueName, jobName, err }, 'Job payload is not JSON-serializable — refusing to enqueue');
    return { success: false };
  }
  if (serialized.length > MAX_JOB_PAYLOAD_BYTES) {
    log.warn({ queueName, jobName, sizeBytes: serialized.length }, 'Job payload exceeds maximum allowed size — refusing to enqueue');
    return { success: false };
  }

  try {
    const job = await queue.add(jobName, data, opts);
    log.info({ queueName, jobName, jobId: job.id }, 'Job successfully enqueued');
    return { success: true, jobId: job.id };
  } catch (err) {
    log.error({ queueName, jobName, err }, 'Failed to enqueue job');
    return { success: false };
  }
}

export async function getQueueMetrics(): Promise<Record<string, { waiting: number; active: number; completed: number; failed: number }>> {
  const metrics: Record<string, { waiting: number; active: number; completed: number; failed: number }> = {};
  const names: QueueName[] = ['email', 'messaging', 'sync'];

  for (const name of names) {
    const queue = getQueue(name);
    if (queue) {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
        metrics[name] = {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
        };
      } catch {
        metrics[name] = { waiting: 0, active: 0, completed: 0, failed: 0 };
      }
    } else {
      metrics[name] = { waiting: 0, active: 0, completed: 0, failed: 0 };
    }
  }

  return metrics;
}

export async function closeQueues(): Promise<void> {
  for (const [name, queue] of queues.entries()) {
    try {
      await queue.close();
      log.info({ queueName: name }, 'Queue closed');
    } catch (err) {
      log.error({ queueName: name, err }, 'Error closing queue');
    }
  }
  queues.clear();
}

// Export for backward compatibility
export default {
  getQueue,
  enqueueJob,
  getQueueMetrics,
  closeQueues,
};