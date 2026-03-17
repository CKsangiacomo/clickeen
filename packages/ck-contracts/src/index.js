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

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeResolvedAssetSource(entry) {
  if (!isRecord(entry)) return null;
  const directUrl = typeof entry.url === 'string' ? entry.url.trim() : '';
  if (directUrl) {
    const parsed = parseCanonicalAssetRef(directUrl);
    if (parsed && parsed.kind === 'version') {
      return {
        assetId: parsed.assetId,
        assetRef: parsed.versionKey,
        url: parsed.pathname,
      };
    }
  }

  const assetRef = typeof entry.assetRef === 'string' ? entry.assetRef.trim() : '';
  const canonicalPath = assetRef ? toCanonicalAssetVersionPath(assetRef) : null;
  const parsed = canonicalPath ? parseCanonicalAssetRef(canonicalPath) : null;
  if (!parsed || parsed.kind !== 'version') return null;
  return {
    assetId: parsed.assetId,
    assetRef: parsed.versionKey,
    url: directUrl || parsed.pathname,
  };
}

function readResolvedAssetById(resolvedAssets, assetIdRaw) {
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

function collectMaterializedFillAssetIds(node, out) {
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

function collectMaterializedLogoAssetIds(node, out) {
  if (!isRecord(node)) return;
  if (!Object.prototype.hasOwnProperty.call(node, 'logoFill')) return;
  if (!isRecord(node.asset)) return;
  const assetId = typeof node.asset.assetId === 'string' ? node.asset.assetId.trim() : '';
  if (isUuid(assetId)) out.add(assetId);
}

export function collectConfigMediaAssetIds(config) {
  const assetIds = new Set();

  const visit = (node) => {
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

function materializeImageFill(fill, resolvedAssets) {
  if (!isRecord(fill.image)) return fill;
  const nextImage = { ...fill.image };
  const resolvedById = readResolvedAssetById(resolvedAssets, nextImage.assetId);
  if (resolvedById?.url) nextImage.src = resolvedById.url;
  return { ...fill, image: nextImage };
}

function materializeVideoFill(fill, resolvedAssets) {
  if (!isRecord(fill.video)) return fill;
  const nextVideo = { ...fill.video };
  const resolvedById = readResolvedAssetById(resolvedAssets, nextVideo.assetId);
  const resolvedPosterById = readResolvedAssetById(resolvedAssets, nextVideo.posterAssetId);
  if (resolvedById?.url) nextVideo.src = resolvedById.url;
  if (resolvedPosterById?.url) nextVideo.poster = resolvedPosterById.url;
  return { ...fill, video: nextVideo };
}

function materializeLogoAssetNode(node, resolvedAssets) {
  if (!isRecord(node.asset)) return node;
  const resolvedById = readResolvedAssetById(resolvedAssets, node.asset.assetId);
  if (!resolvedById?.url) return node;
  const safeUrl = String(resolvedById.url).replace(/"/g, '%22');
  return {
    ...node,
    logoFill: `url("${safeUrl}") center / contain no-repeat`,
  };
}

export function materializeConfigMedia(config, resolvedAssets) {
  const visit = (node) => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(visit);
    const next = {};
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
        message: `Legacy asset URL path is not supported: ${candidate}. Use assetId in authoring config.`,
      });
      return;
    }

    if (pathname.startsWith('/assets/v/')) {
      if (isLogoFillFieldPath(path)) {
        issues.push({
          path,
          message: `Persisted logoFill asset URL is not supported at ${path}. Use assetId in authoring config.`,
        });
        return;
      }
      issues.push({
        path,
        message: `Persisted asset URL path is not supported at ${path}. Use assetId in authoring config.`,
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
          message: `Persisted media URL fields are not supported at ${path}. Use assetId in authoring config.`,
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
