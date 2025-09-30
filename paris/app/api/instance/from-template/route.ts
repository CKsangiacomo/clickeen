import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getServiceClient } from '@paris/lib/supabaseAdmin';
import { requireUser, resolveWorkspaceId, assertWorkspaceMember, AuthError } from '@paris/lib/auth';
import { loadInstance, shapeInstanceResponse } from '@paris/lib/instances';

export const runtime = 'nodejs';

interface FromTemplatePayload {
  workspaceId?: string;
  widgetType?: string;
  templateId?: string;
  schemaVersion?: string;
  publicId?: string;
  overrides?: Record<string, unknown>;
  name?: string;
}

class ValidationError extends Error {
  constructor(message: string, public readonly path: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function parseBody(raw: string) {
  if (!raw) throw new ValidationError('body must not be empty', 'body');
  try {
    return JSON.parse(raw) as FromTemplatePayload;
  } catch {
    throw new ValidationError('invalid JSON payload', 'body');
  }
}

function requireString(value: unknown, path: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${path} is required`, path);
  }
  return value.trim();
}

function normalizePublicId(id?: string) {
  if (id === undefined) {
    return randomUUID().replace(/[^a-z0-9-]/g, '').slice(0, 24).toLowerCase();
  }
  if (typeof id !== 'string') {
    throw new ValidationError('publicId must be a string', 'publicId');
  }
  const trimmed = id.trim();
  if (!/^[a-z0-9-]{6,64}$/.test(trimmed)) {
    throw new ValidationError('publicId must be 6–64 chars, lowercase a-z, 0-9, or -', 'publicId');
  }
  return trimmed;
}

function normalizeOverrides(overrides: unknown) {
  if (overrides === undefined) return {};
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new ValidationError('overrides must be an object', 'overrides');
  }
  return overrides as Record<string, unknown>;
}

export async function POST(req: Request) {
  try {
    const { client, user } = await requireUser(req);
    const payload = parseBody(await req.text());

    const workspaceId = payload.workspaceId ?? resolveWorkspaceId(req, user);
    if (!workspaceId) {
      throw new ValidationError('workspaceId is required (query, body, or metadata)', 'workspaceId');
    }

    const widgetType = requireString(payload.widgetType, 'widgetType');
    const templateId = requireString(payload.templateId, 'templateId');
    const schemaVersion = payload.schemaVersion ? requireString(payload.schemaVersion, 'schemaVersion') : null;

    await assertWorkspaceMember(client, workspaceId, user.id);

    const workspace = await loadWorkspacePlan(client, workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const widget = await createWidget(client, {
      workspaceId,
      name: payload.name ?? defaultWidgetName(widgetType),
      widgetType,
    });

    const publicId = normalizePublicId(payload.publicId);
    const draftToken = randomUUID();
    const overrides = normalizeOverrides(payload.overrides);

    const insert = await client
      .from('widget_instances')
      .insert({
        widget_id: widget.id,
        public_id: publicId,
        status: 'draft',
        config: overrides,
        template_id: templateId,
        schema_version: schemaVersion,
        draft_token: draftToken,
        widget_type: widgetType,
      })
      .select('public_id')
      .single();

    if (insert.error) {
      if (/duplicate key|unique constraint|23505/i.test(insert.error.message)) {
        return NextResponse.json({ error: 'ALREADY_EXISTS', details: 'publicId already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'DB_ERROR', details: insert.error.message }, { status: 500 });
    }

    const created = await loadInstance(client, publicId);
    if (!created) {
      return NextResponse.json({ error: 'SERVER_ERROR', details: 'Instance created but could not be reloaded' }, { status: 500 });
    }

    return NextResponse.json(
      {
        instance: shapeInstanceResponse(created),
        draftToken,
      },
      { status: 201 },
    );
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

type WorkspaceRow = { id: string; plan: string };

type WidgetRow = { id: string };

async function loadWorkspacePlan(client: ReturnType<typeof getServiceClient>, workspaceId: string) {
  const { data, error } = await client
    .from('workspaces')
    .select('id, plan')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data as WorkspaceRow | null;
}

async function createWidget(client: ReturnType<typeof getServiceClient>, {
  workspaceId,
  name,
  widgetType,
}: {
  workspaceId: string;
  name: string;
  widgetType: string;
}) {
  const { data, error } = await client
    .from('widgets')
    .insert({
      workspace_id: workspaceId,
      name,
      type: widgetType,
      status: 'active',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data as WidgetRow;
}

function defaultWidgetName(widgetType: string) {
  return widgetType
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/(^|\s)(\w)/g, (_, ws, letter) => `${ws}${letter.toUpperCase()}`)
    .trim();
}
