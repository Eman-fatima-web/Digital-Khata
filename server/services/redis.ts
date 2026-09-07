import { Redis } from 'ioredis';

let redis: Redis | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.REDIS_URL || 
    process.env.REDIS_HOST || 
    process.env.UPSTASH_REDIS_REST_URL
  );
}

export function getRedisUrl(): string {
  // Upstash Redis takes priority if configured
  if (process.env.UPSTASH_REDIS_REST_URL) {
    // Convert Upstash REST URL to Redis URL format
    // https://xxx.upstash.io -> rediss://xxx.upstash.io:6379
    const url = new URL(process.env.UPSTASH_REDIS_REST_URL);
    return `rediss://${url.hostname}:6379`;
  }
  if (!isRedisConfigured()) {
    return '';
  }
  return process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:6379`;
}

export function getRedisPassword(): string | undefined {
  if (process.env.UPSTASH_REDIS_REST_TOKEN) {
    return process.env.UPSTASH_REDIS_REST_TOKEN;
  }
  return undefined;
}

export function getRedisClient(): Redis {
  if (!redis) {
    const url = getRedisUrl();
    const password = getRedisPassword();
    
    redis = new Redis(url, {
      password,
      tls: process.env.UPSTASH_REDIS_REST_URL ? {} : undefined,
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
  if (!isRedisConfigured()) {
    return false;
  }
  if (!redis) {
    try {
      const url = getRedisUrl();
      const password = getRedisPassword();
      redis = new Redis(url, {
        password,
        tls: process.env.UPSTASH_REDIS_REST_URL ? {} : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => {
          if (times > 10) {
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });
    } catch {
      return false;
    }
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