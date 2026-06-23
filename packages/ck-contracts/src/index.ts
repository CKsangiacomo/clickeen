import { normalizeCanonicalLocalesFile, normalizeLocaleToken } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { isCompactAccountPublicId } from './overlay-identity';
export { UUID_RE, isUuid } from './ids';
export * from './overlay-codebooks';
export * from './overlay-identity';
export * from './translated-value-primitives';

export const INSTANCE_ID_RE = /^[0-9A-Z]{10}$/;

export const ACCOUNT_ASSET_PATH_RE = /^\/assets\/account\/([^/?#]+)\/(.+)$/;
export const ACCOUNT_ASSET_PATH_PATTERN = '^/assets/account/([^/?#]+)/(.+)$';
const ACCOUNT_ASSET_KEY_RE = /^accounts\/([^/]+)\/assets\/(.+)$/i;

type JsonRecord = Record<string, any>;

export type AssetRefKind = 'account';
export type AssetRef = {
  accountId: string;
  assetRef: string;
  kind: AssetRefKind;
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
  baseLocale: string;
  ip: {
    countryToLocale: Record<string, string>;
  };
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
  if (typeof expClaim !== 'number' || !Number.isFinite(expClaim)) throw new Error('ck.jwt.expInvalid');
  const now = Math.floor(Date.now() / 1000);
  return expClaim <= now + leewaySeconds;
}

export function normalizeInstanceId(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  return INSTANCE_ID_RE.test(value) ? value : null;
}

export function isInstanceId(raw: unknown): raw is string {
  return normalizeInstanceId(raw) != null;
}

function isExactAccountAssetRef(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !raw || raw.length > 240) return false;
  if (raw.trim() !== raw || raw.startsWith('/') || raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return false;
  const segments = raw.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return false;
  return !segments.some((segment) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(segment));
}

export function encodeAssetRefPath(assetRef: string): string {
  return assetRef.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

export function parseRateLimitRecord(value: unknown): RateLimitRecord | null {
  if (value == null) return null;
  if (!isRecord(value) || !Number.isInteger(value.count) || value.count < 0 || !Number.isInteger(value.resetAt) || value.resetAt < 0) throw new Error('ck.rateLimit.recordInvalid');
  return { count: value.count, resetAt: value.resetAt };
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

export function parseAccountAssetRef(raw: unknown): AssetRef | null {
  const pathname = typeof raw === 'string' ? raw : '';
  if (!pathname) return null;

  const publicMatch = pathname.match(ACCOUNT_ASSET_PATH_RE);
  if (!publicMatch) return null;
  const accountId = publicMatch[1] || '';
  const assetRef = publicMatch[2] || '';
  if (!isCompactAccountPublicId(accountId) || !assetRef) return null;
  if (!isExactAccountAssetRef(assetRef)) return null;

  return {
    accountId,
    assetRef,
    key: `accounts/${accountId}/assets/${assetRef}`,
    kind: 'account',
    pathname: `/assets/account/${encodeURIComponent(accountId)}/${encodeAssetRefPath(assetRef)}`,
  };
}

export function parseAccountAssetKey(raw: unknown): AssetRef | null {
  const key = typeof raw === 'string' ? raw : '';
  if (!key || key.includes('..')) return null;
  const match = key.match(ACCOUNT_ASSET_KEY_RE);
  if (!match) return null;
  const accountId = match[1] || '';
  const assetRef = match[2] || '';
  if (!isCompactAccountPublicId(accountId) || !assetRef) return null;
  if (!isExactAccountAssetRef(assetRef)) return null;
  return {
    accountId,
    assetRef,
    key: `accounts/${accountId}/assets/${assetRef}`,
    kind: 'account',
    pathname: `/assets/account/${encodeURIComponent(accountId)}/${encodeAssetRefPath(assetRef)}`,
  };
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
  if (!isRecord(raw)) failAccountLocaleContract('policy_missing');
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

export function validateWidgetSocialShareSettings(raw: unknown) { const v = isRecord(raw) ? raw : null, issue = !v ? ['settingsInvalid', 'behavior.socialShare'] : typeof v.enabled !== 'boolean' ? ['enabledInvalid', 'behavior.socialShare.enabled'] : v.attachTo !== 'stage' && v.attachTo !== 'pod' ? ['attachToInvalid', 'behavior.socialShare.attachTo'] : typeof v.position !== 'string' || !['top-left', 'top-center', 'top-right', 'right-middle', 'bottom-right', 'bottom-center', 'bottom-left', 'left-middle'].includes(v.position) ? ['positionInvalid', 'behavior.socialShare.position'] : null; return issue ? { reasonKey: `coreui.errors.socialShare.${issue[0]}`, detail: `coreui.errors.socialShare.${issue[0]}`, path: issue[1] } : null; }

function readResolvedAssetByRef(resolvedAssets: unknown, assetRefRaw: unknown): ResolvedAccountAsset {
  if (typeof assetRefRaw !== 'string') throw new Error('ck.account_asset_ref_invalid');
  const entry = resolvedAssets instanceof Map
    ? resolvedAssets.get(assetRefRaw)
    : isRecord(resolvedAssets)
      ? resolvedAssets[assetRefRaw]
      : null;
  if (!isRecord(entry) || entry.assetRef !== assetRefRaw || typeof entry.url !== 'string' || !entry.url) {
    throw new Error('ck.account_asset_resolved_invalid');
  }
  return entry as ResolvedAccountAsset;
}

function collectMaterializedFillAssetRefs(node: unknown, out: Set<string>): void {
  if (!isRecord(node)) return;
  const type = typeof node.type === 'string' ? node.type : '';
  const isDeclaredString = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0 && value === value.trim();

  if (type === 'image') {
    if (!isRecord(node.image)) throw new Error('ck.account_asset_ref_invalid');
    if (isDeclaredString(node.image.assetRef)) {
      out.add(node.image.assetRef);
    } else if (!isDeclaredString(node.image.src)) {
      throw new Error('ck.account_asset_ref_invalid');
    }
  }

  if (type === 'video') {
    if (!isRecord(node.video)) throw new Error('ck.account_asset_ref_invalid');
    if (isDeclaredString(node.video.assetRef)) {
      out.add(node.video.assetRef);
    } else if (!isDeclaredString(node.video.src)) {
      throw new Error('ck.account_asset_ref_invalid');
    }
    if (Object.prototype.hasOwnProperty.call(node.video, 'posterAssetRef')) {
      if (!isDeclaredString(node.video.posterAssetRef)) throw new Error('ck.account_asset_ref_invalid');
      out.add(node.video.posterAssetRef);
    }
  }
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
    for (const value of Object.values(node)) {
      visit(value);
    }
  };

  visit(config);
  return Array.from(assetRefs);
}

function materializeImageFill(fill: JsonRecord, resolvedAssets: unknown): JsonRecord {
  if (!isRecord(fill.image)) throw new Error('ck.account_asset_ref_invalid');
  const nextImage = { ...fill.image };
  if (typeof nextImage.assetRef !== 'string' && typeof nextImage.src === 'string' && nextImage.src && nextImage.src === nextImage.src.trim()) return fill;
  const resolvedByRef = readResolvedAssetByRef(resolvedAssets, nextImage.assetRef);
  nextImage.src = resolvedByRef.url;
  return { ...fill, image: nextImage };
}

function materializeVideoFill(fill: JsonRecord, resolvedAssets: unknown): JsonRecord {
  if (!isRecord(fill.video)) throw new Error('ck.account_asset_ref_invalid');
  const nextVideo = { ...fill.video };
  if (typeof nextVideo.assetRef !== 'string' && typeof nextVideo.src === 'string' && nextVideo.src && nextVideo.src === nextVideo.src.trim()) return fill;
  const resolvedByRef = readResolvedAssetByRef(resolvedAssets, nextVideo.assetRef);
  nextVideo.src = resolvedByRef.url;
  if (Object.prototype.hasOwnProperty.call(nextVideo, 'posterAssetRef')) {
    nextVideo.poster = readResolvedAssetByRef(resolvedAssets, nextVideo.posterAssetRef).url;
  }
  return { ...fill, video: nextVideo };
}

export function materializeConfigMedia(config: unknown, resolvedAssets: unknown): unknown {
  const visit = (node: unknown): unknown => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(visit);
    const next: JsonRecord = {};
    for (const [key, value] of Object.entries(node)) {
      next[key] = visit(value);
    }

    const type = typeof next.type === 'string' ? next.type : '';
    if (type === 'image') {
      return materializeImageFill(next, resolvedAssets);
    }
    if (type === 'video') {
      return materializeVideoFill(next, resolvedAssets);
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
