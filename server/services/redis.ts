import { Redis } from 'ioredis';

let redis: Redis | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

export function getRedisUrl(): string {
  if (!isRedisConfigured()) {
    return '';
  }
  return process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:6379`;
}

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 10) {
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });
  }
  return redis;
}

export async function isRedisAvailable(): Promise<boolean> {
  if (!isRedisConfigured() || !redis) {
    return false;
  }
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export default getRedisClient;