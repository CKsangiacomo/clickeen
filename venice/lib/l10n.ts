import { computeBaseFingerprint, localeCandidates, normalizeLocaleToken } from '@clickeen/l10n';
import { tokyoFetch } from './tokyo';

export type LocalizationOp = { op: 'set'; path: string; value: unknown };

export type InstanceOverlay = {
  v: 1;
  baseUpdatedAt?: string | null;
  baseFingerprint?: string | null;
  ops: LocalizationOp[];
};

type LocaleIndexEntry = {
  locale: string;
  geoCountries?: string[] | null;
};

type LocaleIndex = {
  v: 1;
  publicId: string;
  locales: LocaleIndexEntry[];
};

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function hasProhibitedSegment(path: string): boolean {
  return path
    .split('.')
    .some((segment) => segment && PROHIBITED_SEGMENTS.has(segment));
}

function isIndex(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function isCuratedPublicId(publicId: string): boolean {
  if (/^wgt_curated_/.test(publicId)) return true;
  return /^wgt_main_[a-z0-9][a-z0-9_-]*$/.test(publicId);
}

function isDevStrict(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

function setAt(obj: unknown, path: string, value: unknown): unknown {
  const parts = String(path || '')
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);

  const root = Array.isArray(obj) ? [...obj] : ({ ...(obj as any) } as any);
  let current: any = root;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const key: any = isIndex(part) ? Number(part) : part;
    const isLast = i === parts.length - 1;
    if (isLast) {
      current[key] = value;
      break;
    }
    const next = current[key];
    const clone = Array.isArray(next) ? [...next] : next && typeof next === 'object' ? { ...next } : {};
    current[key] = clone;
    current = clone;
  }
  return root;
}

function applySetOps(config: Record<string, unknown>, ops: LocalizationOp[]): Record<string, unknown> {
  let working: unknown = config;
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.op !== 'set') continue;
    if (typeof op.path !== 'string' || !op.path.trim()) continue;
    if (hasProhibitedSegment(op.path)) continue;
    if (op.value === undefined) continue;
    working = setAt(working, op.path, op.value);
  }
  return (working && typeof working === 'object' && !Array.isArray(working) ? (working as Record<string, unknown>) : config);
}

async function fetchOverlay(publicId: string, locale: string, baseFingerprint: string): Promise<InstanceOverlay | null> {
  if (!baseFingerprint) return null;

  for (const candidate of localeCandidates(locale)) {
    const res = await tokyoFetch(
      `/l10n/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(candidate)}/${encodeURIComponent(
        baseFingerprint
      )}.ops.json`,
      { method: 'GET' }
    );
    if (res.status === 404) continue;
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as InstanceOverlay | null;
    if (!json || typeof json !== 'object' || json.v !== 1 || !Array.isArray(json.ops)) return null;
    return json;
  }

  return null;
}

function normalizeCountryCode(raw?: string | null): string | null {
  const value = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return null;
  return value;
}

function normalizeGeoCountries(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const list = raw
    .map((code) => String(code || '').trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code));
  if (!list.length) return null;
  return Array.from(new Set(list));
}

async function fetchLocaleIndex(publicId: string): Promise<LocaleIndex | null> {
  const res = await tokyoFetch(`/l10n/instances/${encodeURIComponent(publicId)}/index.json`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as LocaleIndex | null;
  if (!json || typeof json !== 'object' || json.v !== 1 || !Array.isArray(json.locales)) return null;
  return json;
}

function resolveLocaleFromIndex(args: { index: LocaleIndex; locale: string; country?: string | null }): string | null {
  if (!args.index.locales.length) return null;
  const supported = new Set(
    args.index.locales
      .map((entry) => normalizeLocaleToken(entry.locale))
      .filter((value): value is string => Boolean(value)),
  );

  const country = normalizeCountryCode(args.country);
  if (country) {
    for (const entry of args.index.locales) {
      const locale = normalizeLocaleToken(entry.locale);
      if (!locale) continue;
      const geoCountries = normalizeGeoCountries(entry.geoCountries);
      if (geoCountries && geoCountries.includes(country)) {
        return locale;
      }
    }
  }

  const preferredCandidates = localeCandidates(args.locale, supported);
  if (preferredCandidates.length) return preferredCandidates[0]!;

  if (supported.has('en')) return 'en';
  return args.index.locales
    .map((entry) => normalizeLocaleToken(entry.locale))
    .find((value): value is string => Boolean(value)) ?? null;
}

export async function resolveTokyoLocale(args: {
  publicId: string;
  locale: string;
  explicit: boolean;
  country?: string | null;
}): Promise<string> {
  const normalized = normalizeLocaleToken(args.locale) ?? 'en';
  if (args.explicit) return normalized;

  const index = await fetchLocaleIndex(args.publicId).catch(() => null);
  if (!index) return normalized;

  return resolveLocaleFromIndex({ index, locale: normalized, country: args.country }) ?? normalized;
}

export async function applyTokyoInstanceOverlay(args: {
  publicId: string;
  locale: string;
  baseUpdatedAt?: string | null;
  baseFingerprint?: string | null;
  config: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const locale = normalizeLocaleToken(args.locale);
  if (!locale) return args.config;

  const baseFingerprint = args.baseFingerprint ?? (await computeBaseFingerprint(args.config));
  const overlay = await fetchOverlay(args.publicId, locale, baseFingerprint);
  if (!overlay) {
    if (isDevStrict() && isCuratedPublicId(args.publicId) && locale !== 'en') {
      throw new Error(`[VeniceL10n] Missing overlay for ${args.publicId} (${locale})`);
    }
    return args.config;
  }

  if (overlay.baseFingerprint) {
    if (overlay.baseFingerprint !== baseFingerprint) {
      if (isDevStrict() && isCuratedPublicId(args.publicId) && locale !== 'en') {
        throw new Error(`[VeniceL10n] Stale overlay for ${args.publicId} (${locale})`);
      }
      return args.config;
    }
  } else {
    if (isDevStrict() && isCuratedPublicId(args.publicId) && locale !== 'en') {
      throw new Error(`[VeniceL10n] Missing baseFingerprint for ${args.publicId} (${locale})`);
    }
    return args.config;
  }

  const ops = overlay.ops.filter((o) => o && typeof o === 'object' && o.op === 'set') as LocalizationOp[];
  return applySetOps(args.config, ops);
}
