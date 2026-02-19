export const WIDGET_PUBLIC_ID_MAIN_RE = /^wgt_main_[a-z0-9][a-z0-9_-]*$/i;
export const WIDGET_PUBLIC_ID_CURATED_RE = /^wgt_curated_[a-z0-9][a-z0-9_-]*$/i;
export const WIDGET_PUBLIC_ID_USER_RE = /^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$/i;
export const WIDGET_PUBLIC_ID_RE = /^(?:wgt_main_[a-z0-9][a-z0-9_-]*|wgt_curated_[a-z0-9][a-z0-9_-]*|wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*)$/i;

export const WIDGET_PUBLIC_ID_CURATED_OR_MAIN_PATTERN = '^wgt_(curated|main)_[a-z0-9][a-z0-9_-]*$';
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ASSET_POINTER_PATH_RE = /^\/arsenale\/a\/([^/]+)\/([^/]+)$/;
export const ASSET_OBJECT_PATH_RE = /^\/arsenale\/o\/([^/]+)\/([^/]+)\/(?:[^/]+\/)?[^/]+$/;

export const ASSET_POINTER_PATH_PATTERN = '^/arsenale/a/([^/]+)/([^/]+)$';
export const ASSET_OBJECT_PATH_PATTERN = '^/arsenale/o/([^/]+)/([^/]+)/(?:[^/]+/)?[^/]+$';

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

export function normalizeWidgetPublicId(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  return WIDGET_PUBLIC_ID_RE.test(value) ? value : null;
}

export function classifyWidgetPublicId(raw) {
  const value = normalizeWidgetPublicId(raw);
  if (!value) return null;
  if (WIDGET_PUBLIC_ID_MAIN_RE.test(value)) return 'main';
  if (WIDGET_PUBLIC_ID_CURATED_RE.test(value)) return 'curated';
  if (WIDGET_PUBLIC_ID_USER_RE.test(value)) return 'user';
  return null;
}

export function isWidgetPublicId(raw) {
  return normalizeWidgetPublicId(raw) != null;
}

export function isMainWidgetPublicId(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value ? WIDGET_PUBLIC_ID_MAIN_RE.test(value) : false;
}

export function isCuratedWidgetPublicId(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value ? WIDGET_PUBLIC_ID_CURATED_RE.test(value) : false;
}

export function isCuratedOrMainWidgetPublicId(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return false;
  return WIDGET_PUBLIC_ID_MAIN_RE.test(value) || WIDGET_PUBLIC_ID_CURATED_RE.test(value);
}

export function isUserWidgetPublicId(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value ? WIDGET_PUBLIC_ID_USER_RE.test(value) : false;
}

function decodePathPart(raw) {
  try {
    return decodeURIComponent(String(raw || '')).trim();
  } catch {
    return '';
  }
}

function pathnameFromRawAssetRef(raw) {
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

export function isUuid(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return Boolean(value && UUID_RE.test(value));
}

export function parseCanonicalAssetRef(raw) {
  const pathname = pathnameFromRawAssetRef(raw);
  if (!pathname) return null;

  const pointer = pathname.match(ASSET_POINTER_PATH_RE);
  if (pointer) {
    const accountId = decodePathPart(pointer[1]);
    const assetId = decodePathPart(pointer[2]);
    if (!isUuid(accountId) || !isUuid(assetId)) return null;
    return { accountId, assetId, kind: 'pointer', pathname };
  }

  const object = pathname.match(ASSET_OBJECT_PATH_RE);
  if (!object) return null;
  const accountId = decodePathPart(object[1]);
  const assetId = decodePathPart(object[2]);
  if (!isUuid(accountId) || !isUuid(assetId)) return null;
  return { accountId, assetId, kind: 'object', pathname };
}

export function isCanonicalAssetPointerRef(raw) {
  const parsed = parseCanonicalAssetRef(raw);
  return parsed ? parsed.kind === 'pointer' : false;
}

export function isCanonicalAssetObjectRef(raw) {
  const parsed = parseCanonicalAssetRef(raw);
  return parsed ? parsed.kind === 'object' : false;
}

export function isCanonicalAssetRef(raw) {
  return parseCanonicalAssetRef(raw) != null;
}

export function toCanonicalAssetPointerPath(accountId, assetId) {
  const account = typeof accountId === 'string' ? accountId.trim() : '';
  const asset = typeof assetId === 'string' ? assetId.trim() : '';
  if (!isUuid(account) || !isUuid(asset)) return null;
  return `/arsenale/a/${encodeURIComponent(account)}/${encodeURIComponent(asset)}`;
}
