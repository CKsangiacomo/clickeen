import type { AccountBusinessProfileRow, Env } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { isRecord } from '../../shared/validation';
import { authorizeAccount } from '../../shared/account-auth';

async function loadAccountBusinessProfile(
  env: Env,
  accountId: string,
): Promise<AccountBusinessProfileRow | null> {
  const params = new URLSearchParams({
    select: 'account_id,profile,sources,created_at,updated_at',
    account_id: `eq.${accountId}`,
    limit: '1',
  });
  const res = await supabaseFetch(
    env,
    `/rest/v1/account_business_profiles?${params.toString()}`,
    { method: 'GET' },
  );
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load account business profile (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as AccountBusinessProfileRow[];
  return rows?.[0] ?? null;
}

async function upsertAccountBusinessProfile(args: {
  env: Env;
  accountId: string;
  profile: Record<string, unknown>;
  sources?: Record<string, unknown>;
}): Promise<AccountBusinessProfileRow | null> {
  const payload = {
    account_id: args.accountId,
    profile: args.profile,
    ...(args.sources ? { sources: args.sources } : {}),
  };
  const res = await supabaseFetch(
    args.env,
    `/rest/v1/account_business_profiles?on_conflict=account_id`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to upsert account business profile (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as AccountBusinessProfileRow[];
  return rows?.[0] ?? null;
}

export async function handleAccountBusinessProfileGet(
  req: Request,
  env: Env,
  accountId: string,
): Promise<Response> {
  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  try {
    const row = await loadAccountBusinessProfile(env, accountId);
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

export async function handleAccountBusinessProfileUpsert(
  req: Request,
  env: Env,
  accountId: string,
): Promise<Response> {
  const authorized = await authorizeAccount(req, env, accountId, 'editor');
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
    const row = await upsertAccountBusinessProfile({ env, accountId, profile, sources });
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
