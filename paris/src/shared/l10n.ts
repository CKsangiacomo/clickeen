import { normalizeLocaleToken } from '@clickeen/l10n';
import supportedLocalesRaw from '@clickeen/l10n/locales.json';
import type { Env, L10nAllowlistEntry, L10nAllowlistFile } from './types';
import { requireTokyoBase } from './tokyo';

export const L10N_ALLOWED_SOURCES = new Set(['agent', 'manual', 'import', 'user']);
export const L10N_PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
export const L10N_LAYER_ALLOWED = new Set(['locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user']);
export const L10N_MAX_OPS = 1000;
export const L10N_MAX_OVERLAY_BYTES = 1024 * 1024;
export const L10N_MAX_OP_VALUE_BYTES = 100 * 1024;

export function resolveUserOps(row: { user_ops?: Array<{ op: 'set'; path: string; value: unknown }> } | null) {
  const userOps = Array.isArray(row?.user_ops) ? row.user_ops : [];
  return { userOps };
}

export function normalizeSupportedLocales(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new Error('[ParisWorker] packages/l10n/locales.json must be an array of locale entries');
  }
  const locales = raw
    .map((entry) => {
      if (typeof entry === 'string') return normalizeLocaleToken(entry);
      if (entry && typeof entry === 'object' && typeof (entry as any).code === 'string') {
        return normalizeLocaleToken((entry as any).code);
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
  const unique = Array.from(new Set(locales));
  if (unique.length === 0) {
    throw new Error('[ParisWorker] packages/l10n/locales.json must include at least one locale');
  }
  return unique;
}

export const SUPPORTED_LOCALES = normalizeSupportedLocales(supportedLocalesRaw);
export const SUPPORTED_LOCALE_SET = new Set(SUPPORTED_LOCALES);

export function normalizeLocaleList(value: unknown, path: string) {
  if (value == null) {
    return { ok: true as const, locales: [] as string[] };
  }
  if (!Array.isArray(value)) {
    return { ok: false as const, issues: [{ path, message: 'locales must be an array' }] };
  }

  const locales: string[] = [];
  const issues: Array<{ path: string; message: string }> = [];
  const seen = new Set<string>();

  value.forEach((item, index) => {
    const normalized = normalizeLocaleToken(item);
    if (!normalized) {
      issues.push({ path: `${path}[${index}]`, message: 'locale must be a valid token' });
      return;
    }
    if (!SUPPORTED_LOCALE_SET.has(normalized)) {
      issues.push({ path: `${path}[${index}]`, message: `unsupported locale: ${normalized}` });
      return;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      locales.push(normalized);
    }
  });

  if (issues.length) return { ok: false as const, issues };
  return { ok: true as const, locales };
}

export function normalizeSupportedLocaleToken(raw: unknown): string | null {
  const normalized = normalizeLocaleToken(raw);
  if (!normalized) return null;
  if (!SUPPORTED_LOCALE_SET.has(normalized)) return null;
  return normalized;
}

export type AccountL10nPolicy = {
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

export const DEFAULT_ACCOUNT_L10N_POLICY: AccountL10nPolicy = {
  v: 1,
  baseLocale: 'en',
  ip: { enabled: false, countryToLocale: {} },
  switcher: { enabled: true },
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function resolveAccountL10nPolicy(raw: unknown): AccountL10nPolicy {
  if (!isPlainRecord(raw) || raw.v !== 1) return DEFAULT_ACCOUNT_L10N_POLICY;

  const baseLocale = normalizeSupportedLocaleToken(raw.baseLocale) ?? DEFAULT_ACCOUNT_L10N_POLICY.baseLocale;

  const ipRaw = isPlainRecord(raw.ip) ? raw.ip : null;
  const ipEnabled = typeof ipRaw?.enabled === 'boolean' ? ipRaw.enabled : DEFAULT_ACCOUNT_L10N_POLICY.ip.enabled;
  const countryToLocale: Record<string, string> = {};
  const mapRaw = ipRaw && isPlainRecord(ipRaw.countryToLocale) ? ipRaw.countryToLocale : null;
  if (mapRaw) {
    for (const [countryRaw, localeRaw] of Object.entries(mapRaw)) {
      const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
      if (!/^[A-Z]{2}$/.test(country)) continue;
      const locale = normalizeSupportedLocaleToken(localeRaw);
      if (!locale) continue;
      countryToLocale[country] = locale;
    }
  }

  const switcherRaw = isPlainRecord(raw.switcher) ? raw.switcher : null;
  const switcherEnabled =
    typeof switcherRaw?.enabled === 'boolean' ? switcherRaw.enabled : DEFAULT_ACCOUNT_L10N_POLICY.switcher.enabled;

  return {
    v: 1,
    baseLocale,
    ip: { enabled: ipEnabled, countryToLocale },
    switcher: { enabled: switcherEnabled },
  };
}

export function parseAccountL10nPolicy(raw: unknown): { ok: true; policy: AccountL10nPolicy } | { ok: false; issues: Array<{ path: string; message: string }> } {
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

  const ipRaw = raw.ip;
  const ip = isPlainRecord(ipRaw) ? ipRaw : null;
  const ipEnabled = ip && typeof ip.enabled === 'boolean' ? ip.enabled : DEFAULT_ACCOUNT_L10N_POLICY.ip.enabled;
  const countryToLocale: Record<string, string> = {};
  if (ip && Object.prototype.hasOwnProperty.call(ip, 'countryToLocale')) {
    const mapRaw = ip.countryToLocale;
    if (!isPlainRecord(mapRaw)) {
      issues.push({ path: 'policy.ip.countryToLocale', message: 'countryToLocale must be an object' });
    } else {
      for (const [countryRaw, localeRaw] of Object.entries(mapRaw)) {
        const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
        if (!/^[A-Z]{2}$/.test(country)) {
          issues.push({ path: `policy.ip.countryToLocale.${countryRaw}`, message: 'country key must be ISO-3166 alpha-2' });
          continue;
        }
        const locale = normalizeSupportedLocaleToken(localeRaw);
        if (!locale) {
          issues.push({ path: `policy.ip.countryToLocale.${country}`, message: 'locale must be a supported locale token' });
          continue;
        }
        countryToLocale[country] = locale;
      }
    }
  }

  const switcherRaw = raw.switcher;
  const switcher = isPlainRecord(switcherRaw) ? switcherRaw : null;
  const switcherEnabled =
    switcher && typeof switcher.enabled === 'boolean' ? switcher.enabled : DEFAULT_ACCOUNT_L10N_POLICY.switcher.enabled;

  if (issues.length) return { ok: false, issues };

  return {
    ok: true,
    policy: {
      v: 1,
      baseLocale: baseLocale!,
      ip: { enabled: ipEnabled, countryToLocale },
      switcher: { enabled: switcherEnabled },
    },
  };
}

export function normalizeL10nSource(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!value) return null;
  if (!L10N_ALLOWED_SOURCES.has(value)) return null;
  return value;
}

export function normalizeGeoCountries(raw: unknown, path: string) {
  if (raw == null) {
    return { ok: true as const, geoCountries: null as string[] | null };
  }
  if (!Array.isArray(raw)) {
    return { ok: false as const, issues: [{ path, message: 'geoCountries must be an array' }] };
  }

  const geoCountries: string[] = [];
  const seen = new Set<string>();
  const issues: Array<{ path: string; message: string }> = [];

  raw.forEach((value, index) => {
    const trimmed = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!trimmed || !/^[A-Z]{2}$/.test(trimmed)) {
      issues.push({ path: `${path}[${index}]`, message: 'geoCountries must be ISO-3166 alpha-2 codes' });
      return;
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      geoCountries.push(trimmed);
    }
  });

  if (issues.length) return { ok: false as const, issues };
  return { ok: true as const, geoCountries: geoCountries.length ? geoCountries : null };
}

const LAYER_KEY_SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_EXPERIMENT = /^exp_[a-z0-9][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_BEHAVIOR = /^behavior_[a-z0-9][a-z0-9_-]*$/;

export function normalizeLayer(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!value || !L10N_LAYER_ALLOWED.has(value)) return null;
  return value;
}

export function normalizeLayerKey(layer: string, raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  switch (layer) {
    case 'locale': {
      return normalizeSupportedLocaleToken(value);
    }
    case 'geo': {
      const upper = value.toUpperCase();
      return /^[A-Z]{2}$/.test(upper) ? upper : null;
    }
    case 'industry': {
      const lower = value.toLowerCase();
      return LAYER_KEY_SLUG.test(lower) ? lower : null;
    }
    case 'experiment': {
      const lower = value.toLowerCase();
      return LAYER_KEY_EXPERIMENT.test(lower) ? lower : null;
    }
    case 'account': {
      const lower = value.toLowerCase();
      return LAYER_KEY_SLUG.test(lower) ? lower : null;
    }
    case 'behavior': {
      const lower = value.toLowerCase();
      return LAYER_KEY_BEHAVIOR.test(lower) ? lower : null;
    }
    case 'user': {
      if (value === 'global') return 'global';
      return normalizeSupportedLocaleToken(value);
    }
    default:
      return null;
  }
}

export function hasLocaleSuffix(publicId: string, locale: string): boolean {
  const lower = publicId.toLowerCase();
  return lower.endsWith(`.${locale}`) || lower.endsWith(`-${locale}`);
}

export function hasProhibitedSegment(pathStr: string): boolean {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && L10N_PROHIBITED_SEGMENTS.has(seg));
}

export function normalizeOpPath(raw: string): string {
  return String(raw || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');
}

function splitPathSegments(pathStr: string): string[] {
  return String(pathStr || '')
    .split('.')
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function isNumericSegment(seg: string): boolean {
  return /^\d+$/.test(seg);
}

export function pathMatchesAllowlist(pathStr: string, allowPath: string): boolean {
  const pathSegs = splitPathSegments(pathStr);
  const allowSegs = splitPathSegments(allowPath);
  if (pathSegs.length !== allowSegs.length) return false;
  for (let i = 0; i < allowSegs.length; i += 1) {
    const allow = allowSegs[i];
    const actual = pathSegs[i];
    if (allow === '*') {
      if (!isNumericSegment(actual)) return false;
      continue;
    }
    if (allow !== actual) return false;
  }
  return true;
}

export function normalizeAllowlistEntries(entries: L10nAllowlistEntry[]): Array<{ path: string; type: 'string' | 'richtext' }> {
  return entries
    .map((entry) => ({
      path: typeof entry?.path === 'string' ? entry.path.trim() : '',
      type: entry?.type === 'richtext' ? 'richtext' : 'string',
    }))
    .filter((entry) => entry.path);
}

export async function loadWidgetLocalizationAllowlist(
  env: Env,
  widgetType: string,
): Promise<Array<{ path: string; type: 'string' | 'richtext' }>> {
  const base = requireTokyoBase(env);
  const url = `${base}/widgets/${encodeURIComponent(widgetType)}/localization.json`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(`[ParisWorker] Failed to load localization allowlist (${res.status}): ${details}`);
  }
  const json = (await res.json().catch(() => null)) as L10nAllowlistFile | null;
  if (!json || json.v !== 1 || !Array.isArray(json.paths)) {
    throw new Error('[ParisWorker] Invalid localization.json allowlist');
  }
  return normalizeAllowlistEntries(json.paths);
}

export async function loadWidgetLayerAllowlist(
  env: Env,
  widgetType: string,
  layer: string,
): Promise<Array<{ path: string; type: 'string' | 'richtext' }>> {
  if (layer === 'locale') {
    return loadWidgetLocalizationAllowlist(env, widgetType);
  }
  const base = requireTokyoBase(env);
  const url = `${base}/widgets/${encodeURIComponent(widgetType)}/layers/${encodeURIComponent(layer)}.allowlist.json`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(`[ParisWorker] Failed to load layer allowlist (${res.status}): ${details}`);
  }
  const json = (await res.json().catch(() => null)) as L10nAllowlistFile | null;
  if (!json || json.v !== 1 || !Array.isArray(json.paths)) {
    throw new Error('[ParisWorker] Invalid layer allowlist');
  }
  return normalizeAllowlistEntries(json.paths);
}

export function validateL10nOps(opsRaw: unknown, allowlist: string[]) {
  if (!Array.isArray(opsRaw)) {
    return { ok: false as const, code: 'OPS_INVALID_TYPE', message: 'ops must be an array' };
  }
  if (opsRaw.length > L10N_MAX_OPS) {
    return { ok: false as const, code: 'OPS_TOO_MANY', message: `ops exceeds max (${L10N_MAX_OPS})` };
  }

  const encoder = new TextEncoder();
  const ops: Array<{ op: 'set'; path: string; value: unknown }> = [];

  for (let i = 0; i < opsRaw.length; i += 1) {
    const op = opsRaw[i] as any;
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      return { ok: false as const, code: 'OPS_INVALID_TYPE', message: `ops[${i}] must be an object` };
    }
    if (op.op !== 'set') {
      return { ok: false as const, code: 'OPS_INVALID_TYPE', message: `ops[${i}].op must be "set"` };
    }
    const rawPath = typeof op.path === 'string' ? op.path : '';
    const path = normalizeOpPath(rawPath);
    if (!path) {
      return { ok: false as const, code: 'OPS_INVALID_TYPE', message: `ops[${i}].path is required` };
    }
    if (hasProhibitedSegment(path)) {
      return { ok: false as const, code: 'OPS_INVALID_PATH', message: `ops[${i}].path contains prohibited segment` };
    }
    const allowed = allowlist.some((allow) => pathMatchesAllowlist(path, allow));
    if (!allowed) {
      return { ok: false as const, code: 'OPS_INVALID_PATH', message: `ops[${i}].path not allowlisted`, detail: path };
    }
    if (!('value' in op)) {
      return { ok: false as const, code: 'OPS_INVALID_TYPE', message: `ops[${i}].value is required` };
    }
    const valueBytes = encoder.encode(JSON.stringify(op.value)).length;
    if (valueBytes > L10N_MAX_OP_VALUE_BYTES) {
      return {
        ok: false as const,
        code: 'OPS_TOO_LARGE',
        message: `ops[${i}].value exceeds max size (${L10N_MAX_OP_VALUE_BYTES} bytes)`,
      };
    }
    ops.push({ op: 'set', path, value: op.value });
  }

  const payloadBytes = encoder.encode(JSON.stringify(ops)).length;
  if (payloadBytes > L10N_MAX_OVERLAY_BYTES) {
    return { ok: false as const, code: 'OPS_TOO_LARGE', message: `ops payload exceeds max (${L10N_MAX_OVERLAY_BYTES} bytes)` };
  }

  return { ok: true as const, ops };
}
