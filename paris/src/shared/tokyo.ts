import { parseLimitsSpec } from '@clickeen/ck-policy';
import type { Env } from './types';
import type { LimitsSpec } from '@clickeen/ck-policy';

const TOKYO_BASE_ENV_KEY = 'TOKYO_BASE_URL';
const TOKYO_LEGACY_PATH_PREFIXES = new Set(['/assets', '/arsenale', '/dieter', '/widgets', '/renders', '/l10n', '/i18n']);

function normalizeTokyoBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const normalized = trimmed.replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }

  if (parsed.search || parsed.hash) {
    throw new Error(`[ParisWorker] Invalid ${TOKYO_BASE_ENV_KEY}: query/hash is not allowed (${trimmed})`);
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath === '/') return parsed.origin;
  if (TOKYO_LEGACY_PATH_PREFIXES.has(normalizedPath)) return parsed.origin;

  throw new Error(`[ParisWorker] Invalid ${TOKYO_BASE_ENV_KEY}: expected Tokyo origin, got path "${parsed.pathname}"`);
}

export function requireTokyoBase(env: Env) {
  const base = env.TOKYO_BASE_URL?.trim();
  if (!base) {
    throw new Error('[ParisWorker] Missing required env var: TOKYO_BASE_URL');
  }
  return normalizeTokyoBaseUrl(base);
}

const widgetTypeExistenceCache = new Map<string, boolean>();

export async function isKnownWidgetType(env: Env, widgetType: string): Promise<boolean> {
  const cached = widgetTypeExistenceCache.get(widgetType);
  if (cached !== undefined) return cached;

  const base = requireTokyoBase(env);
  const url = `${base}/widgets/${encodeURIComponent(widgetType)}/spec.json`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (res.status === 404) {
    widgetTypeExistenceCache.set(widgetType, false);
    return false;
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[ParisWorker] Failed to validate widget type (${res.status}): ${detail}`);
  }
  widgetTypeExistenceCache.set(widgetType, true);
  return true;
}

export async function loadWidgetLimits(env: Env, widgetType: string): Promise<LimitsSpec | null> {
  const base = requireTokyoBase(env);
  const url = `${base}/widgets/${encodeURIComponent(widgetType)}/limits.json`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(`[ParisWorker] Failed to load widget limits (${res.status}): ${details}`);
  }
  const json = await res.json();
  return parseLimitsSpec(json);
}
