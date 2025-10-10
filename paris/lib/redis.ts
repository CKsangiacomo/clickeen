// Optional Redis client loader with soft dependency to avoid build-time failures
// when the `redis` package is not installed. SQL fallback will be used instead.
// This keeps Phase-1 builds green and still allows Redis-backed rate limiting
// when the dependency and URL are provided in production.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RedisClientType = any;

let client: RedisClientType | null = null;

export function getRedisClient(): RedisClientType | null {
  const url = process.env.RATE_LIMIT_REDIS_URL;
  if (!url) return null;
  if (client) return client;
  try {
    // Use createRequire to avoid static bundler resolution
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRequire } = require('module');
    const requireFn = createRequire(__filename);
    const modName = 'redis';
    const redis = requireFn(modName);
    client = redis.createClient({ url });
    client.on('error', (err: unknown) => {
      console.warn('[rate-limit] redis client error:', (err as Error)?.message || String(err));
    });
    try {
      if (typeof client.connect === 'function' && !client.isOpen) {
        // Fire-and-forget connect; breaker will degrade to SQL if unavailable.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        client.connect();
      }
    } catch {
      // ignore; breaker path will handle degradation
    }
    return client;
  } catch {
    console.warn('[rate-limit] redis module not available; degrading to SQL');
    return null;
  }
}

export function getRedisPrefix(): string {
  return process.env.RATE_LIMIT_REDIS_PREFIX || 'ck:rl:';
}
