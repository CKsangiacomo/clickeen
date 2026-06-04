import { normalizeCanonicalLocalesFile, normalizeLocaleToken } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { isCompactAccountPublicId } from './overlay-identity';
export { UUID_RE, isUuid } from './ids';
export * from './instance-translation-jobs';
export * from './overlay-codebooks';
export * from './overlay-identity';
export * from './translated-value-primitives';
export * from './translation-product-state';

export const INSTANCE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/;

export const ACCOUNT_ASSET_PATH_RE = /^\/assets\/account\/([^/?#]+)\/(.+)$/;
export const ACCOUNT_ASSET_PATH_PATTERN = '^/assets/account/([^/?#]+)/(.+)$';
const ACCOUNT_ASSET_KEY_RE = /^accounts\/([^/]+)\/assets\/(.+)$/i;

type JsonRecord = Record<string, any>;

export type AssetRefKind = 'account';
export type AssetRef = {
  accountId: string;
  assetRef: string;
  kind: AssetRefKind;
  filename: string;
  key: string;
  pathname: string;
};

export type ResolvedAssetMaterialization = {
  assetRef: string;
  url: string;
};

export type AccountAssetRecord = {
  assetRef: string;
  assetType: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export type ResolvedAccountAsset = {
  assetRef: string;
  url: string;
};

export type AccountAssetHostCommand = 'list-assets' | 'resolve-assets' | 'upload-asset';

export type RateLimitRecord = {
  count: number;
  resetAt: number;
};

export type AccountLocalePolicy = {
  v: 1;
  baseLocale: string;
  ip: {
    countryToLocale: Record<string, string>;
  };
};

export type WidgetLocaleSwitcherSettings = {
  enabled: boolean;
  byIp: boolean;
  alwaysShowLocale: string | null;
  attachTo: 'pod' | 'stage';
  position:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'right-middle'
    | 'bottom-right'
    | 'bottom-center'
    | 'bottom-left'
    | 'left-middle';
};

export type AccountLocaleValidationIssue = {
  path: string;
  message: string;
};

export const CK_ERROR_CODE = Object.freeze({
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  DENY: 'DENY',
  INTERNAL: 'INTERNAL',
});

export const INSTANCE_PUBLISH_STATUS = Object.freeze({
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
});

export const RENDER_SNAPSHOT_ACTION = Object.freeze({
  UPSERT: 'upsert',
  DELETE: 'delete',
});
const SUPPORTED_LOCALES = new Set(normalizeCanonicalLocalesFile(localesJson).map((entry) => entry.code));
const WIDGET_LOCALE_SWITCHER_ATTACH = new Set(['pod', 'stage']);
const WIDGET_LOCALE_SWITCHER_POSITION = new Set([
  'top-left',
  'top-center',
  'top-right',
  'right-middle',
  'bottom-right',
  'bottom-center',
  'bottom-left',
  'left-middle',
]);

function failAccountLocaleContract(reason: string): never {
  throw new Error(`account_locale_contract_invalid:${reason}`);
}

function normalizeSupportedLocaleToken(raw: unknown): string | null {
  const normalized = normalizeLocaleToken(raw);
  if (!normalized) return null;
  return SUPPORTED_LOCALES.has(normalized) ? normalized : null;
}

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asTrimmedString(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadPart = parts[1] || '';
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as unknown;
    if (!isRecord(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function tokenIsExpired(token: string, leewaySeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  const expClaim = payload?.exp;
  const exp =
    typeof expClaim === 'number'
      ? expClaim
      : typeof expClaim === 'string'
        ? Number.parseInt(expClaim, 10)
        : Number.NaN;
  if (!Number.isFinite(exp)) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + leewaySeconds;
}

export function normalizeInstanceId(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  if (value === '.' || value === '..') return null;
  if (value.includes('/') || value.includes('\\')) return null;
  return INSTANCE_ID_RE.test(value) ? value : null;
}

export function isInstanceId(raw: unknown): raw is string {
  return normalizeInstanceId(raw) != null;
}

function decodePathPart(raw: unknown): string {
  try {
    return decodeURIComponent(String(raw || '')).trim();
  } catch {
    return '';
  }
}

function pathnameFromRawAssetRef(raw: unknown): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.startsWith('/')) return value;
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    return new URL(value).pathname || '/';
  } catch {
    return null;
  }
}

export function normalizeAccountAssetRef(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim().replace(/^\/+/, '') : '';
  if (!value || value.length > 240) return null;
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  if (segments.some((segment) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(segment))) return null;
  return segments.join('/');
}

export function filenameFromAssetRef(assetRef: string): string {
  return assetRef.split('/').pop() || assetRef;
}

export function encodeAssetRefPath(assetRef: string): string {
  return assetRef.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

export function parseRateLimitRecord(value: unknown): RateLimitRecord | null {
  if (!isRecord(value)) return null;
  const count =
    typeof value.count === 'number' && Number.isFinite(value.count)
      ? Math.max(0, Math.trunc(value.count))
      : null;
  const resetAt =
    typeof value.resetAt === 'number' && Number.isFinite(value.resetAt)
      ? Math.max(0, Math.trunc(value.resetAt))
      : null;
  if (count == null || resetAt == null) return null;
  return { count, resetAt };
}

export function looksLikeHtmlErrorPage(text: string): boolean {
  const value = String(text || '').trim().slice(0, 2000).toLowerCase();
  if (!value) return false;
  return (
    value.startsWith('<!doctype html') ||
    value.startsWith('<html') ||
    value.includes('<html') ||
    value.includes('id="cf-wrapper"') ||
    value.includes("id='cf-wrapper'") ||
    value.includes('cloudflare.com/5xx-error-landing')
  );
}

export function normalizeAccountAssetRecord(raw: unknown): AccountAssetRecord | null {
  if (!isRecord(raw)) return null;
  const assetRef = normalizeAccountAssetRef(raw.assetRef);
  const assetType = asTrimmedString(raw.assetType) ?? '';
  const filename = asTrimmedString(raw.filename) ?? (assetRef ? filenameFromAssetRef(assetRef) : '');
  const contentType = asTrimmedString(raw.contentType) ?? '';
  const createdAt = asTrimmedString(raw.createdAt) ?? '';
  const sizeBytes = Number(raw.sizeBytes);
  if (!assetRef || !filename) return null;
  return {
    assetRef,
    assetType: assetType || 'other',
    filename,
    contentType: contentType || 'application/octet-stream',
    sizeBytes: Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0,
    createdAt: createdAt || new Date().toISOString(),
  };
}

export function normalizeResolvedAccountAsset(raw: unknown): ResolvedAccountAsset | null {
  if (!isRecord(raw)) return null;
  const assetRef = normalizeAccountAssetRef(raw.assetRef);
  const url = asTrimmedString(raw.url) ?? '';
  if (!assetRef || !url) return null;
  return { assetRef, url };
}

export function parseAccountAssetRef(raw: unknown): AssetRef | null {
  const pathname = pathnameFromRawAssetRef(raw);
  if (!pathname) return null;

  const publicMatch = pathname.match(ACCOUNT_ASSET_PATH_RE);
  if (!publicMatch) return null;
  const accountId = decodePathPart(publicMatch[1]);
  const assetRef = normalizeAccountAssetRef(
    String(publicMatch[2] || '')
      .split('/')
      .map((segment) => decodePathPart(segment))
      .join('/'),
  );
  if (!isCompactAccountPublicId(accountId) || !assetRef) return null;
  const filename = filenameFromAssetRef(assetRef);

  return {
    accountId,
    assetRef,
    filename,
    key: `accounts/${accountId}/assets/${assetRef}`,
    kind: 'account',
    pathname: `/assets/account/${encodeURIComponent(accountId)}/${encodeAssetRefPath(assetRef)}`,
  };
}

export function parseAccountAssetKey(raw: unknown): AssetRef | null {
  const key = typeof raw === 'string' ? raw.trim().replace(/^\/+/, '') : '';
  if (!key || key.includes('..')) return null;
  const match = key.match(ACCOUNT_ASSET_KEY_RE);
  if (!match) return null;
  const accountId = decodePathPart(match[1]);
  const assetRef = normalizeAccountAssetRef(
    String(match[2] || '')
      .split('/')
      .map((segment) => decodePathPart(segment))
      .join('/'),
  );
  if (!isCompactAccountPublicId(accountId) || !assetRef) return null;
  const filename = filenameFromAssetRef(assetRef);
  return {
    accountId,
    assetRef,
    filename,
    key: `accounts/${accountId}/assets/${assetRef}`,
    kind: 'account',
    pathname: `/assets/account/${encodeURIComponent(accountId)}/${encodeAssetRefPath(assetRef)}`,
  };
}

export function isAccountAssetRef(raw: unknown): boolean {
  return parseAccountAssetRef(raw) != null;
}

export function isAccountAssetKey(raw: unknown): boolean {
  return parseAccountAssetKey(raw) != null;
}

export function toAccountAssetPublicPath(assetKey: unknown): string | null {
  const parsed = parseAccountAssetKey(assetKey);
  return parsed ? parsed.pathname : null;
}

export function parseAccountLocaleListStrict(value: unknown): string[] {
  if (!Array.isArray(value)) failAccountLocaleContract('locales_missing');
  return Array.from(
    new Set(
      value.map((entry: unknown, index: number) => {
        const normalized = normalizeSupportedLocaleToken(entry);
        if (!normalized) failAccountLocaleContract(`locales_invalid_${index}`);
        return normalized;
      }),
    ),
  );
}

export function parseAccountLocalePolicyStrict(raw: unknown): AccountLocalePolicy {
  if (!isRecord(raw) || raw.v !== 1) failAccountLocaleContract('policy_missing');
  const baseLocale = normalizeSupportedLocaleToken(raw.baseLocale);
  if (!baseLocale) failAccountLocaleContract('policy_base_locale_invalid');
  const ipRaw = isRecord(raw.ip) ? raw.ip : null;
  if (!ipRaw) failAccountLocaleContract('policy_ip_invalid');
  if (!isRecord(ipRaw.countryToLocale)) failAccountLocaleContract('policy_country_map_invalid');

  const countryToLocale: Record<string, string> = {};
  for (const [countryRaw, localeRaw] of Object.entries(ipRaw.countryToLocale)) {
    const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
    const locale = normalizeSupportedLocaleToken(localeRaw);
    if (!/^[A-Z]{2}$/.test(country) || !locale) {
      failAccountLocaleContract(`policy_country_locale_invalid_${countryRaw}`);
    }
    countryToLocale[country] = locale;
  }

  return {
    v: 1,
    baseLocale,
    ip: {
      countryToLocale,
    },
  };
}

export function validateAccountLocaleList(
  value: unknown,
  path = 'locales',
  options?: { allowNull?: boolean },
): AccountLocaleValidationIssue[] {
  const allowNull = options && options.allowNull === true;
  if (value == null) return allowNull ? [] : [{ path, message: 'locales must be an array' }];
  if (!Array.isArray(value)) {
    return [{ path, message: 'locales must be an array' }];
  }

  const issues: AccountLocaleValidationIssue[] = [];
  value.forEach((entry, index) => {
    if (!normalizeSupportedLocaleToken(entry)) {
      issues.push({ path: `${path}[${index}]`, message: 'locale must be a supported locale token' });
    }
  });
  return issues;
}

export function validateAccountLocalePolicy(raw: unknown, path = 'policy'): AccountLocaleValidationIssue[] {
  if (!isRecord(raw)) {
    return [{ path, message: 'policy must be an object' }];
  }
  if (raw.v !== 1) {
    return [{ path: `${path}.v`, message: 'policy.v must be 1' }];
  }

  const issues: AccountLocaleValidationIssue[] = [];
  if (!normalizeSupportedLocaleToken(raw.baseLocale)) {
    issues.push({ path: `${path}.baseLocale`, message: 'baseLocale must be a supported locale token' });
  }

  const ipRaw = isRecord(raw.ip) ? raw.ip : null;
  if (!ipRaw) {
    issues.push({ path: `${path}.ip`, message: 'ip must be an object' });
    return issues;
  }
  if (!isRecord(ipRaw.countryToLocale)) {
    issues.push({ path: `${path}.ip.countryToLocale`, message: 'countryToLocale must be an object' });
    return issues;
  }
  for (const [countryRaw, localeRaw] of Object.entries(ipRaw.countryToLocale)) {
    const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
    if (!/^[A-Z]{2}$/.test(country)) {
      issues.push({
        path: `${path}.ip.countryToLocale.${countryRaw}`,
        message: 'country key must be ISO-3166 alpha-2',
      });
      continue;
    }
    if (!normalizeSupportedLocaleToken(localeRaw)) {
      issues.push({
        path: `${path}.ip.countryToLocale.${country}`,
        message: 'locale must be a supported locale token',
      });
    }
  }

  return issues;
}

export function normalizeWidgetLocaleSwitcherSettings(raw: unknown): WidgetLocaleSwitcherSettings {
  const payload = isRecord(raw) ? raw : {};
  const attachTo = (asTrimmedString(payload.attachTo) ?? '').toLowerCase();
  const position = (asTrimmedString(payload.position) ?? '').toLowerCase();
  const alwaysShowLocale = normalizeSupportedLocaleToken(payload.alwaysShowLocale);

  return {
    enabled: payload.enabled === true,
    byIp: payload.byIp === true,
    alwaysShowLocale: alwaysShowLocale || null,
    attachTo: WIDGET_LOCALE_SWITCHER_ATTACH.has(attachTo) ? (attachTo as WidgetLocaleSwitcherSettings['attachTo']) : 'stage',
    position: WIDGET_LOCALE_SWITCHER_POSITION.has(position)
      ? (position as WidgetLocaleSwitcherSettings['position'])
      : 'top-right',
  };
}

function normalizeResolvedAssetSource(entry: unknown): ResolvedAccountAsset | null {
  if (!isRecord(entry)) return null;
  const directUrl = typeof entry.url === 'string' ? entry.url.trim() : '';
  const parsed = directUrl ? parseAccountAssetRef(directUrl) : null;
  if (!parsed) return null;
  return {
    assetRef: parsed.assetRef,
    url: directUrl,
  };
}

function readResolvedAssetByRef(resolvedAssets: unknown, assetRefRaw: unknown): ResolvedAccountAsset | null {
  const assetRef = normalizeAccountAssetRef(assetRefRaw);
  if (!assetRef) return null;
  if (resolvedAssets instanceof Map) {
    return normalizeResolvedAssetSource(resolvedAssets.get(assetRef));
  }
  if (isRecord(resolvedAssets)) {
    return normalizeResolvedAssetSource(resolvedAssets[assetRef]);
  }
  return null;
}

function collectMaterializedFillAssetRefs(node: unknown, out: Set<string>): void {
  if (!isRecord(node)) return;
  const type = typeof node.type === 'string' ? node.type.trim().toLowerCase() : '';

  if (type === 'image' && isRecord(node.image)) {
    const assetRef = normalizeAccountAssetRef(node.image.assetRef);
    if (assetRef) out.add(assetRef);
  }

  if (type === 'video' && isRecord(node.video)) {
    const assetRef = normalizeAccountAssetRef(node.video.assetRef);
    const posterAssetRef = normalizeAccountAssetRef(node.video.posterAssetRef);
    if (assetRef) out.add(assetRef);
    if (posterAssetRef) out.add(posterAssetRef);
  }
}

function collectMaterializedLogoAssetRefs(node: unknown, out: Set<string>): void {
  if (!isRecord(node)) return;
  if (!Object.prototype.hasOwnProperty.call(node, 'logoFill')) return;
  if (!isRecord(node.asset)) return;
  const assetRef = normalizeAccountAssetRef(node.asset.assetRef);
  if (assetRef) out.add(assetRef);
}

export function collectConfigMediaAssetRefs(config: unknown): string[] {
  const assetRefs = new Set<string>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    collectMaterializedFillAssetRefs(node, assetRefs);
    collectMaterializedLogoAssetRefs(node, assetRefs);
    for (const value of Object.values(node)) {
      visit(value);
    }
  };

  visit(config);
  return Array.from(assetRefs);
}

function materializeImageFill(fill: JsonRecord, resolvedAssets: unknown): JsonRecord {
  if (!isRecord(fill.image)) return fill;
  const nextImage = { ...fill.image };
  const resolvedByRef = readResolvedAssetByRef(resolvedAssets, nextImage.assetRef);
  if (resolvedByRef?.url) nextImage.src = resolvedByRef.url;
  return { ...fill, image: nextImage };
}

function materializeVideoFill(fill: JsonRecord, resolvedAssets: unknown): JsonRecord {
  if (!isRecord(fill.video)) return fill;
  const nextVideo = { ...fill.video };
  const resolvedByRef = readResolvedAssetByRef(resolvedAssets, nextVideo.assetRef);
  const resolvedPosterByRef = readResolvedAssetByRef(resolvedAssets, nextVideo.posterAssetRef);
  if (resolvedByRef?.url) nextVideo.src = resolvedByRef.url;
  if (resolvedPosterByRef?.url) nextVideo.poster = resolvedPosterByRef.url;
  return { ...fill, video: nextVideo };
}

function materializeLogoAssetNode(node: JsonRecord, resolvedAssets: unknown): JsonRecord {
  if (!isRecord(node.asset)) return node;
  const resolvedByRef = readResolvedAssetByRef(resolvedAssets, node.asset.assetRef);
  if (!resolvedByRef?.url) return node;
  const safeUrl = String(resolvedByRef.url).replace(/"/g, '%22');
  return {
    ...node,
    logoFill: `url("${safeUrl}") center / contain no-repeat`,
  };
}

export function materializeConfigMedia(config: unknown, resolvedAssets: unknown): unknown {
  const visit = (node: unknown): unknown => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(visit);
    const next: JsonRecord = {};
    for (const [key, value] of Object.entries(node)) {
      next[key] = visit(value);
    }

    const type = typeof next.type === 'string' ? next.type.trim().toLowerCase() : '';
    if (type === 'image') {
      return materializeImageFill(next, resolvedAssets);
    }
    if (type === 'video') {
      return materializeVideoFill(next, resolvedAssets);
    }
    if (Object.prototype.hasOwnProperty.call(next, 'logoFill')) {
      return materializeLogoAssetNode(next, resolvedAssets);
    }
    return next;
  };

  return visit(config);
}

function containsNonPersistableUrl(value: string): boolean {
  return /(?:^|[\s("'=,])(?:data|blob):/i.test(value);
}

export function configNonPersistableUrlIssues(config: unknown): AccountLocaleValidationIssue[] {
  const issues: AccountLocaleValidationIssue[] = [];

  const visit = (node: unknown, path: string): void => {
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

    for (const [key, value] of Object.entries(node)) {
      const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
      visit(value, nextPath);
    }
  };

  visit(config, 'config');
  return issues;
}

export * from './user-settings-geo';
export * from './observability';
export * from './reason-keys';
