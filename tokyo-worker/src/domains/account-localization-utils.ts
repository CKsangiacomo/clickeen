import type { LocalizationOp } from '@clickeen/ck-contracts';
import { normalizeLocaleToken, type AllowlistEntry } from '@clickeen/l10n';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

export function parseBearerToken(value: string | null): string | null {
  if (!value) return null;
  const [scheme, token] = value.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  const normalized = String(token || '').trim();
  return normalized || null;
}

function pathMatchesAllowlist(pathStr: string, allowPath: string): boolean {
  const pathSegments = String(pathStr || '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const allowSegments = String(allowPath || '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (pathSegments.length !== allowSegments.length) return false;
  for (let index = 0; index < allowSegments.length; index += 1) {
    const allow = allowSegments[index];
    const actual = pathSegments[index];
    if (allow === '*') {
      if (!/^\d+$/.test(actual || '')) return false;
      continue;
    }
    if (allow !== actual) return false;
  }
  return true;
}

export function filterAllowlistedOps(
  ops: LocalizationOp[],
  allowlist: AllowlistEntry[],
): LocalizationOp[] {
  const allowlistPaths = allowlist
    .map((entry) => String(entry.path || '').trim())
    .filter(Boolean);
  return ops.filter((entry) =>
    allowlistPaths.some((path) => pathMatchesAllowlist(entry.path, path)),
  );
}

export function normalizeReadyLocales(args: {
  baseLocale: string;
  locales: string[];
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (locale: string) => {
    const normalized = normalizeLocaleToken(locale);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  push(args.baseLocale);
  args.locales.forEach(push);
  return out;
}

export function resolveTokyoControlErrorDetail(
  payload: unknown,
  fallback: string,
): string {
  if (isRecord(payload) && isRecord(payload.error)) {
    const reasonKey = asTrimmedString(payload.error.reasonKey);
    if (reasonKey) return reasonKey;
    const detail = asTrimmedString(payload.error.detail);
    if (detail) return detail;
  }
  return fallback;
}

export function normalizeAllowlistEntries(raw: unknown): AllowlistEntry[] {
  if (!isRecord(raw)) return [];
  const paths = Array.isArray(raw.paths) ? raw.paths : [];
  return paths.reduce<AllowlistEntry[]>((entries, entry) => {
    if (!isRecord(entry)) return entries;
    const path = asTrimmedString(entry.path);
    if (!path) return entries;
    entries.push({
      path,
      type: entry.type === 'richtext' ? 'richtext' : 'string',
    });
    return entries;
  }, []);
}
