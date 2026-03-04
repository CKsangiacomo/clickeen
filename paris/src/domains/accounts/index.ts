import { resolvePolicy, type Policy } from '@clickeen/ck-policy';
import { toCanonicalAssetVersionPath } from '@clickeen/ck-contracts';
import type { AccountRow, Env, LocalePolicy } from '../../shared/types';
import { authorizeAccount } from '../../shared/account-auth';
import { ckError } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { resolveAccountL10nPolicy } from '../../shared/l10n';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString, isUuid } from '../../shared/validation';
import { enqueueTokyoMirrorJob, resolveActivePublishLocales } from '../account-instances/service';

type AccountAssetRow = {
  asset_id: string;
  account_id: string;
  public_id?: string | null;
  widget_type?: string | null;
  source: string;
  original_filename: string;
  normalized_filename: string;
  content_type: string;
  size_bytes: number;
  sha256?: string | null;
  created_at: string;
  updated_at: string;
};

type AccountAssetVariantRow = {
  asset_id: string;
  variant: string;
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

type AccountAssetUsageRow = {
  account_id: string;
  asset_id: string;
  public_id: string;
  config_path: string;
  created_at: string;
  updated_at: string;
};

type AccountTier = AccountRow['tier'];

type AccountNoticeRow = {
  notice_id: string;
  account_id: string;
  kind: string;
  status: 'open' | 'dismissed' | 'resolved';
  payload: unknown;
  email_pending: boolean;
  email_sent_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};

type AccountMemberRow = {
  account_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

type TokyoAssetIdentityIntegritySnapshot = {
  ok?: boolean;
  reasonKey?: string | null;
  dbVariantCount?: number;
  r2ObjectCount?: number;
  missingInR2Count?: number;
  orphanInR2Count?: number;
  missingInR2?: string[];
  orphanInR2?: string[];
};

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

function assertNoticeId(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed || !isUuid(trimmed)) {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
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

function resolveListLimit(req: Request): number {
  const url = new URL(req.url);
  const raw = Number.parseInt((url.searchParams.get('limit') || '').trim(), 10);
  if (!Number.isFinite(raw) || raw <= 0) return 50;
  return Math.min(raw, 200);
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

function resolveTokyoPublicAssetBase(env: Env): string | null {
  const raw = ((env.TOKYO_BASE_URL || '') || (env.TOKYO_WORKER_BASE_URL || '')).trim().replace(/\/+$/, '');
  return raw || null;
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

async function loadVariantsByAssetIds(
  env: Env,
  accountId: string,
  assetIds: string[],
): Promise<Map<string, AccountAssetVariantRow[]>> {
  const out = new Map<string, AccountAssetVariantRow[]>();
  if (assetIds.length === 0) return out;

  const rows = await loadPagedRows<AccountAssetVariantRow>({
    env,
    table: 'account_asset_variants',
    baseParams: {
      select: 'asset_id,variant,r2_key,filename,content_type,size_bytes,created_at',
      account_id: `eq.${accountId}`,
      asset_id: `in.(${assetIds.join(',')})`,
      order: 'created_at.desc',
    },
  });
  rows.forEach((row) => {
    const current = out.get(row.asset_id);
    if (current) current.push(row);
    else out.set(row.asset_id, [row]);
  });
  return out;
}

async function loadUsageByAssetIds(env: Env, accountId: string, assetIds: string[]): Promise<Map<string, AccountAssetUsageRow[]>> {
  const out = new Map<string, AccountAssetUsageRow[]>();
  if (assetIds.length === 0) return out;

  const rows = await loadPagedRows<AccountAssetUsageRow>({
    env,
    table: 'account_asset_usage',
    baseParams: {
      select: 'account_id,asset_id,public_id,config_path,created_at,updated_at',
      account_id: `eq.${accountId}`,
      asset_id: `in.(${assetIds.join(',')})`,
      order: 'updated_at.desc',
    },
  });
  rows.forEach((row) => {
    const current = out.get(row.asset_id);
    if (current) current.push(row);
    else out.set(row.asset_id, [row]);
  });
  return out;
}

async function loadAccountAsset(env: Env, accountId: string, assetId: string): Promise<AccountAssetRow | null> {
  const params = new URLSearchParams({
    select: [
      'asset_id',
      'account_id',
      'public_id',
      'widget_type',
      'source',
      'original_filename',
      'normalized_filename',
      'content_type',
      'size_bytes',
      'sha256',
      'created_at',
      'updated_at',
    ].join(','),
    account_id: `eq.${accountId}`,
    asset_id: `eq.${assetId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_assets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account asset (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as AccountAssetRow[];
  return rows?.[0] ?? null;
}

function normalizeAssetVariant(
  row: AccountAssetVariantRow,
  tokyoBase: string | null,
): {
  variant: string;
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
} {
  const key = row.r2_key;
  const versionPath = toCanonicalAssetVersionPath(key);
  const url = tokyoBase && versionPath ? `${tokyoBase}${versionPath}` : null;
  return {
    variant: row.variant,
    key,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    url,
  };
}

function normalizeAccountAsset(
  row: AccountAssetRow,
  variants: AccountAssetVariantRow[],
  usageRows: AccountAssetUsageRow[],
  tokyoBase: string | null,
) {
  const usage = usageRows.map((item) => ({
    publicId: item.public_id,
    configPath: item.config_path,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));

  return {
    assetId: row.asset_id,
    accountId: row.account_id,
    publicId: row.public_id ?? null,
    widgetType: row.widget_type ?? null,
    source: row.source,
    originalFilename: row.original_filename,
    normalizedFilename: row.normalized_filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256 ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usageCount: usage.length,
    usedBy: usage,
    variants: variants.map((variant) => normalizeAssetVariant(variant, tokyoBase)),
  };
}

async function ensureTokyoAssetIdentityIntegrity(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const tokyoBase = resolveTokyoMutableAssetBase(env);
  const tokyoToken = resolveTokyoServiceToken(env);
  if (!tokyoBase || !tokyoToken) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.assets.integrityUnavailable',
          detail: !tokyoBase ? 'TOKYO_BASE_URL missing' : 'TOKYO_DEV_JWT missing',
        },
        500,
      ),
    };
  }

  let res: Response;
  let payload:
    | {
        error?: { reasonKey?: string | null; detail?: string | null };
        accountId?: string;
        assetId?: string;
        integrity?: TokyoAssetIdentityIntegritySnapshot;
      }
    | null = null;
  try {
    const url = `${tokyoBase}/assets/integrity/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}`;
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokyoToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    payload = (await readJson(res)) as
      | {
          error?: { reasonKey?: string | null; detail?: string | null };
          accountId?: string;
          assetId?: string;
          integrity?: TokyoAssetIdentityIntegritySnapshot;
        }
      | null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      response: ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.assets.integrityUnavailable',
          detail,
        },
        500,
      ),
    };
  }

  if (res.ok) return { ok: true };

  if (res.status === 404) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' }, 404) };
  }

  if (res.status === 409 && payload && typeof payload === 'object') {
    return {
      ok: false,
      response: json(payload as Record<string, unknown>, { status: 409 }),
    };
  }

  return {
    ok: false,
    response: ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.assets.integrityUnavailable',
        detail: JSON.stringify(payload),
      },
      500,
    ),
  };
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

async function createAccountNotice(args: {
  env: Env;
  accountId: string;
  kind: string;
  payload: Record<string, unknown>;
  emailPending: boolean;
}): Promise<{ ok: true; notice: AccountNoticeRow } | { ok: false; response: Response }> {
  const res = await supabaseFetch(args.env, `/rest/v1/account_notices`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      account_id: args.accountId,
      kind: args.kind,
      status: 'open',
      payload: args.payload,
      email_pending: args.emailPending,
    }),
  });
  if (!res.ok) {
    const details = await readJson(res);
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500),
    };
  }
  const rows = (await res.json().catch(() => null)) as AccountNoticeRow[] | null;
  const notice = rows?.[0] ?? null;
  if (!notice?.notice_id) {
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'notice insert did not return a row' }, 500),
    };
  }
  return { ok: true, notice };
}

async function dismissAccountNotice(args: {
  env: Env;
  accountId: string;
  noticeId: string;
}): Promise<{ ok: true } | { ok: false; response: Response }> {
  const now = new Date().toISOString();
  const params = new URLSearchParams({
    notice_id: `eq.${args.noticeId}`,
    account_id: `eq.${args.accountId}`,
  });
  const res = await supabaseFetch(args.env, `/rest/v1/account_notices?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'dismissed', dismissed_at: now }),
  });
  if (!res.ok) {
    const details = await readJson(res);
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500),
    };
  }
  const rows = (await res.json().catch(() => null)) as Array<{ notice_id?: string }> | null;
  if (!rows?.[0]?.notice_id) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.payload.invalid' }, 404) };
  }
  return { ok: true };
}

export async function handleAccountAssetsList(req: Request, env: Env, accountIdRaw: string) {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const limit = resolveListLimit(req);
  const params = new URLSearchParams({
    select: [
      'asset_id',
      'account_id',
      'public_id',
      'widget_type',
      'source',
      'original_filename',
      'normalized_filename',
      'content_type',
      'size_bytes',
      'sha256',
      'created_at',
      'updated_at',
    ].join(','),
    account_id: `eq.${accountId}`,
    order: 'created_at.desc',
    limit: String(limit),
  });
  const tokyoBase = resolveTokyoPublicAssetBase(env);

  try {
    const res = await supabaseFetch(env, `/rest/v1/account_assets?${params.toString()}`, { method: 'GET' });
    if (!res.ok) {
      const details = await readJson(res);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
    }

    const assets = (await res.json()) as AccountAssetRow[];
    const assetIds = assets.map((asset) => asset.asset_id).filter(Boolean);
    const [variantsByAssetId, usageByAssetId] = await Promise.all([
      loadVariantsByAssetIds(env, accountId, assetIds),
      loadUsageByAssetIds(env, accountId, assetIds),
    ]);

    return json({
      accountId,
      assets: assets.map((asset) =>
        normalizeAccountAsset(asset, variantsByAssetId.get(asset.asset_id) ?? [], usageByAssetId.get(asset.asset_id) ?? [], tokyoBase),
      ),
      pagination: {
        limit,
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

export async function handleAccountMembersList(req: Request, env: Env, accountIdRaw: string) {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const params = new URLSearchParams({
    select: 'account_id,user_id,role,created_at',
    account_id: `eq.${accountId}`,
    order: 'created_at.asc',
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_members?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
  }
  const rows = ((await res.json().catch(() => null)) as AccountMemberRow[] | null) ?? [];

  return json({
    accountId,
    role: authorized.role,
    members: rows.map((row) => ({
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at ?? null,
      updatedAt: null,
    })),
  });
}

export async function handleAccountNoticesList(req: Request, env: Env, accountIdRaw: string) {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const url = new URL(req.url);
  const statusRaw = (url.searchParams.get('status') || 'open').trim().toLowerCase();
  const status = statusRaw === 'dismissed' || statusRaw === 'resolved' ? statusRaw : 'open';

  const params = new URLSearchParams({
    select: 'notice_id,kind,status,payload,email_pending,created_at',
    account_id: `eq.${accountId}`,
    status: `eq.${status}`,
    order: 'created_at.desc',
    limit: '50',
  });
  const res = await supabaseFetch(env, `/rest/v1/account_notices?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
  }
  const rows = ((await res.json().catch(() => null)) as Array<Pick<AccountNoticeRow, 'notice_id' | 'kind' | 'payload' | 'email_pending' | 'created_at'>> | null) ?? [];

  return json({
    accountId,
    role: authorized.role,
    notices: rows.map((row) => ({
      noticeId: row.notice_id,
      kind: row.kind,
      payload: row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? (row.payload as Record<string, unknown>) : {},
      createdAt: row.created_at,
      emailPending: row.email_pending,
    })),
  });
}

export async function handleAccountNoticeDismiss(req: Request, env: Env, accountIdRaw: string, noticeIdRaw: string) {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const noticeIdResult = assertNoticeId(noticeIdRaw);
  if (!noticeIdResult.ok) return noticeIdResult.response;
  const noticeId = noticeIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const dismissed = await dismissAccountNotice({ env, accountId, noticeId });
  if (!dismissed.ok) return dismissed.response;
  return json({ ok: true, accountId, noticeId });
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

  const noticePayload: Record<string, unknown> = {
    fromTier: prevTier,
    toTier: nextTier,
    enforcement: {
      keptLivePublicIds: keepLivePublicIds,
      unpublishedCount: unpublished.length,
      assetsPurged,
      tokyoResync,
    },
  };
  const notice = await createAccountNotice({
    env,
    accountId,
    kind: 'tier_drop',
    payload: noticePayload,
    emailPending: true,
  });
  if (!notice.ok) return notice.response;

  return json({
    ok: true,
    accountId,
    noticeId: notice.notice.notice_id,
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

  const tokyoBase = resolveTokyoPublicAssetBase(env);

  try {
    const asset = await loadAccountAsset(env, accountId, assetId);
    if (!asset) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' }, 404);

    const [variantsByAssetId, usageByAssetId, integrity] = await Promise.all([
      loadVariantsByAssetIds(env, accountId, [assetId]),
      loadUsageByAssetIds(env, accountId, [assetId]),
      ensureTokyoAssetIdentityIntegrity(env, accountId, assetId),
    ]);
    if (!integrity.ok) return integrity.response;

    return json({
      accountId,
      asset: normalizeAccountAsset(asset, variantsByAssetId.get(assetId) ?? [], usageByAssetId.get(assetId) ?? [], tokyoBase),
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
    const existing = await loadAccountAsset(env, accountId, assetId);
    if (!existing) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' }, 404);

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
