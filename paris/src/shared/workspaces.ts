import type { Env, WorkspaceRow } from './types';
import { supabaseFetch } from './supabase';
import { readJson } from './http';
import { ckError } from './errors';

export async function loadWorkspaceById(env: Env, workspaceId: string): Promise<WorkspaceRow | null> {
  const params = new URLSearchParams({
    select: 'id,tier,name,slug,website_url,l10n_locales',
    id: `eq.${workspaceId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load workspace (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as WorkspaceRow[];
  return rows?.[0] ?? null;
}

export async function requireWorkspace(env: Env, workspaceId: string) {
  try {
    const workspace = await loadWorkspaceById(env, workspaceId);
    if (!workspace) {
      return { ok: false as const, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.workspace.notFound' }, 404) };
    }
    return { ok: true as const, workspace };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false as const,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500),
    };
  }
}
