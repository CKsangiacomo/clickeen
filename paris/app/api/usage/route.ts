import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getServiceClient } from '@paris/lib/supabaseAdmin';
import { loadInstance } from '@paris/lib/instances';
import { assertInstanceAccess } from '@paris/lib/access';
import { AuthError } from '@paris/lib/auth';
import { TokenError } from '@paris/lib/instances';
import { rateLimitUsage, setRateHeaders } from '@paris/lib/rate-limit';

export const runtime = 'nodejs';

interface UsagePayload {
  publicId?: string;
  event?: string;
  timestamp?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

const ALLOWED_EVENTS = new Set(['load', 'view', 'interact', 'submit', 'success', 'error']);

class ValidationError extends Error {
  constructor(message: string, public readonly path: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function parseBody(raw: string): UsagePayload {
  if (!raw) throw new ValidationError('body must not be empty', 'body');
  try {
    return JSON.parse(raw) as UsagePayload;
  } catch {
    throw new ValidationError('invalid JSON payload', 'body');
  }
}

function assertString(value: unknown, path: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${path} is required`, path);
  }
  return value.trim();
}

function sanitizeMetadata(metadata: unknown) {
  if (metadata === undefined) return {};
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new ValidationError('metadata must be an object', 'metadata');
  }
  return metadata as Record<string, unknown>;
}

export async function POST(req: Request) {
  try {
    const payload = parseBody(await req.text());
    const publicId = assertString(payload.publicId, 'publicId');
    const event = assertString(payload.event, 'event');
    if (!ALLOWED_EVENTS.has(event)) {
      throw new ValidationError(`event must be one of ${Array.from(ALLOWED_EVENTS).join(', ')}`, 'event');
    }
    const idempotencyKey = assertString(payload.idempotencyKey, 'idempotencyKey');
    const metadata = sanitizeMetadata(payload.metadata);

    const supabase = getServiceClient();
    const instance = await loadInstance(supabase, publicId);
    if (!instance) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    try {
      await assertInstanceAccess(req, supabase, instance);
    } catch (err) {
      if (err instanceof TokenError) {
        const status = err.code === 'TOKEN_REVOKED' ? 410 : 401;
        return NextResponse.json({ error: err.code }, { status });
      }
      if (err instanceof AuthError) {
        const status = err.code === 'AUTH_REQUIRED' ? 401 : 403;
        return NextResponse.json({ error: err.code }, { status });
      }
      throw err;
    }

    const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      throw new ValidationError('timestamp must be ISO-8601 string', 'timestamp');
    }

    // Rate limit per IP
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || undefined;
    const rl = await rateLimitUsage(supabase, publicId, ip);
    if (rl.limited) {
      const headers = new Headers();
      setRateHeaders(headers, rl);
      headers.set('Retry-After', '60');
      headers.set('X-RateLimit-Backend', rl.backend);
      return new Response(JSON.stringify({ error: 'RATE_LIMITED' }), { status: 429, headers });
    }

    // Privacy: never store raw IP. For SQL fallback rate limiting, include a
    // deterministic hash in metadata when available.
    const ipHash = ip ? createHash('sha256').update(String(process.env.RATE_LIMIT_IP_SALT || 'v1')).update(ip).digest('hex') : undefined;

    const insert = await supabase
      .from('usage_events')
      .insert({
        workspace_id: instance.workspaceId,
        event_type: event,
        widget_instance_id: publicId,
        metadata: ipHash ? { ...metadata, ipHash } : metadata,
        idempotency_hash: idempotencyKey,
        created_at: timestamp.toISOString(),
      })
      .select('id')
      .single();

    if (insert.error) {
      if (/duplicate key|unique constraint|23505/i.test(insert.error.message)) {
        return NextResponse.json({ recorded: false }, { status: 202 });
      }
      return NextResponse.json({ error: 'DB_ERROR', details: insert.error.message }, { status: 500 });
    }

    const headers = new Headers();
    setRateHeaders(headers, rl);
    headers.set('X-RateLimit-Backend', rl.backend);
    return new Response(JSON.stringify({ recorded: true }), { status: 202, headers });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json([{ path: err.path, message: err.message }], { status: 422 });
    }
    return NextResponse.json({ error: 'SERVER_ERROR', details: (err as Error).message ?? String(err) }, { status: 500 });
  }
}
