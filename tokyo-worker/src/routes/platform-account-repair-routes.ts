import type { PolicyEntitlementsSnapshot, PolicyProfile } from '@clickeen/ck-policy';
import type { MemberRole } from '@clickeen/ck-policy';
import { normalizeLocale } from '../asset-utils';
import {
  requireDevAuth,
  TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL,
} from '../auth';
import { syncAccountInstance } from '../domains/account-instance-sync';
import {
  readInstanceServeState,
  writeSavedRenderConfig,
  writeSavedRenderL10nState,
} from '../domains/render';
import { json } from '../http';
import { isRecord, respondMethodNotAllowed, respondValidation, type TokyoRouteArgs } from '../route-helpers';
import { supabaseFetch } from '../supabase';

const DEFAULT_PLATFORM_ACCOUNT_ID = '00000000-0000-0000-0000-000000000100';
const PAGE_SIZE = 500;

type RepairRow = {
  publicId: string;
  accountId: string;
  widgetType: string;
  config: Record<string, unknown>;
  displayName: string | null;
  source: 'account' | 'curated';
  meta: Record<string, unknown> | null;
  dbStatus: 'published' | 'unpublished';
};

type AccountL10nIntent = {
  baseLocale: string;
  desiredLocales: string[];
  countryToLocale: Record<string, string>;
};

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asRecordOrNull(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function normalizeDesiredLocales(baseLocale: string, raw: unknown): string[] {
  const locales = Array.isArray(raw) ? raw : [];
  return Array.from(
    new Set(
      [baseLocale, ...locales]
        .map((entry) => normalizeLocale(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

function resolveBaseLocale(policy: unknown): string {
  if (!isRecord(policy)) return 'en';
  return normalizeLocale(policy.baseLocale) ?? 'en';
}

function resolveCountryToLocale(policy: unknown): Record<string, string> {
  const ip = isRecord(policy) && isRecord(policy.ip) ? policy.ip : null;
  const raw = ip && isRecord(ip.countryToLocale) ? ip.countryToLocale : null;
  if (!raw) return {};
  return Object.fromEntries(
    Object.entries(raw).flatMap(([countryRaw, localeRaw]) => {
      const country = countryRaw.trim().toUpperCase();
      const locale = normalizeLocale(localeRaw);
      if (!/^[A-Z]{2}$/.test(country) || !locale) return [];
      return [[country, locale] as const];
    }),
  );
}

async function readSupabaseRows<T>(args: {
  env: TokyoRouteArgs['env'];
  pathnameWithQuery: string;
}): Promise<T[]> {
  const response = await supabaseFetch(args.env, args.pathnameWithQuery, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || !Array.isArray(payload)) {
    throw new Error(`supabase_read_failed:${response.status}:${args.pathnameWithQuery}`);
  }
  return payload as T[];
}

async function loadAccountL10nIntent(args: {
  env: TokyoRouteArgs['env'];
  accountId: string;
}): Promise<AccountL10nIntent> {
  const rows = await readSupabaseRows<{
    l10n_locales?: unknown;
    l10n_policy?: unknown;
  }>({
    env: args.env,
    pathnameWithQuery:
      `/rest/v1/accounts?select=l10n_locales,l10n_policy&id=eq.${encodeURIComponent(args.accountId)}&limit=1`,
  });
  const row = rows[0] ?? null;
  const baseLocale = resolveBaseLocale(row?.l10n_policy);
  return {
    baseLocale,
    desiredLocales: normalizeDesiredLocales(baseLocale, row?.l10n_locales),
    countryToLocale: resolveCountryToLocale(row?.l10n_policy),
  };
}

async function loadPlatformRows(args: {
  env: TokyoRouteArgs['env'];
  accountId: string;
}): Promise<RepairRow[]> {
  const [widgets, accountRows, curatedRows] = await Promise.all([
    readSupabaseRows<{ id?: unknown; type?: unknown }>({
      env: args.env,
      pathnameWithQuery: `/rest/v1/widgets?select=id,type&limit=${PAGE_SIZE}`,
    }),
    readSupabaseRows<{
      public_id?: unknown;
      display_name?: unknown;
      widget_id?: unknown;
      account_id?: unknown;
      config?: unknown;
      status?: unknown;
    }>({
      env: args.env,
      pathnameWithQuery:
        `/rest/v1/widget_instances?select=public_id,display_name,widget_id,account_id,config,status&account_id=eq.${encodeURIComponent(args.accountId)}&order=created_at.asc&limit=${PAGE_SIZE}`,
    }),
    readSupabaseRows<{
      public_id?: unknown;
      widget_type?: unknown;
      owner_account_id?: unknown;
      config?: unknown;
      meta?: unknown;
      status?: unknown;
    }>({
      env: args.env,
      pathnameWithQuery:
        `/rest/v1/curated_widget_instances?select=public_id,widget_type,owner_account_id,config,meta,status&owner_account_id=eq.${encodeURIComponent(args.accountId)}&order=created_at.asc&limit=${PAGE_SIZE}`,
    }),
  ]);

  const widgetTypeById = new Map<string, string>();
  for (const row of widgets) {
    const widgetId = asTrimmedString(row.id);
    const widgetType = asTrimmedString(row.type);
    if (widgetId && widgetType) widgetTypeById.set(widgetId, widgetType);
  }

  const rows: RepairRow[] = [];
  for (const row of accountRows) {
    const publicId = asTrimmedString(row.public_id);
    const accountId = asTrimmedString(row.account_id)?.toLowerCase();
    const widgetType = widgetTypeById.get(asTrimmedString(row.widget_id) ?? '') ?? null;
    const config = asRecordOrNull(row.config);
    if (!publicId || accountId !== args.accountId || !widgetType || !config) continue;
    rows.push({
      publicId,
      accountId,
      widgetType,
      config,
      displayName: asTrimmedString(row.display_name) ?? publicId,
      source: 'account',
      meta: null,
      dbStatus: row.status === 'published' ? 'published' : 'unpublished',
    });
  }

  for (const row of curatedRows) {
    const publicId = asTrimmedString(row.public_id);
    const accountId = asTrimmedString(row.owner_account_id)?.toLowerCase();
    const widgetType = asTrimmedString(row.widget_type);
    const config = asRecordOrNull(row.config);
    if (!publicId || accountId !== args.accountId || !widgetType || !config) continue;
    rows.push({
      publicId,
      accountId,
      widgetType,
      config,
      displayName: null,
      source: 'curated',
      meta: row.meta === null || row.meta === undefined ? null : asRecordOrNull(row.meta),
      dbStatus: row.status === 'published' ? 'published' : 'unpublished',
    });
  }

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.publicId)) throw new Error(`duplicate_platform_public_id:${row.publicId}`);
    seen.add(row.publicId);
  }
  return rows;
}

function normalizePublicIdFilter(raw: unknown): Set<string> | null {
  if (!Array.isArray(raw)) return null;
  const values = raw.map((entry) => asTrimmedString(entry)).filter((entry): entry is string => Boolean(entry));
  return values.length ? new Set(values) : null;
}

export async function tryHandlePlatformAccountRepairRoute(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;
  if (pathname !== '/renders/ops/reconcile-platform-account-instances') return null;
  if (req.method !== 'POST') return respondMethodNotAllowed(respond);

  const authError = requireDevAuth(req, env, {
    allowTrustedInternalServices: [TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL],
  });
  if (authError) return respond(authError);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const accountId = (asTrimmedString(body?.accountId) ?? DEFAULT_PLATFORM_ACCOUNT_ID).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(accountId)) {
    return respondValidation(respond, 'tokyo.errors.render.invalid');
  }
  const dryRun = body?.dryRun === true;
  const publishRequested = body?.publish !== false;
  const translateRequested = body?.translate === true;
  const publicIdFilter = normalizePublicIdFilter(body?.publicIds);

  try {
    const [l10nIntent, loadedRows] = await Promise.all([
      loadAccountL10nIntent({ env, accountId }),
      loadPlatformRows({ env, accountId }),
    ]);
    const rows = publicIdFilter
      ? loadedRows.filter((row) => publicIdFilter.has(row.publicId))
      : loadedRows;
    const accountAuthz: {
      profile: PolicyProfile;
      role: MemberRole;
      entitlements: PolicyEntitlementsSnapshot | null;
    } = {
      profile: 'tier3',
      role: 'owner',
      entitlements: null,
    };
    const repaired = [];

    for (const row of rows) {
      if (dryRun) {
        repaired.push({
          publicId: row.publicId,
          source: row.source,
          dbStatus: row.dbStatus,
          repaired: false,
        });
        continue;
      }

      const saved = await writeSavedRenderConfig({
        env,
        publicId: row.publicId,
        accountId: row.accountId,
        widgetType: row.widgetType,
        config: row.config,
        displayName: row.displayName,
        source: row.source,
        meta: row.meta,
        l10n: {
          summary: {
            baseLocale: l10nIntent.baseLocale,
            desiredLocales: l10nIntent.desiredLocales,
          },
        },
      });

      let serveState = await readInstanceServeState({
        env,
        accountId: row.accountId,
        publicId: row.publicId,
      });
      if (publishRequested && row.dbStatus === 'published') {
        const publishIntent = translateRequested
          ? l10nIntent
          : {
              baseLocale: l10nIntent.baseLocale,
              desiredLocales: [l10nIntent.baseLocale],
              countryToLocale: {},
            };
        await syncAccountInstance({
          env,
          accountId: row.accountId,
          publicId: row.publicId,
          live: true,
          previousBaseFingerprint: saved.previousBaseFingerprint,
          accountAuthz,
          l10nIntent: publishIntent,
        });
        if (!translateRequested && saved.pointer.l10n?.baseFingerprint) {
          await writeSavedRenderL10nState({
            env,
            publicId: row.publicId,
            accountId: row.accountId,
            baseFingerprint: saved.pointer.l10n.baseFingerprint,
            summary: {
              baseLocale: l10nIntent.baseLocale,
              desiredLocales: l10nIntent.desiredLocales,
            },
          });
        }
        serveState = await readInstanceServeState({
          env,
          accountId: row.accountId,
          publicId: row.publicId,
        });
      }
      repaired.push({
        publicId: row.publicId,
        source: row.source,
        dbStatus: row.dbStatus,
        serveState,
        translatedDuringRepair: translateRequested,
        baseFingerprint: saved.pointer.l10n?.baseFingerprint ?? null,
      });
    }

    return respond(
      json({
        ok: true,
        accountId,
        dryRun,
        matchedCount: rows.length,
        repaired,
      }),
    );
  } catch (error) {
    return respond(
      json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'tokyo.errors.platformAccountRepairFailed',
            detail: error instanceof Error ? error.message : String(error),
          },
        },
        { status: 500 },
      ),
    );
  }
}
