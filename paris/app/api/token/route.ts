import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServiceClient } from '@paris/lib/supabaseAdmin';
import { assertWorkspaceMember, AuthError, requireUser } from '@paris/lib/auth';
import { loadInstance } from '@paris/lib/instances';

export const runtime = 'nodejs';

interface TokenPayload {
  publicId?: string;
  action?: 'issue' | 'revoke' | 'list';
  token?: string;
  expiresAt?: string;
}

class ValidationError extends Error {
  constructor(message: string, public readonly path: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function parseBody(raw: string): TokenPayload {
  if (!raw) throw new ValidationError('body must not be empty', 'body');
  try {
    return JSON.parse(raw) as TokenPayload;
  } catch {
    throw new ValidationError('invalid JSON payload', 'body');
  }
}

function assertPublicId(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError('publicId is required', 'publicId');
  }
  return value.trim();
}

function assertToken(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError('token is required', 'token');
  }
  return value.trim();
}

function generateToken() {
  return `cket_${randomBytes(16).toString('hex')}`;
}

function resolveExpiry(expiresAt?: string) {
  if (!expiresAt) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  const timestamp = Date.parse(expiresAt);
  if (Number.isNaN(timestamp)) {
    throw new ValidationError('expiresAt must be an ISO timestamp', 'expiresAt');
  }
  return new Date(timestamp).toISOString();
}

export async function POST(req: Request) {
  try {
    const { client, user } = await requireUser(req);
    const payload = parseBody(await req.text());
    const action = payload.action ?? 'issue';
    const publicId = assertPublicId(payload.publicId);

    const instance = await loadInstance(client, publicId);
    if (!instance) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    await assertWorkspaceMember(client, instance.workspaceId, user.id);

    switch (action) {
      case 'issue': {
        const expiresAt = resolveExpiry(payload.expiresAt);
        const token = generateToken();
        const insert = await client
          .from('embed_tokens')
          .insert({
            widget_instance_id: instance.id,
            token,
            expires_at: expiresAt,
            created_by: user.id,
          })
          .select('token, expires_at, revoked_at')
          .single();

        if (insert.error) {
          return NextResponse.json({ error: 'DB_ERROR', details: insert.error.message }, { status: 500 });
        }

        return NextResponse.json({ token: insert.data.token, publicId: publicId, expiresAt: insert.data.expires_at }, { status: 201 });
      }
      case 'revoke': {
        const token = assertToken(payload.token);
        const { error, data } = await client
          .from('embed_tokens')
          .update({ revoked_at: new Date().toISOString() })
          .eq('widget_instance_id', instance.id)
          .eq('token', token)
          .is('revoked_at', null)
          .select('token')
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 });
        }
        if (!data) {
          return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
        }
        return NextResponse.json(null, { status: 204 });
      }
      case 'list': {
        const { data, error } = await client
          .from('embed_tokens')
          .select('token, expires_at, revoked_at, created_at')
          .eq('widget_instance_id', instance.id)
          .order('created_at', { ascending: false });

        if (error) {
          return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ tokens: data }, { status: 200 });
      }
      default:
        throw new ValidationError('action must be issue|revoke|list', 'action');
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json([{ path: err.path, message: err.message }], { status: 422 });
    }
    if (err instanceof AuthError) {
      const status = err.code === 'AUTH_REQUIRED' ? 401 : 403;
      return NextResponse.json({ error: err.code }, { status });
    }
    return NextResponse.json({ error: 'SERVER_ERROR', details: (err as Error).message ?? String(err) }, { status: 500 });
  }
}
