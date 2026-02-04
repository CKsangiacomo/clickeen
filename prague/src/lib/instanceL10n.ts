import { normalizeCanonicalLocalesFile, normalizeLocaleToken, resolveLocaleLabel } from '@clickeen/l10n';
import localesJson from '../../../config/locales.json';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);

type InstanceLayerIndex = {
  v: 1;
  publicId: string;
  layers?: {
    locale?: {
      keys?: string[];
    };
  };
};

function readEnv(name: string): string | undefined {
  const proc = typeof process !== 'undefined' ? process : undefined;
  const procValue = proc?.env ? proc.env[name] : undefined;
  if (typeof procValue === 'string' && procValue.trim()) return procValue.trim();
  return undefined;
}

function getTokyoBaseUrl(): string {
  const meta = String((import.meta as any)?.env?.PUBLIC_TOKYO_URL || '').trim();
  const raw = meta || readEnv('PUBLIC_TOKYO_URL') || '';
  if (!raw.trim()) {
    throw new Error('[prague] PUBLIC_TOKYO_URL is required to resolve instance locales');
  }
  return raw.replace(/\/+$/, '');
}

function getPragueBuildId(): string | null {
  const meta = String((import.meta as any)?.env?.PUBLIC_PRAGUE_BUILD_ID || '').trim();
  const raw = meta || readEnv('PUBLIC_PRAGUE_BUILD_ID') || '';
  return raw.trim() ? raw.trim() : null;
}

async function fetchJson(url: string): Promise<{ status: number; ok: boolean; json: unknown | null }> {
  const res = await fetch(url, { method: 'GET' });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, json };
}

function normalizeLocaleKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return keys
    .map((k) => normalizeLocaleToken(k))
    .filter((k): k is string => Boolean(k));
}

export async function resolveTokyoInstanceLocales(publicId: string): Promise<string[] | null> {
  const id = String(publicId || '').trim();
  if (!id) return null;

  const baseUrl = getTokyoBaseUrl();
  const buildId = getPragueBuildId();

  const candidates: string[] = [];
  if (buildId) {
    candidates.push(`${baseUrl}/l10n/v/${encodeURIComponent(buildId)}/instances/${encodeURIComponent(id)}/index.json`);
  }
  candidates.push(`${baseUrl}/l10n/instances/${encodeURIComponent(id)}/index.json`);

  for (const url of candidates) {
    const { status, ok, json } = await fetchJson(url);
    if (status === 404) continue;
    if (!ok || !json || typeof json !== 'object') return null;

    const parsed = json as InstanceLayerIndex;
    if (parsed.v !== 1) return null;

    const keys = normalizeLocaleKeys(parsed.layers?.locale?.keys);
    if (!keys.length) return null;

    // Keep stable order but ensure 'en' is present.
    const unique = Array.from(new Set(keys));
    if (!unique.includes('en')) unique.unshift('en');
    return unique;
  }

  return null;
}

export function chooseShowcaseTiles(allLocales: string[]): string[] {
  const unique = Array.from(new Set(allLocales.map((l) => normalizeLocaleToken(l)).filter((l): l is string => Boolean(l))));
  const preferred = ['en', 'es', 'ja'];
  const picked: string[] = [];
  for (const p of preferred) {
    if (unique.includes(p)) picked.push(p);
  }
  for (const l of unique) {
    if (picked.length >= 3) break;
    if (!picked.includes(l)) picked.push(l);
  }
  return picked.slice(0, 3);
}

export function sortLocaleOptions(locales: string[]): string[] {
  const unique = Array.from(new Set(locales.map((l) => normalizeLocaleToken(l)).filter((l): l is string => Boolean(l))));
  const pinned = ['en', 'es', 'ja'];
  const pinnedSet = new Set(pinned);
  const head = pinned.filter((l) => unique.includes(l));
  const tail = unique.filter((l) => !pinnedSet.has(l)).sort((a, b) => a.localeCompare(b));
  return [...head, ...tail];
}

export function localeLabel(locale: string, uiLocale = 'en'): string {
  return resolveLocaleLabel({ locales: CANONICAL_LOCALES, uiLocale, targetLocale: locale });
}
