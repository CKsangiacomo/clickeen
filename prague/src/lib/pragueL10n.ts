import {
  computeBaseFingerprint,
  GEO_TARGETS_SEMANTICS,
  LAYER_MULTI_KEY_ORDER,
  LAYER_ORDER,
  USER_FALLBACK_ORDER,
  localeCandidates,
  normalizeLocaleToken,
} from '@clickeen/l10n';
import localesJson from '../../../config/locales.json';

const BASE_LOADERS = import.meta.glob('../../content/base/v1/**/*.json', { import: 'default' });

const BASE_BY_PAGE_ID = new Map<string, () => Promise<unknown>>();
for (const [filePath, loader] of Object.entries(BASE_LOADERS)) {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/content/base/v1/';
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) continue;
  const rel = normalized.slice(idx + marker.length).replace(/\.json$/, '');
  if (!rel) continue;
  BASE_BY_PAGE_ID.set(rel, loader as () => Promise<unknown>);
}

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const LAYER_KEY_SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_EXPERIMENT = /^exp_[a-z0-9][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_BEHAVIOR = /^behavior_[a-z0-9][a-z0-9_-]*$/;
const MAX_LAYER_APPLICATIONS = 8;

export type PragueOverlay = {
  v: 1;
  baseFingerprint?: string | null;
  baseUpdatedAt?: string | null;
  ops: Array<{ op: 'set'; path: string; value: string }>;
};

type PragueBaseSnapshot = {
  v: 1;
  pageId: string;
  baseFingerprint: string;
  baseUpdatedAt?: string | null;
  snapshot: Record<string, string>;
};

type LayerIndexEntry = {
  keys: string[];
  lastPublishedFingerprint?: Record<string, string>;
  geoTargets?: Record<string, string[]>;
};

type LayerIndex = {
  v: 1;
  publicId: string;
  layers: Record<string, LayerIndexEntry>;
};

export type PragueOverlayStatus = 'applied' | 'missing' | 'stale' | 'skipped';

export type PragueOverlayMeta = {
  overlayStatus: PragueOverlayStatus;
  overlayLocale: string;
};

export class PragueOverlayFailureError extends Error {
  statusCode: number;
  overlayStatus: Exclude<PragueOverlayStatus, 'applied' | 'skipped'>;
  overlayLocale: string;

  constructor(args: {
    message: string;
    statusCode?: number;
    overlayStatus: Exclude<PragueOverlayStatus, 'applied' | 'skipped'>;
    overlayLocale: string;
  }) {
    super(args.message);
    this.name = 'PragueOverlayFailureError';
    this.statusCode = args.statusCode ?? 424;
    this.overlayStatus = args.overlayStatus;
    this.overlayLocale = args.overlayLocale;
  }
}

export function isPragueOverlayFailureError(err: unknown): err is PragueOverlayFailureError {
  return Boolean(err) && typeof err === 'object' && (err as any).name === 'PragueOverlayFailureError';
}

let cachedLocales: string[] | null = null;

async function loadLocales(): Promise<string[]> {
  if (cachedLocales) return cachedLocales;
  if (!Array.isArray(localesJson)) {
    throw new Error('[prague] Invalid locales file: config/locales.json');
  }
  const locales = localesJson
    .map((entry: any) => {
      if (typeof entry === 'string') return normalizeLocaleToken(entry);
      if (entry && typeof entry === 'object' && typeof entry.code === 'string') return normalizeLocaleToken(entry.code);
      return null;
    })
    .filter((value): value is string => Boolean(value));
  if (!locales.includes('en')) {
    throw new Error('[prague] locales.json must include "en"');
  }
  cachedLocales = Array.from(new Set(locales)).sort();
  return cachedLocales;
}

async function resolveLocale(rawLocale: string): Promise<string> {
  const locales = await loadLocales();
  const candidates = localeCandidates(rawLocale, locales);
  if (!candidates.length) {
    throw new Error(`[prague] Unsupported locale: ${rawLocale}`);
  }
  return candidates[0];
}

function readEnv(name: string): string | undefined {
  // NOTE: Vite dev (module runner) does not support dynamic access of `import.meta.env[name]`.
  // Only keep dynamic access for `process.env` and handle the few `import.meta.env.*` values explicitly below.
  const proc = typeof process !== 'undefined' ? process : undefined;
  const procValue = proc?.env ? proc.env[name] : undefined;
  if (typeof procValue === 'string' && procValue.trim()) return procValue.trim();
  return undefined;
}

function readEnvTokyoUrl(): string | undefined {
  const metaValue = String(import.meta.env.PUBLIC_TOKYO_URL || '').trim();
  if (metaValue) return metaValue;
  return readEnv('PUBLIC_TOKYO_URL');
}

function readEnvStrictFlag(): string | undefined {
  const metaAny = import.meta.env as any;
  const metaValue = String(metaAny.PRAGUE_L10N_STRICT || metaAny.PUBLIC_PRAGUE_L10N_STRICT || '').trim();
  if (metaValue) return metaValue;
  return readEnv('PRAGUE_L10N_STRICT') || readEnv('PUBLIC_PRAGUE_L10N_STRICT');
}

function getTokyoBaseUrl(): string {
  const raw = String(readEnvTokyoUrl() || '').trim();
  if (!raw) {
    throw new Error('[prague] PUBLIC_TOKYO_URL is required (e.g. https://tokyo.dev.clickeen.com)');
  }
  return raw.replace(/\/+$/, '');
}

function isDevStrict(): boolean {
  const strict = readEnvStrictFlag();
  if (strict === '1') return true;
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getAtPath(obj: unknown, pathStr: string): unknown {
  const parts = String(pathStr || '')
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);
  let current: any = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    const key: any = isIndex(part) ? Number(part) : part;
    current = current?.[key];
  }
  return current;
}

function normalizePath(pathStr: string): string {
  return String(pathStr || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');
}

function hasProhibitedSegment(pathStr: string): boolean {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && PROHIBITED_SEGMENTS.has(seg));
}

function isIndex(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function setAt(obj: unknown, pathStr: string, value: unknown): unknown {
  const parts = String(pathStr || '')
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

function applySetOps(config: Record<string, unknown>, ops: PragueOverlay['ops']): Record<string, unknown> {
  let working: unknown = config;
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.op !== 'set') continue;
    if (typeof op.path !== 'string' || !op.path.trim()) continue;
    const normalized = normalizePath(op.path);
    if (!normalized || hasProhibitedSegment(normalized)) continue;
    if (typeof op.value !== 'string') continue;
    working = setAt(working, normalized, op.value);
  }
  return (working && typeof working === 'object' && !Array.isArray(working) ? (working as Record<string, unknown>) : config);
}

function encodePathSegments(pathStr: string): string {
  return String(pathStr || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function getTokyoL10nPrefix(): string {
  const metaAny = import.meta.env as any;
  const token = String(metaAny.PUBLIC_PRAGUE_BUILD_ID || '').trim();
  return token ? `/l10n/v/${encodeURIComponent(token)}` : '/l10n';
}

async function fetchLayerIndex(pageId: string): Promise<LayerIndex | null> {
  const baseUrl = getTokyoBaseUrl();
  const prefix = getTokyoL10nPrefix();
  const path = `${prefix}/prague/${encodePathSegments(pageId)}/index.json`;
  const res = await fetch(`${baseUrl}${path}`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as LayerIndex | null;
  if (!json || typeof json !== 'object' || json.v !== 1) return null;
  if (!json.layers || typeof json.layers !== 'object') return null;
  return json;
}

async function fetchBaseSnapshot(args: { pageId: string; baseFingerprint: string }): Promise<Record<string, string> | null> {
  if (!args.baseFingerprint) return null;
  const baseUrl = getTokyoBaseUrl();
  const prefix = getTokyoL10nPrefix();
  const path = `${prefix}/prague/${encodePathSegments(args.pageId)}/bases/${encodeURIComponent(
    args.baseFingerprint,
  )}.snapshot.json`;
  const res = await fetch(`${baseUrl}${path}`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as PragueBaseSnapshot | null;
  if (!json || typeof json !== 'object' || json.v !== 1) return null;
  if (!json.snapshot || typeof json.snapshot !== 'object' || Array.isArray(json.snapshot)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(json.snapshot)) {
    if (typeof value !== 'string') continue;
    out[String(key)] = value;
  }
  return out;
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

function resolveLocaleFromIndex(args: { entry: LayerIndexEntry; locale: string; country?: string | null }): string | null {
  if (!args.entry.keys.length) return null;
  const supportedList = args.entry.keys
    .map((entry) => normalizeLocaleToken(entry))
    .filter((value): value is string => Boolean(value));
  const supported = new Set(supportedList);

  const requestedLocale = normalizeLocaleToken(args.locale);
  if (!requestedLocale) return null;
  const baseLocale = requestedLocale.split('-')[0] || '';
  if (!baseLocale) return null;

  const country = normalizeCountryCode(args.country);
  if (country && GEO_TARGETS_SEMANTICS === 'locale-selection-only') {
    const geoTargets = args.entry.geoTargets ?? {};
    const candidates = supportedList.filter((locale) => locale === baseLocale || locale.startsWith(`${baseLocale}-`));
    for (const locale of candidates) {
      const geoCountries = normalizeGeoCountries(geoTargets[locale]);
      if (geoCountries && geoCountries.includes(country)) {
        return locale;
      }
    }
  }

  const candidates = localeCandidates(requestedLocale, supported);
  if (candidates.length) return candidates[0]!;
  return null;
}

function normalizeLayerKey(layer: string, raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  switch (layer) {
    case 'locale': {
      return normalizeLocaleToken(value);
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
      return normalizeLocaleToken(value);
    }
    default:
      return null;
  }
}

function sortExperimentKeys(keys: string[]): string[] {
  if (LAYER_MULTI_KEY_ORDER.experiment !== 'expId-asc') return keys;
  return [...keys].sort((a, b) => {
    const [aId = '', aVariant = ''] = a.split(':');
    const [bId = '', bVariant = ''] = b.split(':');
    if (aId === bId) return aVariant.localeCompare(bVariant);
    return aId.localeCompare(bId);
  });
}

function sortBehaviorKeys(keys: string[]): string[] {
  if (LAYER_MULTI_KEY_ORDER.behavior !== 'lex') return keys;
  return [...keys].sort((a, b) => a.localeCompare(b));
}

type LayerContext = {
  industryKey?: string | null;
  accountKey?: string | null;
  experimentKeys?: string[] | null;
  behaviorKeys?: string[] | null;
};

type LayerTarget = {
  layer: string;
  key: string;
  required?: boolean;
};

function resolveLayerTargets(args: {
  index: LayerIndex | null;
  locale: string;
  country?: string | null;
  layerContext?: LayerContext;
}): { targets: LayerTarget[]; missingRequired: string[]; localeKey: string | null } {
  const targets: LayerTarget[] = [];
  const missingRequired: string[] = [];
  const layers = args.index?.layers ?? {};

  const normalizedLocale = normalizeLocaleToken(args.locale) ?? 'en';
  const localeEntry = layers.locale;
  const localeKey = localeEntry ? resolveLocaleFromIndex({ entry: localeEntry, locale: args.locale, country: args.country }) : null;
  if (normalizedLocale !== 'en') {
    if (!localeKey) {
      missingRequired.push(`locale:${normalizedLocale}`);
    } else if (!localeEntry || !localeEntry.keys.includes(localeKey)) {
      missingRequired.push(`locale:${localeKey}`);
    } else if (localeKey !== 'en') {
      targets.push({ layer: 'locale', key: localeKey, required: true });
    }
  }

  const geoKey = normalizeLayerKey('geo', normalizeCountryCode(args.country));
  if (geoKey) {
    const entry = layers.geo;
    if (entry && entry.keys.includes(geoKey)) {
      targets.push({ layer: 'geo', key: geoKey });
    }
  }

  const industryKey = normalizeLayerKey('industry', args.layerContext?.industryKey ?? null);
  if (industryKey) {
    const entry = layers.industry;
    if (entry && entry.keys.includes(industryKey)) {
      targets.push({ layer: 'industry', key: industryKey });
    }
  }

  const accountKey = normalizeLayerKey('account', args.layerContext?.accountKey ?? null);
  if (accountKey) {
    const entry = layers.account;
    if (entry && entry.keys.includes(accountKey)) {
      targets.push({ layer: 'account', key: accountKey });
    }
  }

  const experimentEntry = layers.experiment;
  if (experimentEntry && Array.isArray(args.layerContext?.experimentKeys)) {
    const normalized = Array.from(
      new Set(
        args.layerContext!.experimentKeys
          .map((key) => normalizeLayerKey('experiment', key))
          .filter((key): key is string => Boolean(key)),
      ),
    ).filter((key) => experimentEntry.keys.includes(key));
    const ordered = sortExperimentKeys(normalized);
    ordered.forEach((key) => targets.push({ layer: 'experiment', key }));
  }

  const behaviorEntry = layers.behavior;
  if (behaviorEntry && Array.isArray(args.layerContext?.behaviorKeys)) {
    const normalized = Array.from(
      new Set(
        args.layerContext!.behaviorKeys
          .map((key) => normalizeLayerKey('behavior', key))
          .filter((key): key is string => Boolean(key)),
      ),
    ).filter((key) => behaviorEntry.keys.includes(key));
    const ordered = sortBehaviorKeys(normalized);
    ordered.forEach((key) => targets.push({ layer: 'behavior', key }));
  }

  const userEntry = layers.user;
  if (userEntry && userEntry.keys.length) {
    const localeFallback = localeKey ?? normalizeLocaleToken(args.locale);
    const fallbackCandidates = USER_FALLBACK_ORDER.map((mode) => (mode === 'locale' ? localeFallback : 'global'));
    for (const candidate of fallbackCandidates) {
      const key = normalizeLayerKey('user', candidate);
      if (key && userEntry.keys.includes(key)) {
        targets.push({ layer: 'user', key });
        break;
      }
    }
  }

  const orderedTargets = LAYER_ORDER.filter((layer) => layer !== 'base').flatMap((layer) =>
    targets.filter((target) => target.layer === layer),
  );

  return { targets: orderedTargets, missingRequired, localeKey };
}

async function fetchOverlay(args: {
  pageId: string;
  layer: string;
  layerKey: string;
  baseFingerprint: string;
}): Promise<PragueOverlay | null> {
  if (!args.baseFingerprint) return null;
  const baseUrl = getTokyoBaseUrl();
  const prefix = getTokyoL10nPrefix();
  const path = `${prefix}/prague/${encodePathSegments(args.pageId)}/${encodeURIComponent(args.layer)}/${encodeURIComponent(
    args.layerKey
  )}/${encodeURIComponent(args.baseFingerprint)}.ops.json`;
  const res = await fetch(`${baseUrl}${path}`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as PragueOverlay | null;
  if (!json || typeof json !== 'object' || json.v !== 1 || !Array.isArray(json.ops)) return null;
  return json;
}

function filterStaleOps(args: {
  base: Record<string, unknown>;
  overlay: PragueOverlay;
  snapshot: Record<string, string>;
}): PragueOverlay['ops'] {
  const out: PragueOverlay['ops'] = [];
  for (const op of args.overlay.ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.op !== 'set') continue;
    if (typeof op.path !== 'string' || !op.path.trim()) continue;
    if (typeof op.value !== 'string') continue;
    const normalized = normalizePath(op.path);
    if (!normalized) continue;
    const snapshotValue = args.snapshot[normalized];
    if (typeof snapshotValue !== 'string') continue;
    const baseValue = getAtPath(args.base, normalized);
    if (typeof baseValue !== 'string') continue;
    if (baseValue !== snapshotValue) continue;
    out.push({ op: 'set', path: normalized, value: op.value });
  }
  return out;
}

async function applyPragueLayeredOverlaysWithMeta(args: {
  pageId: string;
  locale: string;
  base: Record<string, unknown>;
  country?: string | null;
  layerContext?: LayerContext;
}): Promise<{ content: Record<string, unknown>; meta: PragueOverlayMeta }> {
  const normalized = normalizeLocaleToken(args.locale);
  if (!normalized) {
    return { content: args.base, meta: { overlayStatus: 'skipped', overlayLocale: 'en' } };
  }
  if (normalized === 'en') {
    return { content: args.base, meta: { overlayStatus: 'skipped', overlayLocale: 'en' } };
  }

  const baseFingerprint = await computeBaseFingerprint(args.base);
  const index = await fetchLayerIndex(args.pageId).catch(() => null);

  if (!index) {
    const meta = { overlayStatus: 'missing' as const, overlayLocale: normalized };
    if (isDevStrict()) {
      throw new PragueOverlayFailureError({
        overlayStatus: meta.overlayStatus,
        overlayLocale: meta.overlayLocale,
        message: `[prague] Missing layer index for ${args.pageId}`,
      });
    }
    return { content: args.base, meta };
  }
  if (index.publicId && index.publicId !== args.pageId) {
    throw new Error(`[prague] Layer index publicId mismatch for ${args.pageId}`);
  }

  const { targets, missingRequired, localeKey } = resolveLayerTargets({
    index,
    locale: normalized,
    country: args.country,
    layerContext: args.layerContext,
  });

  const effectiveLocale = localeKey ?? normalized;
  if (effectiveLocale === 'en') {
    const meta = { overlayStatus: 'missing' as const, overlayLocale: normalized };
    if (isDevStrict()) {
      throw new PragueOverlayFailureError({
        overlayStatus: meta.overlayStatus,
        overlayLocale: meta.overlayLocale,
        message: `[prague] Missing locale overlay for ${args.pageId} (${normalized})`,
      });
    }
    return { content: args.base, meta };
  }

  if (missingRequired.length) {
    const meta = { overlayStatus: 'missing' as const, overlayLocale: effectiveLocale };
    if (isDevStrict()) {
      throw new PragueOverlayFailureError({
        overlayStatus: meta.overlayStatus,
        overlayLocale: meta.overlayLocale,
        message: `[prague] Missing required layer keys for ${args.pageId}: ${missingRequired.join(', ')}`,
      });
    }
    return { content: args.base, meta };
  }

  if (!targets.length) {
    return { content: args.base, meta: { overlayStatus: 'missing', overlayLocale: effectiveLocale } };
  }
  const cappedTargets = targets.slice(0, MAX_LAYER_APPLICATIONS);
  const overlayResults = await Promise.all(
    cappedTargets.map(async (target) => {
      const entry = index.layers[target.layer];
      const expected = entry?.lastPublishedFingerprint?.[target.key];
      const overlayFingerprint = expected && expected !== baseFingerprint ? expected : baseFingerprint;
      const overlay = await fetchOverlay({
        pageId: args.pageId,
        layer: target.layer,
        layerKey: target.key,
        baseFingerprint: overlayFingerprint,
      });
      if (!overlay) return { target, overlay: null, stale: Boolean(expected && expected !== baseFingerprint), fingerprint: overlayFingerprint, snapshot: null };
      if (overlay.baseFingerprint && overlay.baseFingerprint !== overlayFingerprint) {
        return { target, overlay: null, stale: true, fingerprint: overlayFingerprint, snapshot: null };
      }
      if (!overlay.baseFingerprint) {
        return { target, overlay: null, stale: true, fingerprint: overlayFingerprint, snapshot: null };
      }
      if (overlayFingerprint !== baseFingerprint) {
        const snapshot = await fetchBaseSnapshot({ pageId: args.pageId, baseFingerprint: overlayFingerprint }).catch(() => null);
        return { target, overlay, stale: true, fingerprint: overlayFingerprint, snapshot };
      }
      return { target, overlay, stale: false, fingerprint: overlayFingerprint, snapshot: null };
    }),
  );

  let localized = args.base;
  let applied = false;
  let anyMissing = false;
  let anyStale = false;
  for (const result of overlayResults) {
    if (!result.overlay) {
      if (result.stale) {
        anyStale = true;
        if (isDevStrict()) {
          throw new PragueOverlayFailureError({
            overlayStatus: 'stale',
            overlayLocale: effectiveLocale,
            message: `[prague] Stale overlay for ${args.pageId} (${result.target.layer}:${result.target.key})`,
          });
        }
      }
      if (result.target.required) {
        anyMissing = true;
        if (isDevStrict()) {
          throw new PragueOverlayFailureError({
            overlayStatus: 'missing',
            overlayLocale: effectiveLocale,
            message: `[prague] Missing overlay for ${args.pageId} (${result.target.layer}:${result.target.key})`,
          });
        }
      }
      continue;
    }
    const ops = result.stale
      ? result.snapshot
        ? filterStaleOps({ base: args.base, overlay: result.overlay, snapshot: result.snapshot })
        : []
      : (result.overlay.ops.filter((o) => o && typeof o === 'object' && o.op === 'set') as PragueOverlay['ops']);
    localized = applySetOps(localized, ops);
    applied = applied || ops.length > 0;
  }

  const overlayStatus: PragueOverlayStatus = anyStale ? 'stale' : anyMissing ? 'missing' : applied ? 'applied' : 'missing';
  return { content: localized, meta: { overlayStatus, overlayLocale: effectiveLocale } };
}

async function applyPragueLayeredOverlays(args: {
  pageId: string;
  locale: string;
  base: Record<string, unknown>;
  country?: string | null;
  layerContext?: LayerContext;
}): Promise<Record<string, unknown>> {
  const result = await applyPragueLayeredOverlaysWithMeta(args);
  return result.content;
}

export type PragueOverlayContext = {
  country?: string | null;
  layerContext?: LayerContext;
};

export async function loadPraguePageContentWithMeta(
  args: { locale: string; pageId: string; base: Record<string, unknown> } & PragueOverlayContext,
): Promise<{ content: Record<string, unknown>; meta: PragueOverlayMeta }> {
  const resolved = await resolveLocale(args.locale);
  if (!isPlainObject(args.base) || (args.base as any).v !== 1) {
    throw new Error(`[prague] Invalid Prague base for ${args.pageId}`);
  }
  const pageId = typeof (args.base as any).pageId === 'string' ? String((args.base as any).pageId) : '';
  if (pageId && pageId !== args.pageId) {
    throw new Error(`[prague] Prague base pageId mismatch for ${args.pageId}`);
  }
  if (!isPlainObject((args.base as any).blocks)) {
    throw new Error(`[prague] Prague base missing blocks for ${args.pageId}`);
  }

  return applyPragueLayeredOverlaysWithMeta({
    pageId: args.pageId,
    locale: resolved,
    base: args.base,
    country: args.country,
    layerContext: args.layerContext,
  });
}

export async function loadPraguePageContent(
  args: { locale: string; pageId: string; base: Record<string, unknown> } & PragueOverlayContext,
) {
  const resolved = await resolveLocale(args.locale);
  if (!isPlainObject(args.base) || (args.base as any).v !== 1) {
    throw new Error(`[prague] Invalid Prague base for ${args.pageId}`);
  }
  const pageId = typeof (args.base as any).pageId === 'string' ? String((args.base as any).pageId) : '';
  if (pageId && pageId !== args.pageId) {
    throw new Error(`[prague] Prague base pageId mismatch for ${args.pageId}`);
  }
  if (!isPlainObject((args.base as any).blocks)) {
    throw new Error(`[prague] Prague base missing blocks for ${args.pageId}`);
  }

  return applyPragueLayeredOverlays({
    pageId: args.pageId,
    locale: resolved,
    base: args.base,
    country: args.country,
    layerContext: args.layerContext,
  });
}

export async function loadPragueChromeStrings(locale: string): Promise<Record<string, unknown>> {
  const resolved = await resolveLocale(locale);
  const loader = BASE_BY_PAGE_ID.get('chrome');
  if (!loader) {
    throw new Error('[prague] Missing Prague chrome base file: prague/content/base/v1/chrome.json');
  }
  const json = await loader();
  if (!isPlainObject(json) || (json as any).v !== 1 || !isPlainObject((json as any).strings)) {
    throw new Error('[prague] Invalid chrome base file: prague/content/base/v1/chrome.json');
  }
  const localized = await applyPragueLayeredOverlays({ pageId: 'chrome', locale: resolved, base: json as Record<string, unknown> });
  const strings = (localized as any).strings;
  if (!isPlainObject(strings)) {
    throw new Error(`[prague] Invalid chrome strings shape after overlay (${resolved})`);
  }
  return strings as Record<string, unknown>;
}
