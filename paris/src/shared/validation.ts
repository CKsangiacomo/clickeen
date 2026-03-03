import { ckError } from './errors';
import { isUuid as isContractUuid, parseCanonicalAssetRef, toCanonicalAssetVersionPath } from '@clickeen/ck-contracts';
import { normalizeSupportedLocaleToken } from './l10n';
import type { LocalePolicy } from './types';

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export const isUuid = isContractUuid;

export function assertWorkspaceId(value: unknown) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || !isUuid(trimmed)) {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' }, 422) };
  }
  return { ok: true as const, value: trimmed };
}

export function assertConfig(config: unknown) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { ok: false as const, issues: [{ path: 'config', message: 'config must be an object' }] };
  }
  const assetIssues = configAssetUrlContractIssues(config);
  if (assetIssues.length) {
    return { ok: false as const, issues: assetIssues };
  }
  return { ok: true as const, value: config as Record<string, unknown> };
}

export function assertMeta(meta: unknown) {
  if (meta === null) {
    return { ok: true as const, value: null };
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { ok: false as const, issues: [{ path: 'meta', message: 'meta must be an object' }] };
  }
  return { ok: true as const, value: meta as Record<string, unknown> };
}

function containsNonPersistableUrl(value: string): boolean {
  return /(?:^|[\s("'=,])(?:data|blob):/i.test(value);
}

function extractPathnameFromUrlCandidate(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).pathname || '/';
    } catch {
      return null;
    }
  }

  if (/^\/\//.test(value)) {
    try {
      return new URL(`https:${value}`).pathname || '/';
    } catch {
      return null;
    }
  }

  if (value.startsWith('/')) return value;
  if (value.startsWith('./') || value.startsWith('../')) return value;
  return null;
}

function parseCanonicalAccountAssetPath(pathname: string): { accountId: string; assetId: string } | null {
  const parsed = parseCanonicalAssetRef(pathname);
  if (!parsed) return null;
  return { accountId: parsed.accountId, assetId: parsed.assetId };
}

function isStaticTokyoAssetPath(pathname: string): boolean {
  return pathname.startsWith('/widgets/') || pathname.startsWith('/themes/') || pathname.startsWith('/dieter/');
}

function isLikelyAssetFieldPath(path: string): boolean {
  return /(?:^|[\].])(?:src|poster|logoFill)$/.test(String(path || ''));
}

function isLogoFillFieldPath(path: string): boolean {
  return /(?:^|[\].])logoFill$/.test(String(path || ''));
}

function isAssetVersionIdFieldPath(path: string): boolean {
  return /(?:^|[\].])(?:asset|poster)\.versionId$/.test(String(path || ''));
}

function isMediaAssetRefFieldPath(path: string): boolean {
  return /(?:^|[\].])(?:image|video)\.(?:asset|poster)$/.test(String(path || ''));
}

function isPersistedMediaUrlFieldPath(path: string): boolean {
  const value = String(path || '');
  return (
    /(?:^|[\].])(?:fill\.)?image\.src$/.test(value) ||
    /(?:^|[\].])(?:fill\.)?video\.src$/.test(value) ||
    /(?:^|[\].])(?:fill\.)?video\.posterSrc$/.test(value) ||
    /(?:^|[\].])(?:fill\.)?video\.poster$/.test(value)
  );
}

export function configAssetUrlContractIssues(
  config: unknown,
  expectedAccountId?: string | null,
): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  const expectedAccount = typeof expectedAccountId === 'string' ? expectedAccountId.trim() : '';
  const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

  const inspectCandidate = (candidateRaw: string, path: string) => {
    const candidate = String(candidateRaw || '').trim();
    if (!candidate) return;
    if (/^(?:data|blob):/i.test(candidate)) return;

    const pathname = extractPathnameFromUrlCandidate(candidate);
    if (!pathname) return;

    if (pathname.includes('/curated-assets/')) {
      issues.push({
        path,
        message: `Legacy asset URL path is not supported: ${candidate}`,
      });
      return;
    }

    if (pathname.startsWith('/arsenale/')) {
      issues.push({
        path,
        message: `Legacy asset URL path is not supported: ${candidate}. Use asset.versionId refs only.`,
      });
      return;
    }

    if (pathname.startsWith('/assets/v/')) {
      if (isLogoFillFieldPath(path)) {
        issues.push({
          path,
          message: `Persisted logoFill asset URL is not supported at ${path}. Use asset.versionId refs only.`,
        });
        return;
      }
      issues.push({
        path,
        message: `Persisted asset URL path is not supported at ${path}. Use asset.versionId refs only.`,
      });
      return;
    }

    if (pathname.startsWith('./') || pathname.startsWith('../')) {
      issues.push({
        path,
        message: `Relative asset URL path is not supported: ${candidate}`,
      });
      return;
    }

    if (isStaticTokyoAssetPath(pathname)) return;

    issues.push({
      path,
      message: `Unsupported asset URL path: ${candidate}`,
    });
  };

  const inspectVersionIdCandidate = (candidateRaw: string, path: string) => {
    const candidate = String(candidateRaw || '').trim();
    if (!candidate) {
      issues.push({
        path,
        message: 'Asset version id is required',
      });
      return;
    }

    const canonicalPath = toCanonicalAssetVersionPath(candidate);
    if (!canonicalPath) {
      issues.push({
        path,
        message: `Asset version id must be a canonical immutable key: ${candidate}`,
      });
      return;
    }

    const parsed = parseCanonicalAccountAssetPath(canonicalPath);
    if (!parsed || !isUuid(parsed.accountId) || !isUuid(parsed.assetId)) {
      issues.push({
        path,
        message: `Asset version id is invalid: ${candidate}`,
      });
      return;
    }

    if (expectedAccount && parsed.accountId !== expectedAccount) {
      issues.push({
        path,
        message: `Asset version account mismatch at ${path}: expected ${expectedAccount}, got ${parsed.accountId}`,
      });
    }
  };

  const visit = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (isPersistedMediaUrlFieldPath(path)) {
        issues.push({
          path,
          message: `Persisted media URL fields are not supported at ${path}. Use asset.versionId refs only.`,
        });
        return;
      }

      if (isAssetVersionIdFieldPath(path)) {
        inspectVersionIdCandidate(node, path);
        return;
      }

      if (isMediaAssetRefFieldPath(path)) {
        issues.push({
          path,
          message: `Asset ref at ${path} must be an object with versionId.`,
        });
        return;
      }

      let matchedCssUrl = false;
      let match: RegExpExecArray | null = urlPattern.exec(node);
      while (match) {
        matchedCssUrl = true;
        inspectCandidate(match[2] || '', path);
        match = urlPattern.exec(node);
      }
      urlPattern.lastIndex = 0;

      if (!matchedCssUrl && isLikelyAssetFieldPath(path)) {
        inspectCandidate(node, path);
      }
      return;
    }

    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], `${path}[${i}]`);
      }
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
      visit(value, nextPath);
    }
  };

  visit(config, 'config');
  return issues;
}

export function configNonPersistableUrlIssues(config: unknown): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];

  const visit = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (containsNonPersistableUrl(node)) {
        issues.push({
          path,
          message: 'non-persistable URL scheme found (data:/blob:). Persist stable URLs/keys only.',
        });
      }
      return;
    }

    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], `${path}[${i}]`);
      }
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
      visit(value, nextPath);
    }
  };

  visit(config, 'config');
  return issues;
}

export function assertStatus(status: unknown) {
  if (status === undefined) return { ok: true as const, value: undefined };
  if (status !== 'published' && status !== 'unpublished') {
    return { ok: false as const, issues: [{ path: 'status', message: 'invalid status' }] };
  }
  return { ok: true as const, value: status as 'published' | 'unpublished' };
}

export function assertSeoGeo(seoGeo: unknown) {
  if (seoGeo === undefined) return { ok: true as const, value: undefined };
  if (typeof seoGeo !== 'boolean') {
    return { ok: false as const, issues: [{ path: 'seoGeo', message: 'seoGeo must be a boolean' }] };
  }
  return { ok: true as const, value: seoGeo };
}

export function assertLocalePolicy(localePolicy: unknown) {
  if (localePolicy === undefined) return { ok: true as const, value: undefined };
  if (!isRecord(localePolicy)) {
    return { ok: false as const, issues: [{ path: 'localePolicy', message: 'localePolicy must be an object' }] };
  }

  const issues: Array<{ path: string; message: string }> = [];
  const baseLocale = normalizeSupportedLocaleToken((localePolicy as any).baseLocale);
  if (!baseLocale) {
    issues.push({ path: 'localePolicy.baseLocale', message: 'baseLocale must be a supported locale token' });
  }

  const availableLocalesRaw = (localePolicy as any).availableLocales;
  if (!Array.isArray(availableLocalesRaw)) {
    issues.push({ path: 'localePolicy.availableLocales', message: 'availableLocales must be an array' });
  }
  const availableLocales: string[] = [];
  const seenLocales = new Set<string>();
  if (Array.isArray(availableLocalesRaw)) {
    availableLocalesRaw.forEach((entry, index) => {
      const normalized = normalizeSupportedLocaleToken(entry);
      if (!normalized) {
        issues.push({
          path: `localePolicy.availableLocales[${index}]`,
          message: 'locale must be a supported locale token',
        });
        return;
      }
      if (!seenLocales.has(normalized)) {
        seenLocales.add(normalized);
        availableLocales.push(normalized);
      }
    });
  }

  if (baseLocale && !seenLocales.has(baseLocale)) {
    issues.push({
      path: 'localePolicy.availableLocales',
      message: 'availableLocales must include baseLocale',
    });
  }

  const ipRaw = isRecord((localePolicy as any).ip) ? ((localePolicy as any).ip as Record<string, unknown>) : null;
  const ipEnabled = typeof ipRaw?.enabled === 'boolean' ? ipRaw.enabled : false;
  const countryToLocale: Record<string, string> = {};
  if (ipRaw && Object.prototype.hasOwnProperty.call(ipRaw, 'countryToLocale')) {
    const mapRaw = ipRaw.countryToLocale;
    if (!isRecord(mapRaw)) {
      issues.push({ path: 'localePolicy.ip.countryToLocale', message: 'countryToLocale must be an object' });
    } else {
      for (const [countryRaw, localeRaw] of Object.entries(mapRaw)) {
        const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
        if (!/^[A-Z]{2}$/.test(country)) continue;
        const normalized = normalizeSupportedLocaleToken(localeRaw);
        if (!normalized) continue;
        if (!seenLocales.has(normalized)) continue;
        countryToLocale[country] = normalized;
      }
    }
  }

  const switcherRaw = isRecord((localePolicy as any).switcher)
    ? ((localePolicy as any).switcher as Record<string, unknown>)
    : null;
  const switcherEnabled = typeof switcherRaw?.enabled === 'boolean' ? switcherRaw.enabled : false;

  if (issues.length) return { ok: false as const, issues };

  const value: LocalePolicy = {
    baseLocale: baseLocale || 'en',
    availableLocales,
    ip: {
      enabled: ipEnabled,
      countryToLocale: ipEnabled ? countryToLocale : {},
    },
    switcher: {
      enabled: switcherEnabled,
    },
  };

  return { ok: true as const, value };
}

export function assertDisplayName(displayName: unknown) {
  if (displayName === undefined) return { ok: true as const, value: undefined };
  if (displayName === null) return { ok: true as const, value: null };
  if (typeof displayName !== 'string') {
    return { ok: false as const, issues: [{ path: 'displayName', message: 'displayName must be a string' }] };
  }
  const trimmed = displayName.trim();
  if (!trimmed) {
    return { ok: false as const, issues: [{ path: 'displayName', message: 'displayName cannot be empty' }] };
  }
  if (trimmed.length > 120) {
    return { ok: false as const, issues: [{ path: 'displayName', message: 'displayName must be <= 120 chars' }] };
  }
  return { ok: true as const, value: trimmed };
}
