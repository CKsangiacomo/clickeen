'use client';

import { resolveTokyoBaseUrl } from '../env/tokyo';

type PersistScope = 'workspace' | 'curated';
type PersistSource = 'bob.publish' | 'bob.export' | 'devstudio' | 'promotion' | 'api';

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function extractPrimaryUrl(raw: string): string | null {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (/^(?:data|blob):/i.test(v) || /^https?:\/\//i.test(v)) return v;
  if (/^\/(?:workspace-assets|curated-assets|assets\/accounts|arsenale\/o)\//i.test(v)) return v;
  const match = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (match && match[2]) return match[2];
  return null;
}

function replacePrimaryUrl(raw: string, nextUrl: string): string {
  const v = String(raw || '');
  const match = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (match && match[2]) return v.replace(match[2], nextUrl);
  return nextUrl;
}

function tryParseJsonValue(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^[{["]/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function isNonPersistableUrl(rawUrl: string): boolean {
  const v = String(rawUrl || '').trim();
  return /^(?:data|blob):/i.test(v);
}

function isLegacyTokyoAssetUrl(rawUrl: string): boolean {
  const v = String(rawUrl || '').trim();
  if (!v) return false;
  if (/^\/workspace-assets\//i.test(v) || /^\/curated-assets\//i.test(v)) return true;
  if (/^https?:\/\//i.test(v)) {
    try {
      const parsed = new URL(v);
      return /^\/workspace-assets\//i.test(parsed.pathname) || /^\/curated-assets\//i.test(parsed.pathname);
    } catch {
      return false;
    }
  }
  return false;
}

function canonicalizeAccountAssetUrl(rawUrl: string): string {
  const v = String(rawUrl || '').trim();
  if (!v) return v;
  if (/^\/assets\/accounts\//i.test(v)) return v.replace(/^\/assets\/accounts\//i, '/arsenale/o/');
  if (/^https?:\/\//i.test(v)) {
    try {
      const parsed = new URL(v);
      if (/^\/assets\/accounts\//i.test(parsed.pathname)) {
        parsed.pathname = parsed.pathname.replace(/^\/assets\/accounts\//i, '/arsenale/o/');
        return parsed.toString();
      }
      return v;
    } catch {
      return v;
    }
  }
  return v;
}

function resolveFetchUrl(rawUrl: string): string {
  const v = String(rawUrl || '').trim();
  if (!v) return v;
  if (/^(?:data|blob):/i.test(v) || /^https?:\/\//i.test(v)) return v;
  if (/^\//.test(v)) {
    const tokyoBase = resolveTokyoBaseUrl().replace(/\/+$/, '');
    return `${tokyoBase}${v}`;
  }
  return v;
}

function extFromMime(mime: string): string {
  const mt = String(mime || '').toLowerCase();
  if (mt === 'image/png') return 'png';
  if (mt === 'image/jpeg') return 'jpg';
  if (mt === 'image/webp') return 'webp';
  if (mt === 'image/gif') return 'gif';
  if (mt === 'image/svg+xml') return 'svg';
  if (mt === 'video/mp4') return 'mp4';
  if (mt === 'video/webm') return 'webm';
  if (mt === 'application/pdf') return 'pdf';
  return 'bin';
}

function filenameFromAssetUrl(rawUrl: string, mime: string): string {
  const resolvedExt = extFromMime(mime);
  const fallback = `upload.${resolvedExt}`;
  const v = String(rawUrl || '').trim();
  if (!v) return fallback;
  let candidate = '';
  if (/^https?:\/\//i.test(v)) {
    try {
      candidate = decodeURIComponent(new URL(v).pathname.split('/').filter(Boolean).pop() || '');
    } catch {
      candidate = '';
    }
  } else if (v.startsWith('/')) {
    candidate = decodeURIComponent(v.split('/').filter(Boolean).pop() || '');
  }
  const clean = candidate.split('?')[0].split('#')[0].trim();
  if (!clean || /[\\/]/.test(clean)) return fallback;
  const extFromName = clean.includes('.') ? clean.split('.').pop()?.toLowerCase() ?? '' : '';
  if (extFromName && /^[a-z0-9]{1,8}$/.test(extFromName)) return clean;
  const stem = clean.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
  if (!stem) return fallback;
  return `${stem}.${resolvedExt}`;
}

async function uploadTokyoAsset({
  accountId,
  workspaceId,
  publicId,
  widgetType,
  source = 'api',
  blob,
  filename,
  variant = 'original',
  uploadEndpoint,
}: {
  accountId: string;
  workspaceId?: string;
  publicId?: string;
  widgetType?: string;
  source?: PersistSource;
  blob: Blob;
  filename: string;
  variant?: string;
  uploadEndpoint: string;
}): Promise<string> {
  if (!accountId) throw new Error('[persistConfigAssetsToTokyo] Missing accountId for asset upload');

  const headers = new Headers();
  headers.set('content-type', blob.type || 'application/octet-stream');
  headers.set('x-filename', filename || 'upload.bin');
  headers.set('x-variant', variant);
  headers.set('x-account-id', accountId);
  headers.set('x-source', source);
  if (workspaceId) headers.set('x-workspace-id', workspaceId);
  if (publicId) headers.set('x-public-id', publicId);
  if (widgetType) headers.set('x-widget-type', widgetType);

  const endpoint = `${uploadEndpoint.replace(/\/$/, '')}?_t=${Date.now()}`;
  const res = await fetch(endpoint, { method: 'POST', headers, body: blob });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`[persistConfigAssetsToTokyo] Asset upload failed (HTTP ${res.status})${text ? `: ${text}` : ''}`);
  }
  const json = text ? (JSON.parse(text) as any) : null;
  const keyCandidate =
    typeof json?.key === 'string'
      ? json.key.trim()
      : typeof json?.relativePath === 'string'
        ? json.relativePath.trim()
        : '';
  const url =
    typeof json?.url === 'string' && json.url.trim()
      ? json.url.trim()
      : keyCandidate
        ? /^https?:\/\//i.test(keyCandidate)
          ? keyCandidate
          : keyCandidate.startsWith('/')
            ? keyCandidate
            : `/${keyCandidate}`
        : null;
  if (!url || typeof url !== 'string') throw new Error('[persistConfigAssetsToTokyo] Asset upload missing url');
  return url;
}

export async function persistConfigAssetsToTokyo(
  config: Record<string, unknown>,
  {
    accountId,
    scope = 'workspace',
    workspaceId,
    publicId,
    widgetType,
    source = 'api',
    uploadEndpoint = '/api/assets/upload',
  }: {
    accountId: string;
    scope?: PersistScope;
    workspaceId?: string;
    publicId?: string;
    widgetType?: string;
    source?: PersistSource;
    uploadEndpoint?: string;
  }
): Promise<Record<string, unknown>> {
  void scope;
  const resolvedSource: PersistSource = source;
  const next = cloneJson(config);
  const cache = new Map<string, string>();

  const visit = async (node: unknown): Promise<string | void> => {
    if (typeof node === 'string') {
      const parsed = tryParseJsonValue(node);
      if (parsed != null) {
        if (typeof parsed === 'string') {
          const replaced = await visit(parsed);
          if (typeof replaced === 'string') {
            return JSON.stringify(replaced);
          }
          return;
        }
        if (parsed && typeof parsed === 'object') {
          await visit(parsed);
          const nextJson = JSON.stringify(parsed);
          if (nextJson !== node) return nextJson;
          return;
        }
      }
      const url = extractPrimaryUrl(node);
      if (!url) return;
      const canonicalizedUrl = canonicalizeAccountAssetUrl(url);
      if (canonicalizedUrl && canonicalizedUrl !== url) {
        return replacePrimaryUrl(node, canonicalizedUrl);
      }
      const requiresUpload = isNonPersistableUrl(url) || isLegacyTokyoAssetUrl(url);
      if (!requiresUpload) return;

      if (!cache.has(url)) {
        const fetchUrl = resolveFetchUrl(url);
        const sourceRes = await fetch(fetchUrl);
        if (!sourceRes.ok) {
          throw new Error(
            `[persistConfigAssetsToTokyo] Failed to fetch source asset (HTTP ${sourceRes.status})`
          );
        }
        const blob = await sourceRes.blob();
        const filename = filenameFromAssetUrl(url, blob.type);
        const uploadedUrl = await uploadTokyoAsset({
          accountId,
          workspaceId,
          publicId,
          widgetType,
          source: resolvedSource,
          blob,
          filename,
          variant: 'original',
          uploadEndpoint,
        });
        cache.set(url, uploadedUrl);
      }

      const uploaded = cache.get(url);
      if (!uploaded) return;
      return replacePrimaryUrl(node, uploaded);
    }

    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        const replaced = await visit(node[i]);
        if (typeof replaced === 'string') node[i] = replaced;
      }
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const replaced = await visit(value);
      if (typeof replaced === 'string') (node as Record<string, unknown>)[key] = replaced;
    }
  };

  await visit(next);
  return next;
}
