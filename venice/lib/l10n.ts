import type { AllowlistEntry } from '@clickeen/l10n';
import {
  computeL10nFingerprint,
  GEO_TARGETS_SEMANTICS,
  LAYER_MULTI_KEY_ORDER,
  LAYER_ORDER,
  USER_FALLBACK_ORDER,
  localeCandidates,
  normalizeLocaleToken,
} from '@clickeen/l10n';
import { tokyoFetch } from './tokyo';

export type LocalizationOp = { op: 'set'; path: string; value: unknown };

export type InstanceOverlay = {
  v: 1;
  baseUpdatedAt?: string | null;
  baseFingerprint?: string | null;
  ops: LocalizationOp[];
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

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const LAYER_KEY_SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_EXPERIMENT = /^exp_[a-z0-9][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_BEHAVIOR = /^behavior_[a-z0-9][a-z0-9_-]*$/;
const MAX_LAYER_APPLICATIONS = 8;
const allowlistCache = new Map<string, AllowlistEntry[]>();

async function loadLocalizationAllowlist(widgetType: string): Promise<AllowlistEntry[] | null> {
  const key = String(widgetType || '').trim();
  if (!key) return null;
  const cached = allowlistCache.get(key);
  if (cached) return cached;

  const res = await tokyoFetch(`/widgets/${encodeURIComponent(key)}/localization.json`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as {
    v?: number;
    paths?: Array<{ path?: string; type?: string }>;
  } | null;
  if (!json || json.v !== 1 || !Array.isArray(json.paths)) return null;

  const allowlist = json.paths
    .map((entry) => {
      const path = typeof entry?.path === 'string' ? entry.path.trim() : '';
      const type: AllowlistEntry['type'] = entry?.type === 'richtext' ? 'richtext' : 'string';
      return { path, type };
    })
    .filter((entry) => entry.path);

  allowlistCache.set(key, allowlist);
  return allowlist;
}

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

async function fetchOverlay(
  publicId: string,
  layer: string,
  layerKey: string,
  baseFingerprint: string
): Promise<InstanceOverlay | null> {
  if (!baseFingerprint) return null;
  const res = await tokyoFetch(
    `/l10n/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(layer)}/${encodeURIComponent(
      layerKey
    )}/${encodeURIComponent(baseFingerprint)}.ops.json`,
    { method: 'GET' }
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as InstanceOverlay | null;
  if (!json || typeof json !== 'object' || json.v !== 1 || !Array.isArray(json.ops)) return null;
  return json;
}

async function fetchLayerIndex(publicId: string): Promise<LayerIndex | null> {
  const res = await tokyoFetch(`/l10n/instances/${encodeURIComponent(publicId)}/index.json`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as LayerIndex | null;
  if (!json || typeof json !== 'object' || json.v !== 1) return null;
  if (!json.layers || typeof json.layers !== 'object') return null;
  return json;
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

function resolveLocaleFromIndex(args: {
  entry: LayerIndexEntry;
  locale: string;
  country?: string | null;
}): string | null {
  if (!args.entry.keys.length) return null;
  const supported = new Set(
    args.entry.keys.map((entry) => normalizeLocaleToken(entry)).filter((value): value is string => Boolean(value)),
  );

  const country = normalizeCountryCode(args.country);
  if (country && GEO_TARGETS_SEMANTICS === 'locale-selection-only') {
    const geoTargets = args.entry.geoTargets ?? {};
    for (const localeKey of args.entry.keys) {
      const locale = normalizeLocaleToken(localeKey);
      if (!locale) continue;
      const geoCountries = normalizeGeoCountries(geoTargets[locale]);
      if (geoCountries && geoCountries.includes(country)) {
        return locale;
      }
    }
  }

  const preferredCandidates = localeCandidates(args.locale, supported);
  if (preferredCandidates.length) return preferredCandidates[0]!;

  if (supported.has('en')) return 'en';
  return args.entry.keys
    .map((entry) => normalizeLocaleToken(entry))
    .find((value): value is string => Boolean(value)) ?? null;
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
}): { targets: LayerTarget[]; missingRequired: string[] } {
  const targets: LayerTarget[] = [];
  const missingRequired: string[] = [];
  const layers = args.index?.layers ?? {};

  const localeKey = normalizeLayerKey('locale', args.locale);
  if (localeKey && localeKey !== 'en') {
    const entry = layers.locale;
    if (!entry || !entry.keys.includes(localeKey)) {
      missingRequired.push(`locale:${localeKey}`);
    } else {
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
    const fallbackCandidates = USER_FALLBACK_ORDER.map((mode) => (mode === 'locale' ? args.locale : 'global'));
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

  return { targets: orderedTargets, missingRequired };
}

export async function resolveTokyoLocale(args: {
  publicId: string;
  locale: string;
  explicit: boolean;
  country?: string | null;
}): Promise<string> {
  const normalized = normalizeLocaleToken(args.locale) ?? 'en';
  if (args.explicit) return normalized;

  const index = await fetchLayerIndex(args.publicId).catch(() => null);
  if (!index || !index.layers?.locale) return normalized;

  return resolveLocaleFromIndex({ entry: index.layers.locale, locale: normalized, country: args.country }) ?? normalized;
}

export async function applyTokyoInstanceOverlay(args: {
  publicId: string;
  locale: string;
  country?: string | null;
  widgetType: string;
  baseUpdatedAt?: string | null;
  baseFingerprint?: string | null;
  config: Record<string, unknown>;
  layerContext?: LayerContext;
  explicitLocale?: boolean;
}): Promise<Record<string, unknown>> {
  const locale = normalizeLocaleToken(args.locale);
  if (!locale) return args.config;

  const widgetType = String(args.widgetType || '').trim();
  if (!widgetType) {
    return args.config;
  }

  const allowlist = await loadLocalizationAllowlist(widgetType).catch(() => null);
  if (!allowlist) {
    return args.config;
  }

  const baseFingerprint = args.baseFingerprint ?? (await computeL10nFingerprint(args.config, allowlist));
  const explicitLocale = args.explicitLocale === true;

  if (explicitLocale) {
    const overlays = await Promise.all([
      fetchOverlay(args.publicId, 'locale', locale, baseFingerprint),
      fetchOverlay(args.publicId, 'user', locale, baseFingerprint),
    ]);
    let localized = args.config;
    for (const overlay of overlays) {
      if (!overlay) continue;
      if (!overlay.baseFingerprint || overlay.baseFingerprint !== baseFingerprint) continue;
      const ops = overlay.ops.filter((o) => o && typeof o === 'object' && o.op === 'set') as LocalizationOp[];
      localized = applySetOps(localized, ops);
    }
    return localized;
  }

  const index = await fetchLayerIndex(args.publicId).catch(() => null);

  if (!index) {
    return args.config;
  }

  const { targets, missingRequired } = resolveLayerTargets({
    index,
    locale,
    country: args.country,
    layerContext: args.layerContext,
  });

  if (missingRequired.length) {
    return args.config;
  }

  if (!targets.length) return args.config;
  const cappedTargets = targets.slice(0, MAX_LAYER_APPLICATIONS);
  const overlayResults = await Promise.all(
    cappedTargets.map(async (target) => {
      const entry = index.layers[target.layer];
      const expected = entry?.lastPublishedFingerprint?.[target.key];
      if (expected && expected !== baseFingerprint) {
        return { target, overlay: null, stale: true };
      }
      const overlay = await fetchOverlay(args.publicId, target.layer, target.key, baseFingerprint);
      if (!overlay) return { target, overlay: null, stale: false };
      if (overlay.baseFingerprint && overlay.baseFingerprint !== baseFingerprint) {
        return { target, overlay: null, stale: true };
      }
      if (!overlay.baseFingerprint) {
        return { target, overlay: null, stale: true };
      }
      return { target, overlay, stale: false };
    }),
  );

  let localized = args.config;
  for (const result of overlayResults) {
    if (!result.overlay) {
      continue;
    }
    const ops = result.overlay.ops.filter((o) => o && typeof o === 'object' && o.op === 'set') as LocalizationOp[];
    localized = applySetOps(localized, ops);
  }

  return localized;
}
