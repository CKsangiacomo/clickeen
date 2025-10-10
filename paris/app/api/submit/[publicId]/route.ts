import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServiceClient } from '@paris/lib/supabaseAdmin';
import { loadInstance } from '@paris/lib/instances';
import { assertInstanceAccess } from '@paris/lib/access';
import { AuthError } from '@paris/lib/auth';
import { TokenError } from '@paris/lib/instances';
import { rateLimitSubmissions, setRateHeaders } from '@paris/lib/rate-limit';

export const runtime = 'nodejs';

class ValidationError extends Error {
  constructor(message: string, public readonly path: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function parsePayload(raw: string) {
  if (!raw) throw new ValidationError('body must not be empty', 'body');
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new ValidationError('invalid JSON payload', 'body');
  }
}

function computeHash(payload: unknown) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(payload));
  return hash.digest('hex');
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (!forwarded) return undefined;
  return forwarded.split(',')[0]?.trim();
}

export async function POST(req: Request, { params }: { params: { publicId: string } }) {
  try {
    const publicId = params.publicId;
    const rawBody = await req.text();
    const payload = parsePayload(rawBody);

    const client = getServiceClient();
    const instance = await loadInstance(client, publicId);
    if (!instance) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    try {
      await assertInstanceAccess(req, client, instance);
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

    const payloadHash = computeHash(payload);
    const ip = getClientIp(req);
    const ipHash = ip
      ? createHash('sha256')
          .update(String(process.env.RATE_LIMIT_IP_SALT || 'v1'))
          .update(ip)
          .digest('hex')
      : undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    // Rate limiting (per IP + per instance)
  const rl = await rateLimitSubmissions(client, publicId, ip);
    if (rl.limited) {
      const headers = new Headers();
      setRateHeaders(headers, rl);
      headers.set('Retry-After', '60');
      headers.set('X-RateLimit-Backend', rl.backend);
      return new NextResponse(JSON.stringify({ error: 'RATE_LIMITED' }), { status: 429, headers });
    }

    // Store hashed IP (privacy). Write the deterministic hash into the ip column.
    const insert = await client
      .from('widget_submissions')
      .insert({
        widget_id: instance.widgetId,
        widget_instance_id: instance.publicId,
        payload,
        payload_hash: payloadHash,
        ip: ipHash ?? null,
        ua: userAgent,
      })
      .select('id')
      .single();

    if (insert.error) {
      if (/duplicate key|unique constraint|23505/i.test(insert.error.message)) {
        return NextResponse.json({ status: 'accepted', deduped: true }, { status: 202 });
      }
      if (/value too long|payload size/i.test(insert.error.message)) {
        return NextResponse.json([{ path: 'payload', message: 'payload exceeds maximum size' }], { status: 422 });
      }
      return NextResponse.json({ error: 'DB_ERROR', details: insert.error.message }, { status: 500 });
    }

    const headers = new Headers();
    setRateHeaders(headers, rl);
    headers.set('X-RateLimit-Backend', rl.backend);
    return new NextResponse(JSON.stringify({ status: 'accepted', deduped: false }), { status: 202, headers });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json([{ path: err.path, message: err.message }], { status: 422 });
    }
    return NextResponse.json({ error: 'SERVER_ERROR', details: (err as Error).message ?? String(err) }, { status: 500 });
  }
}
