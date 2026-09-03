import pino from 'pino';

// pino-pretty's worker transport cannot resolve its target inside vitest's
// worker processes, so we only use it in normal dev (not tests, not prod).
const usePrettyTransport = process.env.NODE_ENV !== 'production' && process.env.VITEST !== 'true';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { pid: process.pid },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: usePrettyTransport
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export function createChildLogger(options: Record<string, any>): pino.Logger {
  return logger.child(options);
}

export { logger };

export default logger;