import { NextResponse } from 'next/server';
import { getServiceClient, type AdminClient } from '@paris/lib/supabaseAdmin';
import { assertWorkspaceMember, AuthError, requireUser, resolveWorkspaceId } from '@paris/lib/auth';

export const runtime = 'nodejs';

interface EntitlementsResult {
  plan: string;
  limits: {
    maxWidgets: number | null;
  };
  features: {
    premiumTemplates: boolean;
    brandingRemovable: boolean;
  };
  usage: {
    widgetsCount: number;
    submissionsCount: number;
  };
}

export async function GET(req: Request) {
  try {
    const { client, user } = await requireUser(req);
    const workspaceId = resolveWorkspaceId(req, user);
    if (!workspaceId) {
      return NextResponse.json([{ path: 'workspaceId', message: 'workspaceId is required (query or metadata)' }], { status: 422 });
    }

    await assertWorkspaceMember(client, workspaceId, user.id);

    const [{ data: workspace, error: workspaceError }] = await Promise.all([
      client
        .from('workspaces')
        .select('plan')
        .eq('id', workspaceId)
        .maybeSingle(),
    ]);

    if (workspaceError) {
      return NextResponse.json({ error: 'DB_ERROR', details: workspaceError.message }, { status: 500 });
    }
    if (!workspace) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const [features, limits, widgetsCount, submissionsCount] = await Promise.all([
      fetchPlanFeatures(client, workspace.plan),
      fetchPlanLimits(client, workspace.plan),
      countWidgets(client, workspaceId),
      countSubmissions(client, workspaceId),
    ]);

    const body: EntitlementsResult = {
      plan: workspace.plan,
      limits,
      features,
      usage: {
        widgetsCount,
        submissionsCount,
      },
    };

    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === 'AUTH_REQUIRED' ? 401 : 403;
      return NextResponse.json({ error: err.code }, { status });
    }
    return NextResponse.json({ error: 'SERVER_ERROR', details: (err as Error).message ?? String(err) }, { status: 500 });
  }
}

async function fetchPlanFeatures(client: AdminClient, planId: string) {
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

async function fetchPlanLimits(client: AdminClient, planId: string) {
  const { data, error } = await client
    .from('plan_limits')
    .select('limit_type, limit_value')
    .eq('plan_id', planId);

  if (error) throw error;

  const lookup = (key: string) => data?.find((row) => row.limit_type === key || row.limit_type === snakeCase(key))?.limit_value ?? null;

  return {
    maxWidgets: lookup('maxWidgets'),
  };
}

async function countWidgets(client: AdminClient, workspaceId: string) {
  const { count, error } = await client
    .from('widgets')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) throw error;
  return count ?? 0;
}

async function countSubmissions(client: AdminClient, workspaceId: string) {
  const { data: widgets, error } = await client
    .from('widgets')
    .select('id')
    .eq('workspace_id', workspaceId);

  if (error) throw error;
  if (!widgets || widgets.length === 0) return 0;

  const widgetIds = widgets.map((w) => w.id);
  const { count, error: submissionsError } = await client
    .from('widget_submissions')
    .select('id', { count: 'exact', head: true })
    .in('widget_id', widgetIds);

  if (submissionsError) throw submissionsError;
  return count ?? 0;
}

function snakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
