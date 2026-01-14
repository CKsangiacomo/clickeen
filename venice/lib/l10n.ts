import { computeBaseFingerprint, localeCandidates, normalizeLocaleToken } from '@clickeen/l10n';
import { tokyoFetch } from './tokyo';

export type LocalizationOp = { op: 'set'; path: string; value: unknown };

export type InstanceOverlay = {
  v: 1;
  baseUpdatedAt?: string | null;
  baseFingerprint?: string | null;
  ops: LocalizationOp[];
};

type L10nManifest = {
  v: 1;
  gitSha: string;
  instances: Record<string, Record<string, { file: string; baseUpdatedAt?: string | null; geoCountries?: string[] | null }>>;
};

const manifestCache = new Map<string, Promise<L10nManifest>>();

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
  if (/^wgt_web_/.test(publicId)) return true;
  return /^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*)$/.test(publicId);
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

async function loadL10nManifest(): Promise<L10nManifest> {
  const url = `/l10n/manifest.json`;
  const cached = manifestCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    const res = await tokyoFetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`[VeniceL10n] Failed to load l10n manifest (${res.status})`);
    const json = (await res.json().catch(() => null)) as L10nManifest | null;
    if (!json || typeof json !== 'object' || json.v !== 1 || typeof json.gitSha !== 'string') {
      throw new Error('[VeniceL10n] Invalid l10n manifest');
    }
    if (!json.instances || typeof json.instances !== 'object') {
      throw new Error('[VeniceL10n] Invalid l10n manifest.instances');
    }
    return json;
  })();

  manifestCache.set(url, promise);
  return promise;
}

async function fetchOverlay(publicId: string, locale: string): Promise<InstanceOverlay | null> {
  let manifest: L10nManifest;
  try {
    manifest = await loadL10nManifest();
  } catch {
    return null;
  }

  const entries = manifest.instances?.[publicId];
  if (!entries || typeof entries !== 'object') return null;

  for (const candidate of localeCandidates(locale)) {
    const meta = entries[candidate];
    const file = meta?.file ? String(meta.file).trim() : '';
    if (!file) continue;

    const res = await tokyoFetch(`/l10n/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(file)}`, {
      method: 'GET',
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as InstanceOverlay | null;
    if (!json || typeof json !== 'object' || json.v !== 1 || !Array.isArray(json.ops)) return null;
    return json;
  }

  return null;
}

export async function resolveTokyoLocale(args: {
  publicId: string;
  locale: string;
  explicit: boolean;
  country?: string | null;
}): Promise<string> {
  if (args.explicit) return args.locale;
  const country = String(args.country || '').trim().toUpperCase();
  if (!country) return args.locale;

  let manifest: L10nManifest;
  try {
    manifest = await loadL10nManifest();
  } catch {
    return args.locale;
  }

  const entries = manifest.instances?.[args.publicId];
  if (!entries || typeof entries !== 'object') return args.locale;

  const locales = Object.keys(entries).sort();
  for (const locale of locales) {
    const meta = entries[locale];
    const geo = Array.isArray(meta?.geoCountries) ? meta.geoCountries : null;
    if (!geo || geo.length === 0) continue;
    if (geo.some((code) => String(code || '').trim().toUpperCase() === country)) {
      return locale;
    }
  }

  return args.locale;
}

export async function applyTokyoInstanceOverlay(args: {
  publicId: string;
  locale: string;
  baseUpdatedAt?: string | null;
  config: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const locale = normalizeLocaleToken(args.locale);
  if (!locale) return args.config;

  const overlay = await fetchOverlay(args.publicId, locale);
  if (!overlay) {
    if (isDevStrict() && isCuratedPublicId(args.publicId) && locale !== 'en') {
      throw new Error(`[VeniceL10n] Missing overlay for ${args.publicId} (${locale})`);
    }
    return args.config;
  }

  if (overlay.baseFingerprint) {
    const baseFingerprint = await computeBaseFingerprint(args.config);
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
