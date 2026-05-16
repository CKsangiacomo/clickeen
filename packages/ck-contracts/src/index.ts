import { normalizeCanonicalLocalesFile, normalizeLocaleToken } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { isUuid } from './ids';
import { isCompactAccountPublicId } from './overlay-identity';
export { UUID_RE, isUuid } from './ids';
export * from './overlay-codebooks';
export * from './overlay-identity';
export * from './overlay-primitives';

export const INSTANCE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/;

export const ACCOUNT_ASSET_PATH_RE = /^\/assets\/account\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)$/;
export const ACCOUNT_ASSET_PATH_PATTERN = '^/assets/account/([^/?#]+)/([^/?#]+)/([^/?#]+)$';
const ACCOUNT_ASSET_KEY_RE = /^accounts\/([^/]+)\/assets\/([^/]+)\/blob\/([^/]+)$/i;

type JsonRecord = Record<string, any>;

export type AssetRefKind = 'account';
export type AssetRef = {
  accountId: string;
  assetId: string;
  kind: AssetRefKind;
  filename: string;
  key: string;
  pathname: string;
};

export type ResolvedAssetMaterialization = {
  assetId: string;
  url: string;
};

export type AccountAssetRecord = {
  assetId: string;
  assetType: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export type ResolvedAccountAsset = {
  assetId: string;
  url: string;
};

export type AccountAssetHostCommand = 'list-assets' | 'resolve-assets' | 'upload-asset';

export type RateLimitRecord = {
  count: number;
  resetAt: number;
};

export type AccountL10nPolicy = {
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

export type AccountL10nValidationIssue = {
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

function failAccountL10nContract(reason: string): never {
  throw new Error(`account_l10n_contract_invalid:${reason}`);
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
  const assetId = asTrimmedString(raw.assetId) ?? '';
  const assetType = asTrimmedString(raw.assetType) ?? '';
  const filename = asTrimmedString(raw.filename) ?? '';
  const contentType = asTrimmedString(raw.contentType) ?? '';
  const createdAt = asTrimmedString(raw.createdAt) ?? '';
  const sizeBytes = Number(raw.sizeBytes);
  if (!isUuid(assetId) || !filename) return null;
  return {
    assetId,
    assetType: assetType || 'other',
    filename,
    contentType: contentType || 'application/octet-stream',
    sizeBytes: Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0,
    createdAt: createdAt || new Date().toISOString(),
  };
}

export function normalizeResolvedAccountAsset(raw: unknown): ResolvedAccountAsset | null {
  if (!isRecord(raw)) return null;
  const assetId = asTrimmedString(raw.assetId) ?? '';
  const url = asTrimmedString(raw.url) ?? '';
  if (!isUuid(assetId) || !url) return null;
  return { assetId, url };
}

export function parseAccountAssetRef(raw: unknown): AssetRef | null {
  const pathname = pathnameFromRawAssetRef(raw);
  if (!pathname) return null;

  const publicMatch = pathname.match(ACCOUNT_ASSET_PATH_RE);
  if (!publicMatch) return null;
  const accountId = decodePathPart(publicMatch[1]);
  const assetId = decodePathPart(publicMatch[2]);
  const filename = decodePathPart(publicMatch[3]);
  if (!isCompactAccountPublicId(accountId) || !isUuid(assetId)) return null;
  if (!filename || filename === '.' || filename === '..' || filename.includes('/')) return null;

  return {
    accountId,
    assetId,
    filename,
    key: `accounts/${accountId}/assets/${assetId}/blob/${filename}`,
    kind: 'account',
    pathname,
  };
}

export function parseAccountAssetBlobKey(raw: unknown): AssetRef | null {
  const key = typeof raw === 'string' ? raw.trim().replace(/^\/+/, '') : '';
  if (!key || key.includes('..')) return null;
  const match = key.match(ACCOUNT_ASSET_KEY_RE);
  if (!match) return null;
  const accountId = decodePathPart(match[1]);
  const assetId = decodePathPart(match[2]);
  const filename = decodePathPart(match[3]);
  if (!isCompactAccountPublicId(accountId) || !isUuid(assetId)) return null;
  if (!filename || filename === '.' || filename === '..' || filename.includes('/')) return null;
  return {
    accountId,
    assetId,
    filename,
    key: `accounts/${accountId}/assets/${assetId}/blob/${filename}`,
    kind: 'account',
    pathname: `/assets/account/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}/${encodeURIComponent(filename)}`,
  };
}

export function isAccountAssetRef(raw: unknown): boolean {
  return parseAccountAssetRef(raw) != null;
}

export function isAccountAssetBlobKey(raw: unknown): boolean {
  return parseAccountAssetBlobKey(raw) != null;
}

export function toAccountAssetPublicPath(assetKey: unknown): string | null {
  const parsed = parseAccountAssetBlobKey(assetKey);
  return parsed ? parsed.pathname : null;
}

export function parseAccountLocaleListStrict(value: unknown): string[] {
  if (!Array.isArray(value)) failAccountL10nContract('locales_missing');
  return Array.from(
    new Set(
      value.map((entry: unknown, index: number) => {
        const normalized = normalizeSupportedLocaleToken(entry);
        if (!normalized) failAccountL10nContract(`locales_invalid_${index}`);
        return normalized;
      }),
    ),
  );
}

export function parseAccountL10nPolicyStrict(raw: unknown): AccountL10nPolicy {
  if (!isRecord(raw) || raw.v !== 1) failAccountL10nContract('policy_missing');
  const baseLocale = normalizeSupportedLocaleToken(raw.baseLocale);
  if (!baseLocale) failAccountL10nContract('policy_base_locale_invalid');
  const ipRaw = isRecord(raw.ip) ? raw.ip : null;
  if (!ipRaw) failAccountL10nContract('policy_ip_invalid');
  if (!isRecord(ipRaw.countryToLocale)) failAccountL10nContract('policy_country_map_invalid');

  const countryToLocale: Record<string, string> = {};
  for (const [countryRaw, localeRaw] of Object.entries(ipRaw.countryToLocale)) {
    const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
    const locale = normalizeSupportedLocaleToken(localeRaw);
    if (!/^[A-Z]{2}$/.test(country) || !locale) {
      failAccountL10nContract(`policy_country_locale_invalid_${countryRaw}`);
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
): AccountL10nValidationIssue[] {
  const allowNull = options && options.allowNull === true;
  if (value == null) return allowNull ? [] : [{ path, message: 'locales must be an array' }];
  if (!Array.isArray(value)) {
    return [{ path, message: 'locales must be an array' }];
  }

  const issues: AccountL10nValidationIssue[] = [];
  value.forEach((entry, index) => {
    if (!normalizeSupportedLocaleToken(entry)) {
      issues.push({ path: `${path}[${index}]`, message: 'locale must be a supported locale token' });
    }
  });
  return issues;
}

export function validateAccountL10nPolicy(raw: unknown, path = 'policy'): AccountL10nValidationIssue[] {
  if (!isRecord(raw)) {
    return [{ path, message: 'policy must be an object' }];
  }
  if (raw.v !== 1) {
    return [{ path: `${path}.v`, message: 'policy.v must be 1' }];
  }

  const issues: AccountL10nValidationIssue[] = [];
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
    assetId: parsed.assetId,
    url: directUrl,
  };
}

function readResolvedAssetById(resolvedAssets: unknown, assetIdRaw: unknown): ResolvedAccountAsset | null {
  const assetId = typeof assetIdRaw === 'string' ? assetIdRaw.trim() : '';
  if (!assetId || !isUuid(assetId)) return null;
  if (resolvedAssets instanceof Map) {
    return normalizeResolvedAssetSource(resolvedAssets.get(assetId));
  }
  if (isRecord(resolvedAssets)) {
    return normalizeResolvedAssetSource(resolvedAssets[assetId]);
  }
  return null;
}

function collectMaterializedFillAssetIds(node: unknown, out: Set<string>): void {
  if (!isRecord(node)) return;
  const type = typeof node.type === 'string' ? node.type.trim().toLowerCase() : '';

  if (type === 'image' && isRecord(node.image)) {
    const assetId = typeof node.image.assetId === 'string' ? node.image.assetId.trim() : '';
    if (isUuid(assetId)) out.add(assetId);
  }

  if (type === 'video' && isRecord(node.video)) {
    const assetId = typeof node.video.assetId === 'string' ? node.video.assetId.trim() : '';
    const posterAssetId =
      typeof node.video.posterAssetId === 'string' ? node.video.posterAssetId.trim() : '';
    if (isUuid(assetId)) out.add(assetId);
    if (isUuid(posterAssetId)) out.add(posterAssetId);
  }
}

function collectMaterializedLogoAssetIds(node: unknown, out: Set<string>): void {
  if (!isRecord(node)) return;
  if (!Object.prototype.hasOwnProperty.call(node, 'logoFill')) return;
  if (!isRecord(node.asset)) return;
  const assetId = typeof node.asset.assetId === 'string' ? node.asset.assetId.trim() : '';
  if (isUuid(assetId)) out.add(assetId);
}

export function collectConfigMediaAssetIds(config: unknown): string[] {
  const assetIds = new Set<string>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    collectMaterializedFillAssetIds(node, assetIds);
    collectMaterializedLogoAssetIds(node, assetIds);
    for (const value of Object.values(node)) {
      visit(value);
    }
  };

  visit(config);
  return Array.from(assetIds);
}

function materializeImageFill(fill: JsonRecord, resolvedAssets: unknown): JsonRecord {
  if (!isRecord(fill.image)) return fill;
  const nextImage = { ...fill.image };
  const resolvedById = readResolvedAssetById(resolvedAssets, nextImage.assetId);
  if (resolvedById?.url) nextImage.src = resolvedById.url;
  return { ...fill, image: nextImage };
}

function materializeVideoFill(fill: JsonRecord, resolvedAssets: unknown): JsonRecord {
  if (!isRecord(fill.video)) return fill;
  const nextVideo = { ...fill.video };
  const resolvedById = readResolvedAssetById(resolvedAssets, nextVideo.assetId);
  const resolvedPosterById = readResolvedAssetById(resolvedAssets, nextVideo.posterAssetId);
  if (resolvedById?.url) nextVideo.src = resolvedById.url;
  if (resolvedPosterById?.url) nextVideo.poster = resolvedPosterById.url;
  return { ...fill, video: nextVideo };
}

function materializeLogoAssetNode(node: JsonRecord, resolvedAssets: unknown): JsonRecord {
  if (!isRecord(node.asset)) return node;
  const resolvedById = readResolvedAssetById(resolvedAssets, node.asset.assetId);
  if (!resolvedById?.url) return node;
  const safeUrl = String(resolvedById.url).replace(/"/g, '%22');
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

export function configNonPersistableUrlIssues(config: unknown): AccountL10nValidationIssue[] {
  const issues: AccountL10nValidationIssue[] = [];

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
