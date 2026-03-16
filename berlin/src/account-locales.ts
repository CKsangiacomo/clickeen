import { normalizeCanonicalLocalesFile, normalizeLocaleToken } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { resolvePolicy, type Policy } from '@clickeen/ck-policy';
import type { BerlinAccountContext } from './account-state.types';
import { json, validationError } from './helpers';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env } from './types';

type AccountL10nPolicy = {
  v: 1;
  baseLocale: string;
  ip: {
    enabled: boolean;
    countryToLocale: Record<string, string>;
  };
  switcher: {
    enabled: boolean;
    locales?: string[];
  };
};

type LocaleMutationResult =
  | { ok: true; warnings: string[] }
  | { ok: false; response: Response };

const SUPPORTED_LOCALES = new Set(normalizeCanonicalLocalesFile(localesJson).map((entry) => entry.code));

const DEFAULT_ACCOUNT_L10N_POLICY: AccountL10nPolicy = {
  v: 1,
  baseLocale: 'en',
  ip: { enabled: false, countryToLocale: {} },
  switcher: { enabled: true },
};

function canManageAccountLocales(role: BerlinAccountContext['role']): boolean {
  return role === 'owner' || role === 'admin';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSupportedLocaleToken(raw: unknown): string | null {
  const normalized = normalizeLocaleToken(raw);
  if (!normalized) return null;
  return SUPPORTED_LOCALES.has(normalized) ? normalized : null;
}

function normalizeLocaleList(
  value: unknown,
  path: string,
): { ok: true; locales: string[] } | { ok: false; issues: Array<{ path: string; message: string }> } {
  if (value == null) return { ok: true, locales: [] };
  if (!Array.isArray(value)) {
    return { ok: false, issues: [{ path, message: 'locales must be an array' }] };
  }

  const locales: string[] = [];
  const issues: Array<{ path: string; message: string }> = [];
  const seen = new Set<string>();

  value.forEach((entry, index) => {
    const normalized = normalizeSupportedLocaleToken(entry);
    if (!normalized) {
      issues.push({ path: `${path}[${index}]`, message: 'locale must be a supported locale token' });
      return;
    }
    if (seen.has(normalized)) return;
    seen.add(normalized);
    locales.push(normalized);
  });

  return issues.length ? { ok: false, issues } : { ok: true, locales };
}

function resolveAccountL10nPolicy(raw: unknown): AccountL10nPolicy {
  if (!isPlainRecord(raw) || raw.v !== 1) return DEFAULT_ACCOUNT_L10N_POLICY;

  const baseLocale = normalizeSupportedLocaleToken(raw.baseLocale) ?? DEFAULT_ACCOUNT_L10N_POLICY.baseLocale;
  const ipRaw = isPlainRecord(raw.ip) ? raw.ip : null;
  const ipEnabled = typeof ipRaw?.enabled === 'boolean' ? ipRaw.enabled : DEFAULT_ACCOUNT_L10N_POLICY.ip.enabled;
  const countryToLocale: Record<string, string> = {};

  const mapRaw = ipRaw && isPlainRecord(ipRaw.countryToLocale) ? ipRaw.countryToLocale : null;
  if (mapRaw) {
    for (const [countryRaw, localeRaw] of Object.entries(mapRaw)) {
      const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
      const locale = normalizeSupportedLocaleToken(localeRaw);
      if (!/^[A-Z]{2}$/.test(country) || !locale) continue;
      countryToLocale[country] = locale;
    }
  }

  const switcherRaw = isPlainRecord(raw.switcher) ? raw.switcher : null;
  const switcherEnabled =
    typeof switcherRaw?.enabled === 'boolean'
      ? switcherRaw.enabled
      : DEFAULT_ACCOUNT_L10N_POLICY.switcher.enabled;
  const switcherLocalesResult = switcherRaw ? normalizeLocaleList(switcherRaw.locales, 'policy.switcher.locales') : null;
  const switcherLocales = switcherLocalesResult?.ok ? switcherLocalesResult.locales : [];

  return {
    v: 1,
    baseLocale,
    ip: { enabled: ipEnabled, countryToLocale },
    switcher: {
      enabled: switcherEnabled,
      ...(switcherLocales.length ? { locales: switcherLocales } : {}),
    },
  };
}

function parseAccountL10nPolicy(
  raw: unknown,
): { ok: true; policy: AccountL10nPolicy } | { ok: false; issues: Array<{ path: string; message: string }> } {
  if (!isPlainRecord(raw)) {
    return { ok: false, issues: [{ path: 'policy', message: 'policy must be an object' }] };
  }
  if (raw.v !== 1) {
    return { ok: false, issues: [{ path: 'policy.v', message: 'policy.v must be 1' }] };
  }

  const issues: Array<{ path: string; message: string }> = [];
  const baseLocale = normalizeSupportedLocaleToken(raw.baseLocale);
  if (!baseLocale) {
    issues.push({ path: 'policy.baseLocale', message: 'baseLocale must be a supported locale token' });
  }

  const ipRaw = isPlainRecord(raw.ip) ? raw.ip : null;
  const ipEnabled = typeof ipRaw?.enabled === 'boolean' ? ipRaw.enabled : DEFAULT_ACCOUNT_L10N_POLICY.ip.enabled;
  const countryToLocale: Record<string, string> = {};

  if (ipRaw && Object.prototype.hasOwnProperty.call(ipRaw, 'countryToLocale')) {
    if (!isPlainRecord(ipRaw.countryToLocale)) {
      issues.push({ path: 'policy.ip.countryToLocale', message: 'countryToLocale must be an object' });
    } else {
      for (const [countryRaw, localeRaw] of Object.entries(ipRaw.countryToLocale)) {
        const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
        if (!/^[A-Z]{2}$/.test(country)) {
          issues.push({
            path: `policy.ip.countryToLocale.${countryRaw}`,
            message: 'country key must be ISO-3166 alpha-2',
          });
          continue;
        }
        const locale = normalizeSupportedLocaleToken(localeRaw);
        if (!locale) {
          issues.push({
            path: `policy.ip.countryToLocale.${country}`,
            message: 'locale must be a supported locale token',
          });
          continue;
        }
        countryToLocale[country] = locale;
      }
    }
  }

  const switcherRaw = isPlainRecord(raw.switcher) ? raw.switcher : null;
  const switcherEnabled =
    typeof switcherRaw?.enabled === 'boolean'
      ? switcherRaw.enabled
      : DEFAULT_ACCOUNT_L10N_POLICY.switcher.enabled;
  let switcherLocales: string[] = [];
  if (switcherRaw && Object.prototype.hasOwnProperty.call(switcherRaw, 'locales')) {
    const localesResult = normalizeLocaleList(switcherRaw.locales, 'policy.switcher.locales');
    if (!localesResult.ok) {
      issues.push(...localesResult.issues);
    } else {
      switcherLocales = localesResult.locales;
    }
  }

  if (issues.length) return { ok: false, issues };

  return {
    ok: true,
    policy: {
      v: 1,
      baseLocale: baseLocale!,
      ip: { enabled: ipEnabled, countryToLocale },
      switcher: {
        enabled: switcherEnabled,
        ...(switcherLocales.length ? { locales: switcherLocales } : {}),
      },
    },
  };
}

function resolveLocaleEntitlementMax(policy: Policy): number | null {
  const raw = policy.caps['l10n.locales.max'];
  return raw == null ? null : Math.max(1, Math.floor(raw));
}

function enforceL10nSelection(policy: Policy, locales: string[]): Response | null {
  const maxLocalesTotal = resolveLocaleEntitlementMax(policy);
  const maxAdditional = maxLocalesTotal == null ? null : Math.max(0, maxLocalesTotal - 1);
  if (maxAdditional != null && locales.length > maxAdditional) {
    return json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.upsell.reason.capReached',
          upsell: 'UP',
          detail: `l10n.locales.max=${maxLocalesTotal}`,
        },
      },
      { status: 403 },
    );
  }

  const maxCustomRaw = policy.caps['l10n.locales.custom.max'];
  const maxCustom = maxCustomRaw == null ? null : Math.max(0, Math.floor(maxCustomRaw));
  if (maxCustom != null) {
    const systemReserved = maxAdditional == null ? 0 : Math.max(0, maxAdditional - maxCustom);
    const customCount = Math.max(0, locales.length - systemReserved);
    if (customCount > maxCustom) {
      return json(
        {
          error: {
            kind: 'DENY',
            reasonKey: 'coreui.upsell.reason.capReached',
            upsell: 'UP',
            detail: `l10n.locales.custom.max=${maxCustom}`,
          },
        },
        { status: 403 },
      );
    }
  }

  return null;
}

function resolveActivePublishLocales(args: {
  accountLocales: unknown;
  baseLocale: string;
}): string[] {
  const normalized = normalizeLocaleList(args.accountLocales, 'l10n_locales');
  const additionalLocales = normalized.ok ? normalized.locales : [];
  const baseLocale = normalizeSupportedLocaleToken(args.baseLocale) ?? 'en';
  const locales = Array.from(new Set([baseLocale, ...additionalLocales]));
  return locales;
}

async function patchAccountLocales(args: {
  env: Env;
  accountId: string;
  locales: string[];
  nextPolicy: AccountL10nPolicy | null;
}): Promise<LocaleMutationResult> {
  const params = new URLSearchParams({ id: `eq.${args.accountId}` });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      l10n_locales: args.locales,
      l10n_policy: args.nextPolicy,
    }),
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
      response: json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' } }, { status: 404 }),
    };
  }
  return { ok: true, warnings: [] };
}

export async function handleAccountLocalesUpdate(args: {
  request: Request;
  env: Env;
  account: BerlinAccountContext;
}): Promise<Response> {
  if (!canManageAccountLocales(args.account.role)) {
    return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 });
  }

  let payload: unknown = null;
  try {
    payload = await args.request.json();
  } catch {
    return validationError('coreui.errors.payload.invalidJson');
  }
  if (!isPlainRecord(payload)) {
    return validationError('coreui.errors.payload.invalid');
  }

  const localesResult = normalizeLocaleList((payload as { locales?: unknown }).locales, 'locales');
  if (!localesResult.ok) {
    return json(localesResult.issues, { status: 422 });
  }

  const policy = resolvePolicy({ profile: args.account.tier, role: args.account.role });
  const entitlementGate = enforceL10nSelection(policy, localesResult.locales);
  if (entitlementGate) return entitlementGate;

  let nextPolicyPersisted: unknown = args.account.l10nPolicy;
  if (Object.prototype.hasOwnProperty.call(payload, 'policy')) {
    const policyRaw = (payload as { policy?: unknown }).policy;
    if (policyRaw != null) {
      const parsed = parseAccountL10nPolicy(policyRaw);
      if (!parsed.ok) return json(parsed.issues, { status: 422 });
      nextPolicyPersisted = parsed.policy;
    } else {
      nextPolicyPersisted = null;
    }
  }

  const previousLocales = normalizeLocaleList(args.account.l10nLocales, 'l10n_locales');
  if (!previousLocales.ok) {
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.account.locales.invalid',
          detail: JSON.stringify(previousLocales.issues),
        },
      },
      { status: 500 },
    );
  }

  const nextPolicy = resolveAccountL10nPolicy(nextPolicyPersisted);
  const nextAvailable = resolveActivePublishLocales({
    accountLocales: localesResult.locales,
    baseLocale: nextPolicy.baseLocale,
  });
  const nextAvailableSet = new Set(nextAvailable);
  const invalidSwitcherLocales = Array.isArray(nextPolicy.switcher.locales)
    ? nextPolicy.switcher.locales.filter((locale) => !nextAvailableSet.has(locale))
    : [];
  if (invalidSwitcherLocales.length > 0) {
    return json(
      invalidSwitcherLocales.map((locale, index) => ({
        path: `policy.switcher.locales[${index}]`,
        message: `switcher locale must be enabled on the account: ${locale}`,
      })),
      { status: 422 },
    );
  }
  const patched = await patchAccountLocales({
    env: args.env,
    accountId: args.account.accountId,
    locales: localesResult.locales,
    nextPolicy: nextPolicyPersisted as AccountL10nPolicy | null,
  });
  if (!patched.ok) return patched.response;

  const warnings = [...patched.warnings];

  return json({
    accountId: args.account.accountId,
    locales: localesResult.locales,
    policy: nextPolicy,
    warnings: warnings.length ? warnings : undefined,
  });
}
