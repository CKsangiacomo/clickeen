import type { Env, WorkspaceBusinessProfileRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { isRecord } from '../../shared/validation';
import { authorizeWorkspace } from '../../shared/workspace-auth';

async function loadWorkspaceBusinessProfile(
  env: Env,
  workspaceId: string,
): Promise<WorkspaceBusinessProfileRow | null> {
  const params = new URLSearchParams({
    select: 'workspace_id,profile,sources,created_at,updated_at',
    workspace_id: `eq.${workspaceId}`,
    limit: '1',
  });
  const res = await supabaseFetch(
    env,
    `/rest/v1/workspace_business_profiles?${params.toString()}`,
    { method: 'GET' },
  );
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load workspace profile (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as WorkspaceBusinessProfileRow[];
  return rows?.[0] ?? null;
}

async function upsertWorkspaceBusinessProfile(args: {
  env: Env;
  workspaceId: string;
  profile: Record<string, unknown>;
  sources?: Record<string, unknown>;
}): Promise<WorkspaceBusinessProfileRow | null> {
  const payload = {
    workspace_id: args.workspaceId,
    profile: args.profile,
    ...(args.sources ? { sources: args.sources } : {}),
  };
  const res = await supabaseFetch(
    args.env,
    `/rest/v1/workspace_business_profiles?on_conflict=workspace_id`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to upsert workspace profile (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as WorkspaceBusinessProfileRow[];
  return rows?.[0] ?? null;
}

export async function handleWorkspaceBusinessProfileGet(
  req: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;

  try {
    const row = await loadWorkspaceBusinessProfile(env, workspaceId);
    if (!row) return json({ error: 'NOT_FOUND' }, { status: 404 });
    return json({
      profile: row.profile,
      sources: row.sources ?? null,
      updatedAt: row.updated_at ?? null,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: 'DB_ERROR', detail }, { status: 500 });
  }
}

export async function handleWorkspaceBusinessProfileUpsert(
  req: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }
  if (!isRecord(body)) {
    return json([{ path: 'body', message: 'body must be an object' }], { status: 422 });
  }

  const profile = isRecord((body as any).profile)
    ? ((body as any).profile as Record<string, unknown>)
    : null;
  if (!profile) {
    return json([{ path: 'profile', message: 'profile must be an object' }], { status: 422 });
  }
  const sources = isRecord((body as any).sources)
    ? ((body as any).sources as Record<string, unknown>)
    : undefined;

  try {
    const row = await upsertWorkspaceBusinessProfile({ env, workspaceId, profile, sources });
    return json({
      profile: row?.profile ?? profile,
      sources: row?.sources ?? sources ?? null,
      updatedAt: row?.updated_at ?? null,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: 'DB_ERROR', detail }, { status: 500 });
  }
}
