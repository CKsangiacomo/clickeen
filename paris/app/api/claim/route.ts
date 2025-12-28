import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getServiceClient } from '@paris/lib/supabaseAdmin';
import { assertWorkspaceMember, AuthError, requireUser, resolveWorkspaceId } from '@paris/lib/auth';
import { loadInstanceByDraftToken, shapeInstanceResponse, loadInstance, computeBranding } from '@paris/lib/instances';

export const runtime = 'nodejs';

interface ClaimPayload {
  draftToken?: string;
  workspaceId?: string;
}

class ValidationError extends Error {
  constructor(message: string, public readonly path: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function parseBody(raw: string): ClaimPayload {
  if (!raw) throw new ValidationError('body must not be empty', 'body');
  try {
    return JSON.parse(raw) as ClaimPayload;
  } catch {
    throw new ValidationError('invalid JSON payload', 'body');
  }
}

function requireDraftToken(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError('draftToken is required', 'draftToken');
  }
  return value.trim();
}

function generateToken() {
  return `cket_${randomBytes(16).toString('hex')}`;
}

export async function POST(req: Request) {
  try {
    const { client, user } = await requireUser(req);
    const payload = parseBody(await req.text());
    const draftToken = requireDraftToken(payload.draftToken);

    const claimed = await loadInstanceByDraftToken(client, draftToken);
    if (!claimed) {
      return NextResponse.json({ error: 'TOKEN_REVOKED' }, { status: 410 });
    }

    const requestedWorkspace = payload.workspaceId ?? resolveWorkspaceId(req, user);
    if (!requestedWorkspace) {
      throw new ValidationError('workspaceId is required', 'workspaceId');
    }

    if (requestedWorkspace !== claimed.workspaceId) {
      throw new AuthError('FORBIDDEN');
    }

    await assertWorkspaceMember(client, claimed.workspaceId, user.id);

    const update = await client
      .from('widget_instances')
      .update({
        draft_token: null,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', claimed.id)
      .select('public_id,status,config,updated_at')
      .single();

    if (update.error) {
      return NextResponse.json({ error: 'DB_ERROR', details: update.error.message }, { status: 500 });
    }

    const embedToken = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const insert = await client
    .from('embed_tokens')
    .insert({
        widget_instance_id: claimed.id,
        token: embedToken,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select('token, expires_at')
      .single();

    if (insert.error) {
      return NextResponse.json({ error: 'DB_ERROR', details: insert.error.message }, { status: 500 });
    }

    const refreshed = await loadInstance(client, claimed.publicId);
    if (!refreshed) {
      return NextResponse.json({ error: 'SERVER_ERROR', details: 'Instance reclaimed but could not be loaded' }, { status: 500 });
    }
    const branding = await computeBranding(client, refreshed.workspaceId);
    const shaped = shapeInstanceResponse(refreshed, branding);

    return NextResponse.json({
      instance: shaped,
      embedToken: {
        token: insert.data.token,
        expiresAt: insert.data.expires_at,
      },
    });
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
