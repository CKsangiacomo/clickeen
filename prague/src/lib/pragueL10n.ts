import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeBaseFingerprint,
  GEO_TARGETS_SEMANTICS,
  LAYER_MULTI_KEY_ORDER,
  LAYER_ORDER,
  USER_FALLBACK_ORDER,
  localeCandidates,
  normalizeLocaleToken,
} from '@clickeen/l10n';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const BASE_ROOT = path.join(REPO_ROOT, 'prague', 'content', 'base', 'v1');
const LOCALES_PATH = path.join(REPO_ROOT, 'config', 'locales.json');

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

let cachedLocales: string[] | null = null;

async function readJson(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as unknown;
}

async function loadLocales(): Promise<string[]> {
  if (cachedLocales) return cachedLocales;
  const raw = await readJson(LOCALES_PATH);
  if (!Array.isArray(raw)) {
    throw new Error(`[prague] Invalid locales file: ${LOCALES_PATH}`);
  }
  const locales = raw
    .map((value) => normalizeLocaleToken(value))
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

function getTokyoBaseUrl(): string {
  const envUrl = typeof process !== 'undefined' ? process.env.PUBLIC_TOKYO_URL : undefined;
  const raw = String(envUrl || '').trim();
  if (!raw) {
    throw new Error('[prague] PUBLIC_TOKYO_URL is required (e.g. https://tokyo.dev.clickeen.com)');
  }
  return raw.replace(/\/+$/, '');
}

function isDevStrict(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

async function fetchLayerIndex(pageId: string): Promise<LayerIndex | null> {
  const baseUrl = getTokyoBaseUrl();
  const path = `/l10n/prague/${encodePathSegments(pageId)}/index.json`;
  const res = await fetch(`${baseUrl}${path}`, { method: 'GET' });
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

function resolveLocaleFromIndex(args: { entry: LayerIndexEntry; locale: string; country?: string | null }): string | null {
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

  const candidates = localeCandidates(args.locale, supported);
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
  const path = `/l10n/prague/${encodePathSegments(args.pageId)}/${encodeURIComponent(args.layer)}/${encodeURIComponent(
    args.layerKey
  )}/${encodeURIComponent(args.baseFingerprint)}.ops.json`;
  const res = await fetch(`${baseUrl}${path}`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as PragueOverlay | null;
  if (!json || typeof json !== 'object' || json.v !== 1 || !Array.isArray(json.ops)) return null;
  return json;
}

async function applyPragueLayeredOverlays(args: {
  pageId: string;
  locale: string;
  base: Record<string, unknown>;
  country?: string | null;
  layerContext?: LayerContext;
}): Promise<Record<string, unknown>> {
  const normalized = normalizeLocaleToken(args.locale);
  if (!normalized) return args.base;

  const baseFingerprint = await computeBaseFingerprint(args.base);
  const index = await fetchLayerIndex(args.pageId).catch(() => null);

  if (!index) {
    if (isDevStrict() && normalized !== 'en') {
      throw new Error(`[prague] Missing layer index for ${args.pageId}`);
    }
    return args.base;
  }
  if (index.publicId && index.publicId !== args.pageId) {
    throw new Error(`[prague] Layer index publicId mismatch for ${args.pageId}`);
  }

  const { targets, missingRequired } = resolveLayerTargets({
    index,
    locale: normalized,
    country: args.country,
    layerContext: args.layerContext,
  });

  if (missingRequired.length) {
    if (isDevStrict() && normalized !== 'en') {
      throw new Error(`[prague] Missing required layer keys for ${args.pageId}: ${missingRequired.join(', ')}`);
    }
    return args.base;
  }

  if (!targets.length) return args.base;
  const cappedTargets = targets.slice(0, MAX_LAYER_APPLICATIONS);
  const overlayResults = await Promise.all(
    cappedTargets.map(async (target) => {
      const entry = index.layers[target.layer];
      const expected = entry?.lastPublishedFingerprint?.[target.key];
      if (expected && expected !== baseFingerprint) {
        return { target, overlay: null, stale: true };
      }
      const overlay = await fetchOverlay({
        pageId: args.pageId,
        layer: target.layer,
        layerKey: target.key,
        baseFingerprint,
      });
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

  let localized = args.base;
  for (const result of overlayResults) {
    if (!result.overlay) {
      if (result.stale && isDevStrict() && normalized !== 'en') {
        throw new Error(
          `[prague] Stale overlay for ${args.pageId} (${result.target.layer}:${result.target.key})`,
        );
      }
      if (result.target.required && isDevStrict() && normalized !== 'en') {
        throw new Error(
          `[prague] Missing overlay for ${args.pageId} (${result.target.layer}:${result.target.key})`,
        );
      }
      continue;
    }
    const ops = result.overlay.ops.filter((o) => o && typeof o === 'object' && o.op === 'set') as PragueOverlay['ops'];
    localized = applySetOps(localized, ops);
  }

  return localized;
}

export async function loadPraguePageContent(args: { locale: string; pageId: string }) {
  const resolved = await resolveLocale(args.locale);
  const basePath = path.join(BASE_ROOT, `${args.pageId}.json`);
  const json = await readJson(basePath);
  if (!isPlainObject(json) || (json as any).v !== 1) {
    throw new Error(`[prague] Invalid Prague base file: ${basePath}`);
  }
  const pageId = typeof (json as any).pageId === 'string' ? String((json as any).pageId) : '';
  if (pageId && pageId !== args.pageId) {
    throw new Error(`[prague] Prague base pageId mismatch: ${basePath}`);
  }
  if (!isPlainObject((json as any).blocks)) {
    throw new Error(`[prague] Prague base missing blocks: ${basePath}`);
  }

  return applyPragueLayeredOverlays({ pageId: args.pageId, locale: resolved, base: json as Record<string, unknown> });
}

export async function loadPragueChromeStrings(locale: string): Promise<Record<string, unknown>> {
  const resolved = await resolveLocale(locale);
  const basePath = path.join(BASE_ROOT, 'chrome.json');
  const json = await readJson(basePath);
  if (!isPlainObject(json) || (json as any).v !== 1 || !isPlainObject((json as any).strings)) {
    throw new Error(`[prague] Invalid chrome base file: ${basePath}`);
  }
  const localized = await applyPragueLayeredOverlays({ pageId: 'chrome', locale: resolved, base: json as Record<string, unknown> });
  const strings = (localized as any).strings;
  if (!isPlainObject(strings)) {
    throw new Error(`[prague] Invalid chrome strings shape after overlay (${resolved})`);
  }
  return strings as Record<string, unknown>;
}
