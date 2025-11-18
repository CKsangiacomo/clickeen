import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getServiceClient } from '@paris/lib/supabaseAdmin';
import { requireUser, resolveWorkspaceId, assertWorkspaceMember, AuthError } from '@paris/lib/auth';
import { loadInstance, shapeInstanceResponse, computeBranding } from '@paris/lib/instances';
import { getTemplates } from '@paris/lib/catalog';

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

function generatePublicId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `wgt_${rand}`;
}

function normalizePublicId(id?: string) {
  if (id === undefined) return generatePublicId();
  if (typeof id !== 'string') throw new ValidationError('publicId must be a string', 'publicId');
  const trimmed = id.trim();
  if (!/^wgt_[a-z0-9]{6}$/.test(trimmed)) {
    throw new ValidationError('publicId must match wgt_{base36_6}', 'publicId');
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

    // Premium template gating (Phase-1): free plan cannot select premium templates
    const availableTemplates = getTemplates(widgetType);
    const template = availableTemplates.find((t) => t.id === templateId);
    if (!template) {
      const validIds = availableTemplates.map((t) => t.id).join(', ');
      return NextResponse.json(
        [{ path: 'templateId', message: `unknown templateId. Valid options for ${widgetType}: ${validIds}` }],
        { status: 422 }
      );
    }
    const premium = Boolean(template.premium);
    if (premium) {
      const features = await fetchPlanFeatures(client, workspace.plan);
      if (!features.premiumTemplates) {
        return NextResponse.json({ error: 'PREMIUM_REQUIRED' }, { status: 403 });
      }
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

    const branding = await computeBranding(client, workspaceId);
    return NextResponse.json({ instance: shapeInstanceResponse(created, branding), draftToken }, { status: 201 });
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
  // Generate a simple public key for the widget (required by schema)
  function generatePublicKey() {
    const rand = Math.random().toString(36).slice(2, 14);
    return `pk_${rand}`;
  }
  const publicKey = generatePublicKey();
  const { data, error } = await client
    .from('widgets')
    .insert({
      workspace_id: workspaceId,
      name,
      type: widgetType,
      public_key: publicKey,
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

async function fetchPlanFeatures(client: ReturnType<typeof getServiceClient>, planId: string) {
  const { data, error } = await client
    .from('plan_features')
    .select('feature_key, enabled')
    .eq('plan_id', planId);
  if (error) throw error;
  const find = (key: string) => data?.find((row) => row.feature_key === key || row.feature_key === snakeCase(key))?.enabled ?? false;
  return {
    premiumTemplates: find('premiumTemplates'),
    brandingRemovable: find('brandingRemovable'),
  };
}

function snakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
