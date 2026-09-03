import { Redis } from 'ioredis'
import { createChildLogger } from './logger.js'

const log = createChildLogger({ module: 'redis' })

let redisClient: Redis | null = null

export function getRedisUrl(): string | undefined {
  return process.env.REDIS_URL
}

export function isRedisConfigured(): boolean {
  return Boolean(getRedisUrl())
}

export function getRedisClient(): Redis | null {
  const url = getRedisUrl()
  if (!url) {
    return null
  }

  if (!redisClient) {
    try {
      redisClient = new Redis(url, {
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: true,
        connectTimeout: 5000,
        lazyConnect: true,
        retryStrategy(times) {
          if (times > 10) {
            log.warn({ times }, 'Redis connection retry threshold reached')
            return null // Stop retrying after 10 attempts
          }
          return Math.min(times * 200, 2000)
        },
      })

      redisClient.on('connect', () => {
        log.info('Connected to Redis')
      })

      redisClient.on('ready', () => {
        log.info('Redis connection ready')
      })

      redisClient.on('error', (err) => {
        log.warn({ err: err.message }, 'Redis connection error')
      })

      redisClient.on('end', () => {
        log.info('Redis connection closed')
      })
    } catch (err) {
      log.error({ err }, 'Failed to initialize Redis client')
      return null
    }
  }

  return redisClient
}

export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false

  try {
    if (client.status === 'ready' || client.status === 'connect') {
      await client.ping()
      return true
    }
    await client.connect()
    await client.ping()
    return true
  } catch (err) {
    log.warn({ err }, 'Redis ping health check failed')
    return false
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit()
    } catch {
      redisClient.disconnect()
    } finally {
      redisClient = null
      log.info('Redis client shut down cleanly')
    }
  }
}
