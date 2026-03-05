import type { Env } from '../../shared/types';
import { json } from '../../shared/http';
import { isRecord } from '../../shared/validation';
import { authorizeAccount } from '../../shared/account-auth';

type AccountBusinessProfileDoc = {
  accountId: string;
  profile: Record<string, unknown>;
  sources?: Record<string, unknown> | null;
  updatedAt?: string | null;
};

function requireAccountEnrichmentBucket(env: Env): R2Bucket {
  if (!env.ACCOUNT_ENRICHMENT_R2) {
    throw new Error('[ParisWorker] Missing ACCOUNT_ENRICHMENT_R2 binding');
  }
  return env.ACCOUNT_ENRICHMENT_R2;
}

function accountBusinessProfileKey(accountId: string): string {
  return `account-enrichment/v1/accounts/${encodeURIComponent(accountId)}/profile.json`;
}

async function loadAccountBusinessProfile(
  env: Env,
  accountId: string,
): Promise<AccountBusinessProfileDoc | null> {
  const bucket = requireAccountEnrichmentBucket(env);
  const key = accountBusinessProfileKey(accountId);
  const obj = await bucket.get(key);
  if (!obj) return null;
  const payload = (await obj.json().catch(() => null)) as AccountBusinessProfileDoc | null;
  if (!payload || typeof payload !== 'object') return null;
  if (!isRecord(payload.profile)) return null;
  return {
    accountId,
    profile: payload.profile,
    sources: isRecord(payload.sources) ? payload.sources : null,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
  };
}

async function upsertAccountBusinessProfile(args: {
  env: Env;
  accountId: string;
  profile: Record<string, unknown>;
  sources?: Record<string, unknown>;
}): Promise<AccountBusinessProfileDoc> {
  const bucket = requireAccountEnrichmentBucket(args.env);
  const updatedAt = new Date().toISOString();
  const payload: AccountBusinessProfileDoc = {
    accountId: args.accountId,
    profile: args.profile,
    sources: args.sources ?? null,
    updatedAt,
  };
  await bucket.put(accountBusinessProfileKey(args.accountId), JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json' },
  });
  return payload;
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
      updatedAt: row.updatedAt ?? null,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: 'STORAGE_ERROR', detail }, { status: 500 });
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
      updatedAt: row?.updatedAt ?? null,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: 'STORAGE_ERROR', detail }, { status: 500 });
  }
}
