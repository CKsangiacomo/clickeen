import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeBaseFingerprint, localeCandidates, normalizeLocaleToken } from '@clickeen/l10n';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const BASE_ROOT = path.join(REPO_ROOT, 'prague', 'content', 'base', 'v1');
const LOCALES_PATH = path.join(REPO_ROOT, 'config', 'locales.json');

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

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
  const metaUrl = (import.meta as any)?.env?.PUBLIC_TOKYO_URL as string | undefined;
  const raw = String(envUrl || metaUrl || '').trim();
  if (!raw) {
    throw new Error('[prague] PUBLIC_TOKYO_URL is required (e.g. https://tokyo.dev.clickeen.com)');
  }
  return raw.replace(/\/+$/, '');
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

function resolveLocaleFromIndex(args: { entry: LayerIndexEntry; locale: string }): string | null {
  if (!args.entry.keys.length) return null;
  const supported = new Set(
    args.entry.keys.map((entry) => normalizeLocaleToken(entry)).filter((value): value is string => Boolean(value)),
  );
  const candidates = localeCandidates(args.locale, supported);
  if (candidates.length) return candidates[0]!;
  return null;
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

  const index = await fetchLayerIndex(args.pageId);
  if (!index || !index.layers?.locale) {
    throw new Error(`[prague] Missing layer index for ${args.pageId}`);
  }
  if (index.publicId && index.publicId !== args.pageId) {
    throw new Error(`[prague] Layer index publicId mismatch for ${args.pageId}`);
  }
  if (resolved === 'en') return json as Record<string, unknown>;
  const localeKey = resolveLocaleFromIndex({ entry: index.layers.locale, locale: resolved });
  if (!localeKey) {
    throw new Error(`[prague] Missing locale entry for ${args.pageId} (${resolved})`);
  }
  if (localeKey === 'en') return json as Record<string, unknown>;

  const baseFingerprint = await computeBaseFingerprint(json as Record<string, unknown>);
  const expectedFingerprint = index.layers.locale.lastPublishedFingerprint?.[localeKey];
  if (expectedFingerprint && expectedFingerprint !== baseFingerprint) {
    throw new Error(`[prague] Stale overlay fingerprint for ${args.pageId} (${localeKey})`);
  }
  const overlay = await fetchOverlay({
    pageId: args.pageId,
    layer: 'locale',
    layerKey: localeKey,
    baseFingerprint,
  });
  if (!overlay) {
    throw new Error(`[prague] Missing overlay for ${args.pageId} (${localeKey})`);
  }
  if (overlay.baseFingerprint && overlay.baseFingerprint !== baseFingerprint) {
    throw new Error(`[prague] Stale overlay for ${args.pageId} (${localeKey})`);
  }
  if (!overlay.baseFingerprint) {
    throw new Error(`[prague] Missing overlay fingerprint for ${args.pageId} (${localeKey})`);
  }
  return applySetOps(json as Record<string, unknown>, overlay.ops);
}

export async function loadPragueChromeStrings(locale: string): Promise<Record<string, unknown>> {
  const resolved = await resolveLocale(locale);
  const basePath = path.join(BASE_ROOT, 'chrome.json');
  const json = await readJson(basePath);
  if (!isPlainObject(json) || (json as any).v !== 1 || !isPlainObject((json as any).strings)) {
    throw new Error(`[prague] Invalid chrome base file: ${basePath}`);
  }
  const index = await fetchLayerIndex('chrome');
  if (!index || !index.layers?.locale) {
    throw new Error('[prague] Missing chrome layer index');
  }
  if (index.publicId && index.publicId !== 'chrome') {
    throw new Error('[prague] Chrome layer index publicId mismatch');
  }
  if (resolved === 'en') return (json as any).strings as Record<string, unknown>;
  const localeKey = resolveLocaleFromIndex({ entry: index.layers.locale, locale: resolved });
  if (!localeKey) {
    throw new Error(`[prague] Missing chrome locale entry for ${resolved}`);
  }

  const baseFingerprint = await computeBaseFingerprint(json as Record<string, unknown>);
  const expectedFingerprint = index.layers.locale.lastPublishedFingerprint?.[localeKey];
  if (expectedFingerprint && expectedFingerprint !== baseFingerprint) {
    throw new Error(`[prague] Stale chrome overlay fingerprint for ${localeKey}`);
  }
  const overlay = await fetchOverlay({ pageId: 'chrome', layer: 'locale', layerKey: localeKey, baseFingerprint });
  if (!overlay) {
    throw new Error(`[prague] Missing chrome overlay for ${localeKey}`);
  }
  if (overlay.baseFingerprint && overlay.baseFingerprint !== baseFingerprint) {
    throw new Error(`[prague] Stale chrome overlay for ${localeKey}`);
  }
  if (!overlay.baseFingerprint) {
    throw new Error(`[prague] Missing chrome overlay fingerprint for ${localeKey}`);
  }
  const localized = applySetOps(json as Record<string, unknown>, overlay.ops);
  const strings = (localized as any).strings;
  if (!isPlainObject(strings)) {
    throw new Error(`[prague] Invalid chrome strings shape after overlay (${resolved})`);
  }
  return strings as Record<string, unknown>;
}
