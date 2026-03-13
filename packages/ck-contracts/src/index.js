export const WIDGET_PUBLIC_ID_MAIN_RE = /^wgt_main_[a-z0-9][a-z0-9_-]*$/i;
export const WIDGET_PUBLIC_ID_CURATED_RE = /^wgt_curated_[a-z0-9][a-z0-9_-]*$/i;
export const WIDGET_PUBLIC_ID_USER_RE = /^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$/i;
export const WIDGET_PUBLIC_ID_RE =
  /^(?:wgt_main_[a-z0-9][a-z0-9_-]*|wgt_curated_[a-z0-9][a-z0-9_-]*|wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*)$/i;

export const WIDGET_PUBLIC_ID_CURATED_OR_MAIN_PATTERN = '^wgt_(curated|main)_[a-z0-9][a-z0-9_-]*$';
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ASSET_VERSION_PATH_RE = /^\/assets\/v\/([^/?#]+)$/;
export const ASSET_VERSION_PATH_PATTERN = '^/assets/v/([^/?#]+)$';
const ASSET_VERSION_KEY_RE = /^assets\/versions\/([^/]+)\/([^/]+)\/[^/]+$/;

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

function decodeAssetVersionToken(raw) {
  const token = decodePathPart(raw);
  if (!token) return null;
  try {
    const key = decodeURIComponent(token).trim();
    if (!key || key.startsWith('/') || key.includes('..')) return null;
    return key;
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

  const version = pathname.match(ASSET_VERSION_PATH_RE);
  if (!version) return null;

  const versionToken = decodePathPart(version[1]);
  const versionKey = decodeAssetVersionToken(versionToken);
  if (!versionKey) return null;

  const keyMatch = versionKey.match(ASSET_VERSION_KEY_RE);
  if (!keyMatch) return null;
  const accountId = decodePathPart(keyMatch[1]);
  const assetId = decodePathPart(keyMatch[2]);
  if (!isUuid(accountId) || !isUuid(assetId)) return null;

  return {
    accountId,
    assetId,
    kind: 'version',
    pathname,
    versionToken,
    versionKey,
  };
}

export function isCanonicalAssetVersionRef(raw) {
  const parsed = parseCanonicalAssetRef(raw);
  return parsed ? parsed.kind === 'version' : false;
}

export function isCanonicalAssetRef(raw) {
  return parseCanonicalAssetRef(raw) != null;
}

export function toCanonicalAssetVersionPath(versionKey) {
  const key = typeof versionKey === 'string' ? versionKey.trim() : '';
  if (!key || key.startsWith('/') || key.includes('..') || !ASSET_VERSION_KEY_RE.test(key)) return null;
  return `/assets/v/${encodeURIComponent(key)}`;
}

function containsNonPersistableUrl(value) {
  return /(?:^|[\s("'=,])(?:data|blob):/i.test(value);
}

function extractPathnameFromUrlCandidate(raw) {
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

function isStaticTokyoAssetPath(pathname) {
  return pathname.startsWith('/widgets/') || pathname.startsWith('/themes/') || pathname.startsWith('/dieter/');
}

function isLikelyAssetFieldPath(path) {
  return /(?:^|[\].])(?:src|poster|logoFill)$/.test(String(path || ''));
}

function isLogoFillFieldPath(path) {
  return /(?:^|[\].])logoFill$/.test(String(path || ''));
}

function isAssetRefFieldPath(path) {
  return /(?:^|[\].])(?:asset|poster)\.ref$/.test(String(path || ''));
}

function isMediaAssetRefFieldPath(path) {
  return /(?:^|[\].])(?:image|video)\.(?:asset|poster)$/.test(String(path || ''));
}

function isPersistedMediaUrlFieldPath(path) {
  const value = String(path || '');
  return (
    /(?:^|[\].])(?:fill\.)?image\.src$/.test(value) ||
    /(?:^|[\].])(?:fill\.)?video\.src$/.test(value) ||
    /(?:^|[\].])(?:fill\.)?video\.posterSrc$/.test(value) ||
    /(?:^|[\].])(?:fill\.)?video\.poster$/.test(value)
  );
}

export function configAssetUrlContractIssues(config, expectedAccountId) {
  const issues = [];
  const expectedAccount = typeof expectedAccountId === 'string' ? expectedAccountId.trim() : '';
  const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

  const inspectCandidate = (candidateRaw, path) => {
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
        message: `Legacy asset URL path is not supported: ${candidate}. Use asset.ref only.`,
      });
      return;
    }

    if (pathname.startsWith('/assets/v/')) {
      if (isLogoFillFieldPath(path)) {
        issues.push({
          path,
          message: `Persisted logoFill asset URL is not supported at ${path}. Use asset.ref only.`,
        });
        return;
      }
      issues.push({
        path,
        message: `Persisted asset URL path is not supported at ${path}. Use asset.ref only.`,
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

  const inspectAssetRefCandidate = (candidateRaw, path) => {
    const candidate = String(candidateRaw || '').trim();
    if (!candidate) {
      issues.push({
        path,
        message: 'Asset ref is required',
      });
      return;
    }

    const canonicalPath = toCanonicalAssetVersionPath(candidate);
    if (!canonicalPath) {
      issues.push({
        path,
        message: `Asset ref must be a canonical immutable key: ${candidate}`,
      });
      return;
    }

    const parsed = parseCanonicalAssetRef(canonicalPath);
    if (!parsed || !isUuid(parsed.accountId) || !isUuid(parsed.assetId)) {
      issues.push({
        path,
        message: `Asset ref is invalid: ${candidate}`,
      });
      return;
    }

    if (expectedAccount && parsed.accountId !== expectedAccount) {
      issues.push({
        path,
        message: `Asset ref account mismatch at ${path}: expected ${expectedAccount}, got ${parsed.accountId}`,
      });
    }
  };

  const visit = (node, path) => {
    if (typeof node === 'string') {
      if (isPersistedMediaUrlFieldPath(path)) {
        issues.push({
          path,
          message: `Persisted media URL fields are not supported at ${path}. Use asset.ref only.`,
        });
        return;
      }

      if (isAssetRefFieldPath(path)) {
        inspectAssetRefCandidate(node, path);
        return;
      }

      if (isMediaAssetRefFieldPath(path)) {
        issues.push({
          path,
          message: `Asset ref at ${path} must be an object with ref.`,
        });
        return;
      }

      let matchedCssUrl = false;
      let match = urlPattern.exec(node);
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

    for (const [key, value] of Object.entries(node)) {
      const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
      visit(value, nextPath);
    }
  };

  visit(config, 'config');
  return issues;
}

export function configNonPersistableUrlIssues(config) {
  const issues = [];

  const visit = (node, path) => {
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

export * from './user-settings-geo.js';
