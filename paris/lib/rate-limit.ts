import type { AdminClient } from '@paris/lib/supabaseAdmin';
import { getRedisClient, getRedisPrefix } from '@paris/lib/redis';
import { createHash } from 'node:crypto';
import type { RedisClientType } from '@paris/lib/redis';

export interface RateContext {
  limit: number;
  remaining: number;
  reset: number; // epoch seconds
  limited: boolean;
  backend: 'sql' | 'redis';
}

function windowMeta(windowSeconds: number) {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const reset = Math.floor((windowStart + windowSeconds * 1000) / 1000);
  return { windowStartIso: new Date(windowStart).toISOString(), reset };
}

export async function rateLimitSubmissions(
  client: AdminClient,
  publicId: string,
  ip: string | undefined,
): Promise<RateContext> {
  // Try Redis path first
  const redis = getRedisClient();
  const redisResult = await tryRedisLimitSubmissions(redis, publicId, ip);
  if (redisResult) return redisResult;

  const perIpLimit = 60;
  const perInstanceLimit = 120;
  const windowSeconds = 60;
  const { windowStartIso, reset } = windowMeta(windowSeconds);

  // Count per IP
  let ipCount = 0;
  if (ip) {
    const ipHash = createHash('sha256')
      .update(String(process.env.RATE_LIMIT_IP_SALT || 'v1'))
      .update(ip)
      .digest('hex');
    const { count, error } = await client
      .from('widget_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('widget_instance_id', publicId)
      .eq('ip', ipHash)
      .gte('created_at', windowStartIso);
    if (!error) ipCount = count ?? 0;
  }

  const { count: instCount, error: instErr } = await client
    .from('widget_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('widget_instance_id', publicId)
    .gte('created_at', windowStartIso);
  const instanceCount = instErr ? 0 : instCount ?? 0;

  const limit = perIpLimit; // expose stricter limit to caller
  const limited = (ip && ipCount >= perIpLimit) || instanceCount >= perInstanceLimit;
  const remaining = Math.max(0, perIpLimit - ipCount);
  return { limit, remaining, reset, limited, backend: 'sql' };
}

export async function rateLimitUsage(
  client: AdminClient,
  publicId: string,
  ip: string | undefined,
): Promise<RateContext> {
  const redis = getRedisClient();
  const redisResult = await tryRedisLimitUsage(redis, publicId, ip);
  if (redisResult) return redisResult;

  const perIpLimit = 600;
  const windowSeconds = 60;
  const { windowStartIso, reset } = windowMeta(windowSeconds);

  // Privacy-safe: use hashed IP when present (metadata.ipHash). If no IP,
  // do not enforce per-IP limit in SQL fallback.
  if (!ip) {
    return { limit: perIpLimit, remaining: perIpLimit, reset, limited: false, backend: 'sql' };
  }

  const ipHash = createHash('sha256').update(String(process.env.RATE_LIMIT_IP_SALT || 'v1')).update(ip).digest('hex');
  const { count, error } = await client
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('widget_instance_id', publicId)
    .gte('created_at', windowStartIso)
    .eq('metadata->>ipHash', ipHash);
  const ipCount = error ? 0 : (count ?? 0);
  const limited = ipCount >= perIpLimit;
  const remaining = Math.max(0, perIpLimit - ipCount);
  return { limit: perIpLimit, remaining, reset, limited, backend: 'sql' };
}

export function setRateHeaders(headers: Headers, ctx: RateContext) {
  headers.set('X-RateLimit-Limit', String(ctx.limit));
  headers.set('X-RateLimit-Remaining', String(ctx.remaining));
  headers.set('X-RateLimit-Reset', String(ctx.reset));
}

// --- Redis backend with basic circuit breaker ---

type BreakerState = {
  open: boolean;
  lastFailureTs: number;
  errorCount: number;
};

const breaker: BreakerState = {
  open: false,
  lastFailureTs: 0,
  errorCount: 0,
};

function breakerConfig() {
  return {
    threshold: Number(process.env.RATE_LIMIT_BREAKER_THRESHOLD || 5),
    windowMs: Number(process.env.RATE_LIMIT_BREAKER_WINDOW_MS || 60000),
    cooldownMs: Number(process.env.RATE_LIMIT_BREAKER_COOLDOWN_MS || 300000),
  };
}

function breakerShouldUseRedis() {
  const { cooldownMs } = breakerConfig();
  if (!breaker.open) return true;
  const since = Date.now() - breaker.lastFailureTs;
  return since > cooldownMs;
}

function breakerRecordFailure() {
  const { threshold, windowMs } = breakerConfig();
  const now = Date.now();
  if (now - breaker.lastFailureTs > windowMs) {
    breaker.errorCount = 0;
  }
  breaker.errorCount += 1;
  breaker.lastFailureTs = now;
  if (breaker.errorCount >= threshold) {
    if (!breaker.open) {
      console.warn('[rate-limit] redis breaker OPEN (degrading to SQL)');
    }
    breaker.open = true;
  }
}

function breakerRecordSuccess() {
  if (breaker.open) {
    console.warn('[rate-limit] redis breaker CLOSED (recovered)');
  }
  breaker.open = false;
  breaker.errorCount = 0;
}

function windowKeyPart(windowSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  return String(windowStart);
}

async function tryRedisLimitSubmissions(redis: RedisClientType | null, publicId: string, ip?: string): Promise<RateContext | null> {
  if (!redis || !breakerShouldUseRedis()) return null;
  const perIpLimit = 60;
  const perInstanceLimit = 120;
  const windowSeconds = 60;
  const reset = Math.floor(Date.now() / 1000) + windowSeconds;
  const prefix = getRedisPrefix();
  const windowPart = windowKeyPart(windowSeconds);
  try {
    const cmds: Array<Promise<any>> = [];
    let ipCount = 0;
    if (ip) {
      const ipHash = createHash('sha256')
        .update(String(process.env.RATE_LIMIT_IP_SALT || 'v1'))
        .update(ip)
        .digest('hex');
      const keyIp = `${prefix}submit:ip:${publicId}:${ipHash}:${windowPart}`;
      const p = redis.multi().incr(keyIp).expire(keyIp, 90).exec();
      const res = await p;
      ipCount = Number((res?.[0] as any)?.[1] || 0);
    }
    const keyInst = `${prefix}submit:inst:${publicId}:${windowPart}`;
    const instRes = await redis.multi().incr(keyInst).expire(keyInst, 90).exec();
    const instCount = Number((instRes?.[0] as any)?.[1] || 0);

    breakerRecordSuccess();

    const limited = (ip && ipCount > perIpLimit) || instCount > perInstanceLimit;
    const remaining = ip ? Math.max(0, perIpLimit - ipCount) : perIpLimit;
    return { limit: perIpLimit, remaining, reset, limited, backend: 'redis' };
  } catch (err) {
    breakerRecordFailure();
    return null;
  }
}

async function tryRedisLimitUsage(redis: RedisClientType | null, publicId: string, ip?: string): Promise<RateContext | null> {
  if (!redis || !breakerShouldUseRedis() || !ip) return null;
  const perIpLimit = 600;
  const windowSeconds = 60;
  const reset = Math.floor(Date.now() / 1000) + windowSeconds;
  const prefix = getRedisPrefix();
  const windowPart = windowKeyPart(windowSeconds);
  try {
    const key = `${prefix}usage:ip:${publicId}:${ip}:${windowPart}`;
    const res = await redis.multi().incr(key).expire(key, 90).exec();
    const count = Number((res?.[0] as any)?.[1] || 0);
    breakerRecordSuccess();
    const limited = count > perIpLimit;
    const remaining = Math.max(0, perIpLimit - count);
    return { limit: perIpLimit, remaining, reset, limited, backend: 'redis' };
  } catch (err) {
    breakerRecordFailure();
    return null;
  }
}
