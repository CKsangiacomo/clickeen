import { NextResponse } from 'next/server';
import { getServiceClient } from '@paris/lib/supabaseAdmin';
import { assertInstanceAccess } from '@paris/lib/access';
import { loadInstance, shapeInstanceResponse, TokenError } from '@paris/lib/instances';
import { AuthError, requireUser, assertWorkspaceMember } from '@paris/lib/auth';
import type { AdminClient } from '@paris/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { publicId: string } };

type UpdatePayload = {
  config?: Record<string, unknown>;
  status?: 'draft' | 'published' | 'inactive';
};

class ValidationError extends Error {
  constructor(message: string, public readonly path: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

async function parseJson(req: Request) {
  const raw = await req.text();
  if (!raw) throw new ValidationError('body must not be empty', 'body');
  try {
    return JSON.parse(raw) as UpdatePayload;
  } catch {
    throw new ValidationError('invalid JSON payload', 'body');
  }
}

function assertConfig(config: unknown) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new ValidationError('config must be an object', 'config');
  }
  return config as Record<string, unknown>;
}

function assertStatus(status: unknown) {
  if (status === undefined) return undefined;
  if (status !== 'draft' && status !== 'published' && status !== 'inactive') {
    throw new ValidationError('invalid status', 'status');
  }
  return status as 'draft' | 'published' | 'inactive';
}

export async function GET(req: Request, { params }: Params) {
  try {
    const client = getServiceClient();
    const instance = await loadInstance(client, params.publicId);
    if (!instance) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

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

    // Branding derived from entitlements (Phase-1): free plan → enforced branding
    const plan = await fetchWorkspacePlan(client, instance.workspaceId);
    const features = await fetchPlanFeatures(client, plan);
    const branding = { hide: false, enforced: !features.brandingRemovable } as const;
    return NextResponse.json(shapeInstanceResponse(instance, branding));
  } catch (err) {
    return NextResponse.json({ error: 'SERVER_ERROR', details: (err as Error).message ?? String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const payload = await parseJson(req);
    const config = payload.config !== undefined ? assertConfig(payload.config) : undefined;
    const status = assertStatus(payload.status);

    const { client, user } = await requireUser(req);
    const instance = await loadInstance(client, params.publicId);
    if (!instance) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    await assertWorkspaceMember(client, instance.workspaceId, user.id);

    // Reject empty update payloads to avoid no-op UPDATEs
    if (config === undefined && !status) {
      return NextResponse.json([
        { path: 'body', message: 'At least one field (config, status) required' },
      ], { status: 422 });
    }

    // Enforce plan limits when publishing (Phase-1)
    if (status === 'published' && instance.status !== 'published') {
      const plan = await fetchWorkspacePlan(client, instance.workspaceId);
      const limits = await fetchPlanLimits(client, plan);
      const publishedCount = await countPublishedWidgets(client, instance.workspaceId);
      const maxWidgets = limits.maxWidgets;
      if (typeof maxWidgets === 'number' && maxWidgets >= 0 && publishedCount >= maxWidgets) {
        return NextResponse.json({ error: 'PLAN_LIMIT' }, { status: 403 });
      }
    }

    const update: Record<string, unknown> = {};
    if (config !== undefined) update.config = config;
    if (status) update.status = status;

    const { error } = await client
      .from('widget_instances')
      .update(update)
      .eq('public_id', params.publicId);

    if (error) {
      return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 });
    }

    const refreshed = await loadInstance(client, params.publicId);
    if (!refreshed) {
      return NextResponse.json({ error: 'SERVER_ERROR', details: 'Instance updated but could not be reloaded' }, { status: 500 });
    }

    // Return with plan-based branding consistency
    const plan = await fetchWorkspacePlan(client, refreshed.workspaceId);
    const features = await fetchPlanFeatures(client, plan);
    const branding = { hide: false, enforced: !features.brandingRemovable } as const;
    return NextResponse.json(shapeInstanceResponse(refreshed, branding));
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

async function fetchWorkspacePlan(client: AdminClient, workspaceId: string) {
  const { data, error } = await client
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return (data?.plan as string) ?? 'free';
}

async function fetchPlanLimits(client: AdminClient, planId: string) {
  const { data, error } = await client
    .from('plan_limits')
    .select('limit_type, limit_value')
    .eq('plan_id', planId);
  if (error) throw error;
  const lookup = (key: string) => data?.find((row) => row.limit_type === key || row.limit_type === snakeCase(key))?.limit_value ?? null;
  return { maxWidgets: lookup('maxWidgets') } as { maxWidgets: number | null };
}

async function fetchPlanFeatures(client: AdminClient, planId: string) {
  const { data, error } = await client
    .from('plan_features')
    .select('feature_key, enabled')
    .eq('plan_id', planId);
  if (error) throw error;
  const find = (key: string) => data?.find((row) => row.feature_key === key || row.feature_key === snakeCase(key))?.enabled ?? false;
  return { premiumTemplates: find('premiumTemplates'), brandingRemovable: find('brandingRemovable') };
}

async function countPublishedWidgets(client: AdminClient, workspaceId: string) {
  const { data, error } = await client
    .from('widget_instances')
    .select('id, widget_id, status')
    .eq('status', 'published');
  if (error) throw error;
  if (!data || data.length === 0) return 0;
  // Filter by workspace via widgets join
  const ids = data.map((row) => row.widget_id);
  const { data: widgets, error: werr } = await client
    .from('widgets')
    .select('id, workspace_id')
    .in('id', ids);
  if (werr) throw werr;
  return (widgets ?? []).filter((w) => w.workspace_id === workspaceId).length;
}

function snakeCase(value: string) {
  return value.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
}
