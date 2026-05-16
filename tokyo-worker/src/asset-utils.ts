import {
  normalizeInstanceId,
  parseAccountAssetBlobKey,
  parseAccountAssetRef,
  toAccountAssetPublicPath,
} from '@clickeen/ck-contracts';
import { sha256Hex as computeSha256Hex } from '@clickeen/ck-contracts/security';
import { normalizeLocaleToken } from '@clickeen/l10n';
import type { Env } from './types';

function extFromMime(mime: string): string | null {
  const mt = String(mime || '').toLowerCase();
  if (mt === 'image/png') return 'png';
  if (mt === 'image/jpeg') return 'jpg';
  if (mt === 'image/webp') return 'webp';
  if (mt === 'image/gif') return 'gif';
  if (mt === 'image/svg+xml') return 'svg';
  if (mt === 'video/mp4') return 'mp4';
  if (mt === 'video/webm') return 'webm';
  if (mt === 'application/pdf') return 'pdf';
  return null;
}

function normalizeMimeType(raw: string): string {
  return String(raw || '').split(';')[0].trim().toLowerCase();
}

export type AccountAssetType = 'image' | 'vector' | 'video' | 'audio' | 'document' | 'other';

export function classifyAccountAssetType(contentType: string | null, ext: string | null): AccountAssetType {
  const mime = normalizeMimeType(String(contentType || '').trim());
  const normalizedExt = String(ext || '').trim().toLowerCase();

  if (mime === 'image/svg+xml' || normalizedExt === 'svg') return 'vector';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'document';
  return 'other';
}

export function pickExtension(filename: string | null, contentType: string | null): string {
  const rawName = String(filename || '').trim();
  const fromName = rawName ? rawName.split('.').pop()?.toLowerCase() : '';
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  const fromMime = extFromMime(String(contentType || '').trim());
  if (fromMime) return fromMime;
  return 'bin';
}

export function validateUploadFilename(
  filename: string | null,
): { ok: true; filename: string } | { ok: false; detail: string } {
  const raw = String(filename || '').trim();
  if (!raw) return { ok: false, detail: 'filename required' };
  if (raw === '.' || raw === '..') return { ok: false, detail: 'filename reserved' };
  if (raw.includes('/') || raw.includes('\\')) return { ok: false, detail: 'path separators are not allowed' };

  const ascii = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const safe = ascii
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/^[._-]+|[._-]+$/g, '');
  if (!safe || safe === '.' || safe === '..') return { ok: true, filename: 'asset.bin' };

  const extMatch = safe.match(/(\.[A-Za-z0-9]{1,8})$/);
  const ext = extMatch ? extMatch[1] : '';
  const candidateStem = (ext ? safe.slice(0, -ext.length) : safe).replace(/[._-]+$/g, '') || 'asset';
  const candidate = `${candidateStem}${ext}`;
  if (candidate.length <= 180) return { ok: true, filename: candidate };

  const maxStemLength = Math.max(1, 180 - ext.length);
  return { ok: true, filename: `${candidateStem.slice(0, maxStemLength)}${ext}` };
}

const ACCOUNT_ASSET_CANONICAL_PREFIX = 'accounts/';

export function buildAccountAssetKey(
  accountId: string,
  assetId: string,
  filename: string,
): string {
  return `${ACCOUNT_ASSET_CANONICAL_PREFIX}${accountId}/assets/${assetId}/blob/${filename}`;
}

export function normalizeAccountAssetReadKey(pathname: string): string | null {
  const raw = String(pathname || '').trim();
  if (!raw) return null;
  const publicRef = parseAccountAssetRef(raw);
  if (publicRef) return publicRef.key;
  const keyRef = parseAccountAssetBlobKey(raw.replace(/^\/+/, ''));
  return keyRef ? keyRef.key : null;
}

type AccountAssetIdentity = { accountId: string; assetId: string };

export function buildAccountAssetPublicPath(assetKey: string): string {
  const publicPath = toAccountAssetPublicPath(assetKey);
  if (!publicPath) throw new Error('[tokyo] invalid account asset key');
  return publicPath;
}

export function parseAccountAssetIdentityFromKey(key: string): AccountAssetIdentity | null {
  const normalized = normalizeAccountAssetReadKey(key);
  if (!normalized) return null;
  const parsed = parseAccountAssetBlobKey(normalized);
  return parsed ? { accountId: parsed.accountId, assetId: parsed.assetId } : null;
}

export function guessContentTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'css':
      return 'text/css; charset=utf-8';
    case 'js':
      return 'text/javascript; charset=utf-8';
    case 'html':
      return 'text/html; charset=utf-8';
    case 'json':
      return 'application/json; charset=utf-8';
    case 'svg':
      return 'image/svg+xml; charset=utf-8';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'pdf':
      return 'application/pdf';
    case 'woff2':
      return 'font/woff2';
    case 'woff':
      return 'font/woff';
    case 'otf':
      return 'font/otf';
    case 'ttf':
      return 'font/ttf';
    default:
      return 'application/octet-stream';
  }
}

function normalizeTokyoFontKey(pathname: string): string | null {
  const normalized = String(pathname || '').replace(/^\/+/, '');
  if (!normalized.startsWith('fonts/')) return null;
  const segments = normalized.split('/');
  if (segments.length < 2) return null;
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return normalized;
}

const TOKYO_DEPLOY_ASSET_ROUTES: ReadonlyArray<{ prefix: string; keyPrefix: string }> = [
  { prefix: '/widgets/', keyPrefix: 'product/widgets/' },
  { prefix: '/dieter/', keyPrefix: 'dieter/' },
  { prefix: '/themes/', keyPrefix: 'product/themes/' },
  { prefix: '/prague/l10n/', keyPrefix: 'prague/l10n/' },
  { prefix: '/prague/assets/', keyPrefix: 'prague/assets/' },
];

function normalizeDeployAssetRelativePath(raw: string): string | null {
  let decoded = '';
  try {
    decoded = decodeURIComponent(String(raw || '').trim());
  } catch {
    return null;
  }
  if (!decoded) return null;
  const segments = decoded.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return segments.join('/');
}

function normalizeTokyoDeployAssetKey(pathname: string): string | null {
  const normalizedPathname = String(pathname || '').trim();
  for (const route of TOKYO_DEPLOY_ASSET_ROUTES) {
    if (!normalizedPathname.startsWith(route.prefix)) continue;
    const relativePath = normalizeDeployAssetRelativePath(normalizedPathname.slice(route.prefix.length));
    if (!relativePath) return null;
    return `${route.keyPrefix}${relativePath}`;
  }
  return null;
}

function cacheControlForDeployAssetKey(key: string): string {
  if (key.startsWith('prague/l10n/')) {
    if (key.endsWith('/index.json')) return 'public, max-age=300, stale-while-revalidate=600';
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=0, must-revalidate';
}

export async function handleGetTokyoDeployAsset(env: Env, pathname: string): Promise<Response | null> {
  const key = normalizeTokyoDeployAssetKey(pathname);
  if (!key) return null;
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const cacheControl = cacheControlForDeployAssetKey(key);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', cacheControl);
  headers.set('cdn-cache-control', cacheControl);
  headers.set('cloudflare-cdn-cache-control', cacheControl);
  return new Response(obj.body, { status: 200, headers });
}

export async function handleGetTokyoFontAsset(env: Env, pathname: string): Promise<Response> {
  const key = normalizeTokyoFontKey(pathname);
  if (!key) return new Response('Not found', { status: 404 });
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
  headers.set('cdn-cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
  headers.set('cloudflare-cdn-cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
  return new Response(obj.body, { status: 200, headers });
}

export const normalizeStorageId = normalizeInstanceId;

export function normalizeWidgetType(raw: string): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) return null;
  return value;
}

export function normalizeLocale(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = normalizeLocaleToken(raw);
  if (!value) return null;
  return value;
}

export function normalizeSha256Hex(raw: unknown): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  return value;
}

function stableStringify(value: any): string {
  if (value === undefined) return 'null';
  if (typeof value === 'function' || typeof value === 'symbol') return 'null';
  if (Array.isArray(value)) {
    return `[${value
      .map((item) =>
        item === undefined || typeof item === 'function' || typeof item === 'symbol'
          ? 'null'
          : stableStringify(item),
      )
      .join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const parts: string[] = [];
    for (const key of Object.keys(value).sort()) {
      const next = value[key];
      if (next === undefined) continue;
      if (typeof next === 'function' || typeof next === 'symbol') continue;
      parts.push(`${JSON.stringify(key)}:${stableStringify(next)}`);
    }
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function prettyStableJson(value: any): string {
  const normalized = stableStringify(value);
  const parsed = JSON.parse(normalized);
  return JSON.stringify(parsed, null, 2);
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  return computeSha256Hex(bytes);
}
