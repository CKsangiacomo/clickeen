import { resolvePolicy, type Policy } from '@clickeen/ck-policy';
import type { BerlinAccountContext } from './account-state';
import { json, validationError } from './helpers';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env } from './types';

type AccountTier = BerlinAccountContext['tier'];

type LocalePolicy = {
  baseLocale: string;
  availableLocales: string[];
  ip: {
    enabled: boolean;
    countryToLocale: Record<string, string>;
  };
  switcher: {
    enabled: boolean;
  };
};

type TokyoMirrorQueueJob =
  | {
      v: 1;
      kind: 'delete-instance-mirror';
      publicId: string;
    }
  | {
      v: 1;
      kind: 'enforce-live-surface';
      publicId: string;
      localePolicy: LocalePolicy;
      seoGeo: boolean;
    };

type PublishedInstanceRow = {
  public_id?: unknown;
  status?: unknown;
  created_at?: unknown;
  config?: unknown;
};

type PublishedInstance = {
  publicId: string;
  createdAt: string | null;
  config: Record<string, unknown>;
};

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

type AccountL10nPolicy = {
  v: 1;
  baseLocale: string;
  ip: {
    enabled: boolean;
    countryToLocale: Record<string, string>;
  };
  switcher: {
    enabled: boolean;
  };
};

const DEFAULT_ACCOUNT_L10N_POLICY: AccountL10nPolicy = {
  v: 1,
  baseLocale: 'en',
  ip: { enabled: false, countryToLocale: {} },
  switcher: { enabled: true },
};

const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLocaleToken(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
  if (!value || !LOCALE_PATTERN.test(value)) return null;
  return value;
}

function normalizeLocaleList(
  value: unknown,
): { ok: true; locales: string[] } | { ok: false; issues: Array<{ path: string; message: string }> } {
  if (value == null) return { ok: true, locales: [] };
  if (!Array.isArray(value)) {
    return { ok: false, issues: [{ path: 'locales', message: 'locales must be an array' }] };
  }

  const locales: string[] = [];
  const issues: Array<{ path: string; message: string }> = [];
  const seen = new Set<string>();

  value.forEach((entry, index) => {
    const normalized = normalizeLocaleToken(entry);
    if (!normalized) {
      issues.push({ path: `locales[${index}]`, message: 'locale must be a valid token' });
      return;
    }
    if (seen.has(normalized)) return;
    seen.add(normalized);
    locales.push(normalized);
  });

  return issues.length > 0 ? { ok: false, issues } : { ok: true, locales };
}

function resolveAccountL10nPolicy(raw: unknown): AccountL10nPolicy {
  if (!isPlainRecord(raw) || raw.v !== 1) return DEFAULT_ACCOUNT_L10N_POLICY;

  const baseLocale = normalizeLocaleToken(raw.baseLocale) ?? DEFAULT_ACCOUNT_L10N_POLICY.baseLocale;
  const ipRaw = isPlainRecord(raw.ip) ? raw.ip : null;
  const ipEnabled = typeof ipRaw?.enabled === 'boolean' ? ipRaw.enabled : DEFAULT_ACCOUNT_L10N_POLICY.ip.enabled;
  const countryToLocale: Record<string, string> = {};

  const mapRaw = ipRaw && isPlainRecord(ipRaw.countryToLocale) ? ipRaw.countryToLocale : null;
  if (mapRaw) {
    for (const [countryRaw, localeRaw] of Object.entries(mapRaw)) {
      const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
      const locale = normalizeLocaleToken(localeRaw);
      if (!/^[A-Z]{2}$/.test(country) || !locale) continue;
      countryToLocale[country] = locale;
    }
  }

  const switcherRaw = isPlainRecord(raw.switcher) ? raw.switcher : null;
  const switcherEnabled =
    typeof switcherRaw?.enabled === 'boolean'
      ? switcherRaw.enabled
      : DEFAULT_ACCOUNT_L10N_POLICY.switcher.enabled;

  return {
    v: 1,
    baseLocale,
    ip: { enabled: ipEnabled, countryToLocale },
    switcher: { enabled: switcherEnabled },
  };
}

function normalizeAccountTier(value: unknown): AccountTier | null {
  switch (value) {
    case 'free':
    case 'tier1':
    case 'tier2':
    case 'tier3':
      return value;
    default:
      return null;
  }
}

function tierRank(value: unknown): number {
  switch (normalizeAccountTier(value)) {
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

function hasConfirmedQueryParam(request: Request, key = 'confirm'): boolean {
  const raw = new URL(request.url).searchParams.get(key);
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function normalizePublicIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  raw.forEach((entry) => {
    const value = asTrimmedString(entry);
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  });
  return out;
}

function resolveLocaleEntitlementMax(policy: Policy): number | null {
  const raw = policy.caps['l10n.locales.max'];
  return raw == null ? null : Math.max(1, Math.floor(raw));
}

function resolveActivePublishLocales(args: {
  accountLocales: unknown;
  policy: Policy;
  baseLocale: string;
}): { locales: string[]; invalidAccountLocales: string | null } {
  const normalized = normalizeLocaleList(args.accountLocales);
  const additionalLocales = normalized.ok ? normalized.locales : [];
  const baseLocale = normalizeLocaleToken(args.baseLocale) ?? 'en';
  const maxLocalesTotal = resolveLocaleEntitlementMax(args.policy);
  const locales = Array.from(new Set([baseLocale, ...additionalLocales]));
  return {
    locales: maxLocalesTotal == null ? locales : locales.slice(0, maxLocalesTotal),
    invalidAccountLocales: normalized.ok ? null : JSON.stringify(normalized.issues),
  };
}

function buildTierDropLocalePolicy(args: {
  account: BerlinAccountContext;
  policy: Policy;
}): LocalePolicy {
  const accountPolicy = resolveAccountL10nPolicy(args.account.l10nPolicy);
  const publishLocales = resolveActivePublishLocales({
    accountLocales: args.account.l10nLocales,
    policy: args.policy,
    baseLocale: accountPolicy.baseLocale,
  });
  if (publishLocales.invalidAccountLocales) {
    console.warn('[Berlin] invalid account locales while enforcing plan change', {
      accountId: args.account.accountId,
      invalidAccountLocales: publishLocales.invalidAccountLocales,
    });
  }

  const availableLocales = publishLocales.locales;
  const countryToLocale = Object.fromEntries(
    Object.entries(accountPolicy.ip.countryToLocale).filter(([, locale]) => availableLocales.includes(locale)),
  );

  return {
    baseLocale: accountPolicy.baseLocale,
    availableLocales,
    ip: {
      enabled: accountPolicy.ip.enabled,
      countryToLocale: accountPolicy.ip.enabled ? countryToLocale : {},
    },
    switcher: {
      enabled: accountPolicy.switcher.enabled,
    },
  };
}

function isSeoGeoEntitled(policy: Policy | null | undefined): boolean {
  return policy?.flags?.['embed.seoGeo.enabled'] === true;
}

function isSeoGeoConfigEnabled(config: unknown): boolean {
  if (!isPlainRecord(config)) return false;
  const seoGeo = isPlainRecord(config.seoGeo) ? config.seoGeo : null;
  return seoGeo?.enabled === true;
}

function isSeoGeoLive(args: { policy: Policy; config: unknown }): boolean {
  return isSeoGeoEntitled(args.policy) && isSeoGeoConfigEnabled(args.config);
}

async function patchAccount(
  env: Env,
  accountId: string,
  body: Record<string, unknown>,
): Promise<Result<void>> {
  const params = new URLSearchParams({ id: `eq.${accountId}` });
  const response = await supabaseAdminFetch(env, `/rest/v1/accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  const payload = await readSupabaseAdminJson<Array<{ id?: unknown }> | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
    };
  }
  const rows = Array.isArray(payload) ? payload : [];
  if (!rows[0]?.id) {
    return {
      ok: false,
      response: json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' } },
        { status: 404 },
      ),
    };
  }
  return { ok: true, value: undefined };
}

async function loadPublishedInstances(
  env: Env,
  accountId: string,
): Promise<Result<PublishedInstance[]>> {
  const out: PublishedInstance[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      select: 'public_id,status,created_at,config',
      account_id: `eq.${accountId}`,
      status: 'eq.published',
      order: 'created_at.desc',
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await supabaseAdminFetch(env, `/rest/v1/widget_instances?${params.toString()}`, {
      method: 'GET',
    });
    const payload = await readSupabaseAdminJson<PublishedInstanceRow[] | Record<string, unknown>>(response);
    if (!response.ok) {
      return {
        ok: false,
        response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
      };
    }

    const rows = Array.isArray(payload) ? payload : [];
    let invalidConfigPublicId: string | null = null;
    rows.forEach((row) => {
      const publicId = asTrimmedString(row.public_id);
      if (!publicId || row.status !== 'published') return;
      const config = isPlainRecord(row.config) ? row.config : null;
      if (!config) {
        invalidConfigPublicId = publicId;
        return;
      }
      out.push({
        publicId,
        createdAt: asTrimmedString(row.created_at),
        config,
      });
    });
    if (invalidConfigPublicId) {
      return {
        ok: false,
        response: json(
          {
            error: {
              kind: 'INTERNAL',
              reasonKey: 'coreui.errors.config.invalid',
              detail: `published instance config invalid (${invalidConfigPublicId})`,
            },
          },
          { status: 500 },
        ),
      };
    }

    if (rows.length < pageSize) break;
  }

  return { ok: true, value: out };
}

async function enqueueTokyoMirrorJob(
  env: Env,
  job: TokyoMirrorQueueJob,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!env.RENDER_SNAPSHOT_QUEUE) {
    return { ok: false, error: 'RENDER_SNAPSHOT_QUEUE missing' };
  }
  try {
    await env.RENDER_SNAPSHOT_QUEUE.send(job);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function unpublishAccountInstances(args: {
  env: Env;
  accountId: string;
  keepLivePublicIds: string[];
  publishedInstances: PublishedInstance[];
}): Promise<
  Result<{
    unpublished: string[];
    tokyo: { deleteEnqueued: number; failed: string[] };
  }>
> {
  const publishedPublicIds = args.publishedInstances.map((entry) => entry.publicId);
  const publishedSet = new Set(publishedPublicIds);
  const invalidKeeps = args.keepLivePublicIds.filter((publicId) => !publishedSet.has(publicId));
  if (invalidKeeps.length > 0) {
    return {
      ok: false,
      response: validationError(
        'coreui.errors.payload.invalid',
        `keepLivePublicIds contains unknown or non-live publicId: ${invalidKeeps[0]}`,
      ),
    };
  }

  const keepSet = new Set(args.keepLivePublicIds);
  const toUnpublish = publishedPublicIds.filter((publicId) => !keepSet.has(publicId));
  if (toUnpublish.length === 0) {
    return {
      ok: true,
      value: {
        unpublished: [],
        tokyo: { deleteEnqueued: 0, failed: [] },
      },
    };
  }

  const params = new URLSearchParams({
    public_id: `in.(${toUnpublish.map((publicId) => encodeURIComponent(publicId)).join(',')})`,
    account_id: `eq.${args.accountId}`,
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/widget_instances?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'unpublished' }),
  });
  const payload = await readSupabaseAdminJson<Record<string, unknown> | Array<{ public_id?: unknown }>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
    };
  }

  const failed: string[] = [];
  for (const publicId of toUnpublish) {
    const enqueue = await enqueueTokyoMirrorJob(args.env, {
      v: 1,
      kind: 'delete-instance-mirror',
      publicId,
    });
    if (!enqueue.ok) {
      failed.push(publicId);
      console.error('[Berlin] tokyo delete-instance-mirror enqueue failed', {
        publicId,
        error: enqueue.error,
      });
    }
  }

  return {
    ok: true,
    value: {
      unpublished: toUnpublish,
      tokyo: {
        deleteEnqueued: Math.max(0, toUnpublish.length - failed.length),
        failed,
      },
    },
  };
}

async function enforceTierDropMirrorForKeptInstances(args: {
  env: Env;
  account: BerlinAccountContext;
  policy: Policy;
  keepLivePublicIds: string[];
  publishedInstances: PublishedInstance[];
}): Promise<{
  syncEnqueued: number;
  failed: string[];
  failedDetails: Record<string, string>;
}> {
  if (args.keepLivePublicIds.length === 0) {
    return { syncEnqueued: 0, failed: [], failedDetails: {} };
  }

  const keepSet = new Set(args.keepLivePublicIds);
  const rows = args.publishedInstances.filter((entry) => keepSet.has(entry.publicId));
  const localePolicy = buildTierDropLocalePolicy({
    account: args.account,
    policy: args.policy,
  });

  const failed: string[] = [];
  const failedDetails: Record<string, string> = {};

  for (const row of rows) {
    const enqueue = await enqueueTokyoMirrorJob(args.env, {
      v: 1,
      kind: 'enforce-live-surface',
      publicId: row.publicId,
      localePolicy,
      seoGeo: isSeoGeoLive({ policy: args.policy, config: row.config }),
    });
    if (!enqueue.ok) {
      failed.push(row.publicId);
      failedDetails[row.publicId] = enqueue.error;
      console.error('[Berlin] tokyo enforce-live-surface enqueue failed (plan change)', {
        publicId: row.publicId,
        error: enqueue.error,
      });
    }
  }

  return {
    syncEnqueued: Math.max(0, rows.length - failed.length),
    failed,
    failedDetails,
  };
}

async function recordTierDropLifecycleState(args: {
  env: Env;
  accountId: string;
  fromTier: AccountTier;
  toTier: AccountTier;
  emailPending: boolean;
}): Promise<Result<void>> {
  const now = new Date().toISOString();
  return patchAccount(args.env, args.accountId, {
    tier_changed_at: now,
    tier_changed_from: args.fromTier,
    tier_changed_to: args.toTier,
    tier_drop_dismissed_at: null,
    tier_drop_email_sent_at: args.emailPending ? null : now,
  });
}

export async function handleAccountTierDropDismiss(args: {
  env: Env;
  accountId: string;
}): Promise<Response> {
  const dismissed = await patchAccount(args.env, args.accountId, {
    tier_drop_dismissed_at: new Date().toISOString(),
  });
  if (!dismissed.ok) return dismissed.response;

  return json({
    ok: true,
    accountId: args.accountId,
    kind: 'tier_drop',
  });
}

export async function handleAccountTierUpdate(args: {
  request: Request;
  env: Env;
  account: BerlinAccountContext;
}): Promise<Response> {
  if (!hasConfirmedQueryParam(args.request)) {
    return json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.errors.payload.invalid',
          detail: 'confirm=1 is required to apply a plan change.',
        },
      },
      { status: 409 },
    );
  }

  let payload: unknown;
  try {
    payload = await args.request.json();
  } catch {
    payload = null;
  }
  if (!isPlainRecord(payload)) {
    return validationError('coreui.errors.payload.invalid');
  }

  const nextTier = normalizeAccountTier(payload.nextTier);
  if (!nextTier) {
    return validationError('coreui.errors.payload.invalid');
  }

  const keepLivePublicIdsRaw = payload.keepLivePublicIds;
  const keepLivePublicIdsInput =
    keepLivePublicIdsRaw === undefined ? null : normalizePublicIdList(keepLivePublicIdsRaw);

  const prevTier = args.account.tier;
  const isTierDrop = tierRank(nextTier) < tierRank(prevTier);

  const tierUpdated = await patchAccount(args.env, args.account.accountId, { tier: nextTier });
  if (!tierUpdated.ok) return tierUpdated.response;

  if (!isTierDrop) {
    return json({
      ok: true,
      accountId: args.account.accountId,
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
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail: 'instances.published.max invalid',
        },
      },
      { status: 500 },
    );
  }

  const publishedInstances = await loadPublishedInstances(args.env, args.account.accountId);
  if (!publishedInstances.ok) return publishedInstances.response;

  const publishedPublicIds = publishedInstances.value.map((entry) => entry.publicId);
  let keepLivePublicIds: string[] = [];
  if (maxPublished == null) {
    keepLivePublicIds = publishedPublicIds;
  } else if (keepLivePublicIdsInput) {
    if (keepLivePublicIdsInput.length > maxPublished) {
      return validationError(
        'coreui.errors.payload.invalid',
        `keepLivePublicIds exceeds instances.published.max (${maxPublished})`,
      );
    }
    keepLivePublicIds = keepLivePublicIdsInput;
  } else {
    keepLivePublicIds = publishedPublicIds.slice(0, maxPublished);
  }

  let unpublished: string[] = [];
  let tokyo = { deleteEnqueued: 0, failed: [] as string[] };
  if (maxPublished != null) {
    const unpublish = await unpublishAccountInstances({
      env: args.env,
      accountId: args.account.accountId,
      keepLivePublicIds,
      publishedInstances: publishedInstances.value,
    });
    if (!unpublish.ok) return unpublish.response;
    unpublished = unpublish.value.unpublished;
    tokyo = unpublish.value.tokyo;
  }

  const tokyoResync = await enforceTierDropMirrorForKeptInstances({
    env: args.env,
    account: { ...args.account, tier: nextTier },
    policy,
    keepLivePublicIds,
    publishedInstances: publishedInstances.value,
  });

  const lifecycle = await recordTierDropLifecycleState({
    env: args.env,
    accountId: args.account.accountId,
    fromTier: prevTier,
    toTier: nextTier,
    emailPending: true,
  });
  if (!lifecycle.ok) return lifecycle.response;

  return json({
    ok: true,
    accountId: args.account.accountId,
    noticeId: 'tier_drop',
    fromTier: prevTier,
    toTier: nextTier,
    isTierDrop: true,
    keptLivePublicIds: keepLivePublicIds,
    unpublished,
    tokyo,
    tokyoResync,
  });
}
