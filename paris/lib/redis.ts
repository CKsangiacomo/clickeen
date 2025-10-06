import { createClient, type RedisClientType } from 'redis';

let client: RedisClientType | null = null;

export function getRedisClient(): RedisClientType | null {
  const url = process.env.RATE_LIMIT_REDIS_URL;
  if (!url) return null;
  if (client) return client;
  client = createClient({ url });
  client.on('error', (err) => {
    console.warn('[rate-limit] redis client error:', err?.message || String(err));
  });
  // Lazy connect; the first command will trigger connection
  return client;
}

export function getRedisPrefix(): string {
  return process.env.RATE_LIMIT_REDIS_PREFIX || 'ck:rl:';
}

