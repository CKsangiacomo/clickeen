import { resolvePolicy, type Policy } from '@clickeen/ck-policy';
import type { AccountRow, Env, LocalePolicy } from '../../shared/types';
import { authorizeAccount } from '../../shared/account-auth';
import { ckError } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { resolveAccountL10nPolicy } from '../../shared/l10n';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString, isUuid } from '../../shared/validation';
import { enqueueTokyoMirrorJob, resolveActivePublishLocales } from '../account-instances/service';

type AccountTier = AccountRow['tier'];

const ACCOUNT_QUERY_PAGE_SIZE = 1000;

function assertAccountId(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed || !isUuid(trimmed)) {
    return {
      ok: false as const,
      response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' }, 422),
    };
  }
  return { ok: true as const, value: trimmed };
}

function assertAssetId(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed || !isUuid(trimmed)) {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.assetId.invalid' }, 422) };
  }
  return { ok: true as const, value: trimmed };
}

function normalizeAccountTier(raw: unknown): AccountTier | null {
  switch (raw) {
    case 'free':
    case 'tier1':
    case 'tier2':
    case 'tier3':
      return raw;
    default:
      return null;
  }
}

function tierRank(tier: AccountTier): number {
  switch (tier) {
    case 'tier3':
      return 4;
    case 'tier2':
      return 3;
    case 'tier1':
      return 2;
    case 'free':
      return 1;
    default:
      return 0;
  }
}

function requireRomaAssetSurface(req: Request): Response | null {
  const surface = (req.headers.get('x-clickeen-surface') || '').trim();
  if (surface === 'roma-assets') return null;
  return ckError(
    {
      kind: 'DENY',
      reasonKey: 'coreui.errors.auth.forbidden',
      detail: 'Asset delete is managed via Roma Assets.',
    },
    403,
  );
}

function resolveTokyoMutableAssetBase(env: Env): string | null {
  const raw = ((env.TOKYO_WORKER_BASE_URL || '') || (env.TOKYO_BASE_URL || '')).trim().replace(/\/+$/, '');
  return raw || null;
}

function resolveTokyoServiceToken(env: Env): string | null {
  const token = ((env.TOKYO_DEV_JWT || '') || (env.PARIS_DEV_JWT || '')).trim();
  return token || null;
}

async function loadPagedRows<T>(args: {
  env: Env;
  table: string;
  baseParams: Record<string, string>;
  pageSize?: number;
}): Promise<T[]> {
  const pageSize = args.pageSize ?? ACCOUNT_QUERY_PAGE_SIZE;
  const out: T[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      ...args.baseParams,
      limit: String(pageSize),
      offset: String(offset),
    });
    const res = await supabaseFetch(args.env, `/rest/v1/${args.table}?${params.toString()}`, { method: 'GET' });
    if (!res.ok) {
      const details = await readJson(res);
      throw new Error(`[ParisWorker] Failed to load ${args.table} rows (${res.status}): ${JSON.stringify(details)}`);
    }
    const rows = ((await res.json()) as T[]) ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }

  return out;
}

function normalizePublicIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  raw.forEach((entry) => {
    const value = typeof entry === 'string' ? entry.trim() : '';
    if (!value) return;
    if (seen.has(value)) return;
    seen.add(value);
    out.push(value);
  });
  return out;
}

type PublishedInstanceRow = {
  public_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

async function loadPublishedInstanceRowsForAccount(env: Env, accountId: string): Promise<Array<{ publicId: string; createdAt: string | null }>> {
  const rows = await loadPagedRows<PublishedInstanceRow>({
    env,
    table: 'widget_instances',
    baseParams: {
      select: 'public_id,status,created_at',
      account_id: `eq.${accountId}`,
      status: 'eq.published',
      order: 'created_at.desc',
    },
  });

  const out: Array<{ publicId: string; createdAt: string | null }> = [];
  rows.forEach((row) => {
    const publicId = asTrimmedString(row.public_id);
    if (!publicId) return;
    out.push({ publicId, createdAt: typeof row.created_at === 'string' ? row.created_at : null });
  });
  return out;
}

async function unpublishAccountInstances(args: {
  env: Env;
  accountId: string;
  keepLivePublicIds: string[];
}): Promise<
  | { ok: true; unpublished: string[]; tokyo: { deleteEnqueued: number; failed: string[] } }
  | { ok: false; response: Response }
> {
  const keepSet = new Set(args.keepLivePublicIds);

  try {
    const publishedRows = await loadPublishedInstanceRowsForAccount(args.env, args.accountId);
    const publishedPublicIds = publishedRows.map((row) => row.publicId);
    const publishedSet = new Set(publishedPublicIds);

    const invalidKeeps = args.keepLivePublicIds.filter((publicId) => !publishedSet.has(publicId));
    if (invalidKeeps.length > 0) {
      return {
        ok: false,
        response: ckError(
          {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.payload.invalid',
            detail: `keepLivePublicIds contains unknown or non-live publicId: ${invalidKeeps[0]}`,
          },
          422,
        ),
      };
    }

    const toUnpublish = publishedPublicIds.filter((publicId) => !keepSet.has(publicId));
    if (toUnpublish.length === 0) {
      return { ok: true, unpublished: [], tokyo: { deleteEnqueued: 0, failed: [] } };
    }

    const patchParams = new URLSearchParams({
      public_id: `in.(${toUnpublish.join(',')})`,
      account_id: `eq.${args.accountId}`,
    });
    const patchRes = await supabaseFetch(args.env, `/rest/v1/widget_instances?${patchParams.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'unpublished' }),
    });
    if (!patchRes.ok) {
      const details = await readJson(patchRes);
      return {
        ok: false,
        response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500),
      };
    }

    const failed: string[] = [];
    for (const publicId of toUnpublish) {
      const enqueue = await enqueueTokyoMirrorJob(args.env, { v: 1, kind: 'delete-instance-mirror', publicId });
      if (!enqueue.ok) {
        failed.push(publicId);
        console.error('[ParisWorker] tokyo delete-instance-mirror enqueue failed', enqueue.error);
      }
    }

    return {
      ok: true,
      unpublished: toUnpublish,
      tokyo: {
        deleteEnqueued: Math.max(0, toUnpublish.length - failed.length),
        failed,
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500) };
  }
}

async function updateAccountTier(args: {
  env: Env;
  accountId: string;
  nextTier: AccountTier;
}): Promise<{ ok: true } | { ok: false; response: Response }> {
  const params = new URLSearchParams({ id: `eq.${args.accountId}` });
  const res = await supabaseFetch(args.env, `/rest/v1/accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ tier: args.nextTier }),
  });
  if (!res.ok) {
    const details = await readJson(res);
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500),
    };
  }
  const rows = (await res.json().catch(() => null)) as Array<{ id?: string }> | null;
  if (!rows?.[0]?.id) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404) };
  }
  return { ok: true };
}

function buildTierDropLocalePolicy(args: {
  account: AccountRow;
  policy: Policy;
}): { localePolicy: LocalePolicy; invalidAccountLocales: string | null } {
  const accountL10nPolicy = resolveAccountL10nPolicy(args.account.l10n_policy);
  const baseLocale = accountL10nPolicy.baseLocale;
  const publishLocales = resolveActivePublishLocales({
    accountLocales: args.account.l10n_locales,
    policy: args.policy,
    baseLocale,
  });
  const availableLocales = publishLocales.locales;

  const countryToLocale = Object.fromEntries(
    Object.entries(accountL10nPolicy.ip.countryToLocale).filter(([, locale]) => availableLocales.includes(locale)),
  );

  return {
    localePolicy: {
      baseLocale,
      availableLocales,
      ip: {
        enabled: accountL10nPolicy.ip.enabled,
        countryToLocale: accountL10nPolicy.ip.enabled ? countryToLocale : {},
      },
      switcher: {
        enabled: accountL10nPolicy.switcher.enabled,
      },
    },
    invalidAccountLocales: publishLocales.invalidAccountLocales,
  };
}

type KeepLiveInstanceRow = {
  public_id?: string | null;
  status?: string | null;
  config?: unknown;
};

async function loadKeepLiveInstances(args: {
  env: Env;
  accountId: string;
  keepLivePublicIds: string[];
}): Promise<{ ok: true; rows: Array<{ publicId: string; config: Record<string, unknown> }> } | { ok: false; response: Response }> {
  if (args.keepLivePublicIds.length === 0) return { ok: true, rows: [] };

  const params = new URLSearchParams({
    select: 'public_id,status,config',
    account_id: `eq.${args.accountId}`,
    public_id: `in.(${args.keepLivePublicIds.join(',')})`,
    limit: '1000',
  });
  const res = await supabaseFetch(args.env, `/rest/v1/widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500),
    };
  }
  const rows = ((await res.json().catch(() => null)) as KeepLiveInstanceRow[] | null) ?? [];

  const out: Array<{ publicId: string; config: Record<string, unknown> }> = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.status !== 'published') continue;
    const publicId = asTrimmedString(row.public_id);
    if (!publicId || seen.has(publicId)) continue;
    seen.add(publicId);
    const configRaw = row.config;
    if (!configRaw || typeof configRaw !== 'object' || Array.isArray(configRaw)) {
      return {
        ok: false,
        response: ckError(
          { kind: 'INTERNAL', reasonKey: 'coreui.errors.config.invalid', detail: `keepLive instance config invalid (${publicId})` },
          500,
        ),
      };
    }
    out.push({ publicId, config: configRaw as Record<string, unknown> });
  }

  const missing = args.keepLivePublicIds.filter((publicId) => !seen.has(publicId));
  if (missing.length > 0) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          detail: `keepLivePublicIds contains unknown publicId: ${missing[0]}`,
        },
        422,
      ),
    };
  }

  return { ok: true, rows: out };
}

async function enforceTierDropMirrorForKeptInstances(args: {
  env: Env;
  account: AccountRow;
  policy: Policy;
  keepLivePublicIds: string[];
}): Promise<{ ok: true; syncEnqueued: number; failed: string[]; failedDetails: Record<string, string> } | { ok: false; response: Response }> {
  if (args.keepLivePublicIds.length === 0) return { ok: true, syncEnqueued: 0, failed: [], failedDetails: {} };

  const seoGeoEntitled = args.policy.flags['embed.seoGeo.enabled'] === true;
  const { localePolicy, invalidAccountLocales } = buildTierDropLocalePolicy({ account: args.account, policy: args.policy });
  if (invalidAccountLocales) {
    console.warn('[ParisWorker] invalid account locales while enforcing plan change', { accountId: args.account.id, invalidAccountLocales });
  }

  const keepRows = await loadKeepLiveInstances({ env: args.env, accountId: args.account.id, keepLivePublicIds: args.keepLivePublicIds });
  if (!keepRows.ok) return keepRows;

  const failed: string[] = [];
  const failedDetails: Record<string, string> = {};

  for (const row of keepRows.rows) {
    const publicId = row.publicId;
    const seoGeoConfigEnabled = Boolean((row.config as any)?.seoGeo?.enabled === true);
    const nextSeoGeo = seoGeoEntitled && seoGeoConfigEnabled;

    const enqueue = await enqueueTokyoMirrorJob(args.env, {
      v: 1,
      kind: 'enforce-live-surface',
      publicId,
      localePolicy,
      seoGeo: nextSeoGeo,
    });
    if (!enqueue.ok) {
      failed.push(publicId);
      failedDetails[publicId] = enqueue.error;
      console.error('[ParisWorker] tokyo enforce-live-surface enqueue failed (plan change)', { publicId, error: enqueue.error });
    }
  }

  return {
    ok: true,
    syncEnqueued: Math.max(0, keepRows.rows.length - failed.length),
    failed,
    failedDetails,
  };
}

async function purgeAccountAssets(args: {
  env: Env;
  accountId: string;
}): Promise<{ ok: true; tokyo: Record<string, unknown> } | { ok: false; response: Response }> {
  try {
    const tokyoBase = resolveTokyoMutableAssetBase(args.env);
    if (!tokyoBase) {
      return {
        ok: false,
        response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'TOKYO_BASE_URL missing' }, 500),
      };
    }

    const tokyoToken = resolveTokyoServiceToken(args.env);
    if (!tokyoToken) {
      return {
        ok: false,
        response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'TOKYO_DEV_JWT missing' }, 500),
      };
    }

    const tokyoUrl = new URL(`${tokyoBase}/assets/purge/${encodeURIComponent(args.accountId)}`);
    tokyoUrl.searchParams.set('confirm', '1');
    const tokyoRes = await fetch(tokyoUrl.toString(), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokyoToken}`,
        accept: 'application/json',
        'x-clickeen-surface': 'roma-assets',
      },
      cache: 'no-store',
    });
    const tokyoBody = await readJson(tokyoRes);
    if (!tokyoRes.ok) {
      return {
        ok: false,
        response: json(
          (tokyoBody && typeof tokyoBody === 'object'
            ? (tokyoBody as Record<string, unknown>)
            : {
                error: {
                  kind: 'INTERNAL',
                  reasonKey: 'coreui.errors.db.writeFailed',
                  detail: JSON.stringify(tokyoBody),
                },
              }) as Record<string, unknown>,
          { status: tokyoRes.status },
        ),
      };
    }
    return { ok: true, tokyo: (tokyoBody && typeof tokyoBody === 'object' ? (tokyoBody as Record<string, unknown>) : { ok: true }) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500) };
  }
}

async function recordTierDropLifecycleState(args: {
  env: Env;
  accountId: string;
  fromTier: AccountTier;
  toTier: AccountTier;
  emailPending: boolean;
}): Promise<{ ok: true } | { ok: false; response: Response }> {
  const params = new URLSearchParams({ id: `eq.${args.accountId}` });
  const now = new Date().toISOString();
  const res = await supabaseFetch(args.env, `/rest/v1/accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      tier_changed_at: now,
      tier_changed_from: args.fromTier,
      tier_changed_to: args.toTier,
      tier_drop_dismissed_at: null,
      tier_drop_email_sent_at: args.emailPending ? null : now,
    }),
  });
  if (!res.ok) {
    const details = await readJson(res);
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500),
    };
  }
  const rows = (await res.json().catch(() => null)) as Array<{ id?: string }> | null;
  if (!rows?.[0]?.id) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.payload.invalid' }, 404) };
  }
  return { ok: true };
}

async function dismissTierDropLifecycleState(args: {
  env: Env;
  accountId: string;
}): Promise<{ ok: true } | { ok: false; response: Response }> {
  const params = new URLSearchParams({ id: `eq.${args.accountId}` });
  const res = await supabaseFetch(args.env, `/rest/v1/accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ tier_drop_dismissed_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const details = await readJson(res);
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500),
    };
  }
  return { ok: true };
}

export async function handleAccountAssetsList(req: Request, env: Env, accountIdRaw: string) {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  void req;
  const tokyoBase = resolveTokyoMutableAssetBase(env);
  const tokyoToken = resolveTokyoServiceToken(env);
  if (!tokyoBase || !tokyoToken) {
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: 'Tokyo service config missing' }, 500);
  }

  try {
    const tokyoRes = await fetch(`${tokyoBase}/assets/account/${encodeURIComponent(accountId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokyoToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    });
    const payload = await readJson(tokyoRes);
    if (!tokyoRes.ok) {
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(payload) }, 500);
    }
    const assets = Array.isArray((payload as any)?.assets) ? ((payload as any).assets as unknown[]) : [];

    return json({
      accountId,
      assets,
      pagination: {
        limit: assets.length,
        count: assets.length,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
}

export async function handleAccountAssetsPurge(req: Request, env: Env, accountIdRaw: string) {
  const surfaceError = requireRomaAssetSurface(req);
  if (surfaceError) return surfaceError;

  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;

  const confirmRaw = (new URL(req.url).searchParams.get('confirm') || '').trim().toLowerCase();
  const confirmed = confirmRaw === '1' || confirmRaw === 'true' || confirmRaw === 'yes';
  if (!confirmed) {
    return ckError(
      {
        kind: 'DENY',
        reasonKey: 'coreui.errors.account.assetsPurgeConfirmRequired',
        detail: 'confirm=1 is required to purge all account assets.',
      },
      409,
    );
  }

  const purged = await purgeAccountAssets({ env, accountId });
  if (!purged.ok) return purged.response;
  return json({ ok: true, accountId, tokyo: purged.tokyo });
}

export async function handleAccountInstancesUnpublish(req: Request, env: Env, accountIdRaw: string) {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;

  const confirmRaw = (new URL(req.url).searchParams.get('confirm') || '').trim().toLowerCase();
  const confirmed = confirmRaw === '1' || confirmRaw === 'true' || confirmRaw === 'yes';
  if (!confirmed) {
    return ckError(
      {
        kind: 'DENY',
        reasonKey: 'coreui.errors.account.instancesUnpublishConfirmRequired',
        detail: 'confirm=1 is required to unpublish instances for an account.',
      },
      409,
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const keepLivePublicIds = normalizePublicIdList((payload as any).keepLivePublicIds);
  const result = await unpublishAccountInstances({ env, accountId, keepLivePublicIds });
  if (!result.ok) return result.response;
  return json({ ok: true, accountId, kept: keepLivePublicIds, unpublished: result.unpublished, tokyo: result.tokyo });
}

export async function handleAccountLifecycleTierDropDismiss(req: Request, env: Env, accountIdRaw: string) {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const dismissed = await dismissTierDropLifecycleState({ env, accountId });
  if (!dismissed.ok) return dismissed.response;
  return json({ ok: true, accountId, kind: 'tier_drop' });
}

export async function handleAccountLifecyclePlanChange(req: Request, env: Env, accountIdRaw: string) {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'owner');
  if (!authorized.ok) return authorized.response;
  const account = authorized.account;

  const confirmRaw = (new URL(req.url).searchParams.get('confirm') || '').trim().toLowerCase();
  const confirmed = confirmRaw === '1' || confirmRaw === 'true' || confirmRaw === 'yes';
  if (!confirmed) {
    return ckError(
      {
        kind: 'DENY',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'confirm=1 is required to apply a plan change.',
      },
      409,
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const nextTier = normalizeAccountTier((payload as any).nextTier);
  if (!nextTier) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const keepLivePublicIdsRaw = (payload as any).keepLivePublicIds;
  const keepLivePublicIdsInput = keepLivePublicIdsRaw === undefined ? null : normalizePublicIdList(keepLivePublicIdsRaw);

  const prevTier = account.tier;
  const isTierDrop = tierRank(nextTier) < tierRank(prevTier);

  const tierUpdated = await updateAccountTier({ env, accountId, nextTier });
  if (!tierUpdated.ok) return tierUpdated.response;

  if (!isTierDrop) {
    return json({
      ok: true,
      accountId,
      fromTier: prevTier,
      toTier: nextTier,
      isTierDrop: false,
    });
  }

  const policy = resolvePolicy({ profile: nextTier, role: 'owner' });
  const maxPublishedRaw = policy.caps['instances.published.max'];
  const maxPublished =
    maxPublishedRaw == null
      ? null
      : typeof maxPublishedRaw === 'number' && Number.isFinite(maxPublishedRaw)
        ? Math.max(0, Math.floor(maxPublishedRaw))
        : Number.NaN;
  if (maxPublishedRaw != null && !Number.isFinite(maxPublished)) {
    return ckError(
      { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'instances.published.max invalid' },
      500,
    );
  }

  const publishedRows = await loadPublishedInstanceRowsForAccount(env, accountId);
  const publishedPublicIds = publishedRows.map((row) => row.publicId);

  let keepLivePublicIds: string[] = [];
  if (maxPublished == null) {
    keepLivePublicIds = publishedPublicIds;
  } else if (keepLivePublicIdsInput) {
    if (keepLivePublicIdsInput.length > maxPublished) {
      return ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          detail: `keepLivePublicIds exceeds instances.published.max (${maxPublished})`,
        },
        422,
      );
    }
    keepLivePublicIds = keepLivePublicIdsInput;
  } else {
    keepLivePublicIds = publishedPublicIds.slice(0, maxPublished);
  }

  let unpublished: string[] = [];
  let tokyo = { deleteEnqueued: 0, failed: [] as string[] };
  if (maxPublished != null) {
    const unpublish = await unpublishAccountInstances({ env, accountId, keepLivePublicIds });
    if (!unpublish.ok) return unpublish.response;
    unpublished = unpublish.unpublished;
    tokyo = unpublish.tokyo;
  }

  let tokyoResync = { syncEnqueued: 0, failed: [] as string[], failedDetails: {} as Record<string, string> };
  if (keepLivePublicIds.length > 0) {
    const mirror = await enforceTierDropMirrorForKeptInstances({
      env,
      account,
      policy,
      keepLivePublicIds,
    });
    if (!mirror.ok) return mirror.response;
    tokyoResync = { syncEnqueued: mirror.syncEnqueued, failed: mirror.failed, failedDetails: mirror.failedDetails };
  }

  let assetsPurged = false;
  if (nextTier === 'free') {
    const purged = await purgeAccountAssets({ env, accountId });
    if (!purged.ok) return purged.response;
    assetsPurged = true;
  }

  const lifecycle = await recordTierDropLifecycleState({
    env,
    accountId,
    fromTier: prevTier,
    toTier: nextTier,
    emailPending: true,
  });
  if (!lifecycle.ok) return lifecycle.response;

  return json({
    ok: true,
    accountId,
    noticeId: 'tier_drop',
    fromTier: prevTier,
    toTier: nextTier,
    isTierDrop: true,
    keptLivePublicIds: keepLivePublicIds,
    unpublished,
    tokyo,
    tokyoResync,
    assetsPurged,
  });
}

export async function handleAccountAssetGet(req: Request, env: Env, accountIdRaw: string, assetIdRaw: string) {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const assetIdResult = assertAssetId(assetIdRaw);
  if (!assetIdResult.ok) return assetIdResult.response;
  const assetId = assetIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const tokyoBase = resolveTokyoMutableAssetBase(env);
  const tokyoToken = resolveTokyoServiceToken(env);
  if (!tokyoBase || !tokyoToken) {
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: 'Tokyo service config missing' }, 500);
  }

  try {
    const tokyoRes = await fetch(`${tokyoBase}/assets/account/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokyoToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    });
    const payload = await readJson(tokyoRes);
    if (tokyoRes.status === 404) {
      return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' }, 404);
    }
    if (!tokyoRes.ok) {
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(payload) }, 500);
    }

    return json({
      accountId,
      asset: (payload as any)?.asset ?? null,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
}

export async function handleAccountAssetDelete(req: Request, env: Env, accountIdRaw: string, assetIdRaw: string) {
  const surfaceError = requireRomaAssetSurface(req);
  if (surfaceError) return surfaceError;

  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const assetIdResult = assertAssetId(assetIdRaw);
  if (!assetIdResult.ok) return assetIdResult.response;
  const assetId = assetIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;

  try {
    const tokyoBase = resolveTokyoMutableAssetBase(env);
    if (!tokyoBase) {
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'TOKYO_BASE_URL missing' }, 500);
    }

    const tokyoToken = resolveTokyoServiceToken(env);
    if (!tokyoToken) {
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'TOKYO_DEV_JWT missing' }, 500);
    }

    const confirmInUse = (new URL(req.url).searchParams.get('confirmInUse') || '').trim();
    const tokyoUrl = new URL(`${tokyoBase}/assets/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}`);
    if (confirmInUse) tokyoUrl.searchParams.set('confirmInUse', confirmInUse);

    const tokyoRes = await fetch(tokyoUrl.toString(), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokyoToken}`,
        'Content-Type': 'application/json',
        'x-clickeen-surface': 'roma-assets',
      },
      cache: 'no-store',
    });
    const tokyoBody = await readJson(tokyoRes);
    if (tokyoRes.status === 404) {
      return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' }, 404);
    }
    if (tokyoRes.status === 409 && tokyoBody && typeof tokyoBody === 'object') {
      return json(tokyoBody as Record<string, unknown>, { status: 409 });
    }
    if (!tokyoRes.ok) {
      return ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail: JSON.stringify(tokyoBody),
        },
        500,
      );
    }

    return json(
      (tokyoBody && typeof tokyoBody === 'object'
        ? tokyoBody
        : {
            accountId,
            assetId,
            deleted: true,
          }) as Record<string, unknown>,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
  }
}
