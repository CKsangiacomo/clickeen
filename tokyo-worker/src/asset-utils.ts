import {
  normalizeWidgetPublicId,
  toCanonicalAssetVersionPath,
} from '@clickeen/ck-contracts';
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
  if (raw.length > 180) return { ok: false, detail: 'filename too long (max 180 chars)' };
  if (raw === '.' || raw === '..') return { ok: false, detail: 'filename reserved' };
  if (raw.includes('/') || raw.includes('\\')) return { ok: false, detail: 'path separators are not allowed' };
  if (/\s/.test(raw)) return { ok: false, detail: 'spaces are not allowed' };
  if (/[?#%]/.test(raw)) return { ok: false, detail: 'url-reserved characters are not allowed' };
  if (!/^[A-Za-z0-9._-]+$/.test(raw)) return { ok: false, detail: 'unsupported characters in filename' };
  return { ok: true, filename: raw };
}

const ACCOUNT_ASSET_CANONICAL_PREFIX = 'accounts/';

export function buildAccountAssetKey(
  accountId: string,
  assetId: string,
  versionFingerprint: string,
  filename: string,
): string {
  return `${ACCOUNT_ASSET_CANONICAL_PREFIX}${accountId}/assets/versions/${assetId}/${versionFingerprint}/${filename}`;
}

function normalizeCanonicalAccountAssetSuffix(suffix: string): string | null {
  const parts = String(suffix || '')
    .split('/')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (parts.length !== 6) return null;
  const [accountId, assetsSegment, versionsSegment, assetId, versionFingerprint, filename] = parts;
  if (assetsSegment !== 'assets' || versionsSegment !== 'versions') return null;
  if (!accountId || !assetId || !versionFingerprint || !filename) return null;
  if (!/^[0-9a-f-]{36}$/i.test(accountId) || !/^[0-9a-f-]{36}$/i.test(assetId)) return null;
  if (!/^[a-f0-9]{64}$/i.test(versionFingerprint)) return null;
  return `${ACCOUNT_ASSET_CANONICAL_PREFIX}${accountId}/assets/versions/${assetId}/${versionFingerprint}/${filename}`;
}

export function normalizeAccountAssetReadKey(pathname: string): string | null {
  const key = String(pathname || '').replace(/^\/+/, '');
  if (!key.startsWith(ACCOUNT_ASSET_CANONICAL_PREFIX)) return null;
  return normalizeCanonicalAccountAssetSuffix(key.slice(ACCOUNT_ASSET_CANONICAL_PREFIX.length));
}

type AccountAssetIdentity = { accountId: string; assetId: string };

export function buildAccountAssetVersionPath(versionKey: string): string {
  const versionPath = toCanonicalAssetVersionPath(versionKey);
  if (!versionPath) throw new Error('[tokyo] invalid account asset version key');
  return versionPath;
}

export function parseAccountAssetIdentityFromKey(key: string): AccountAssetIdentity | null {
  const normalized = normalizeAccountAssetReadKey(key.startsWith('/') ? key : `/${key}`);
  if (!normalized) return null;
  const suffix = normalized.slice(ACCOUNT_ASSET_CANONICAL_PREFIX.length);
  const parts = suffix.split('/').filter(Boolean);
  if (parts.length !== 6) return null;
  const accountId = parts[0];
  const assetId = parts[3];
  if (!accountId || !assetId || !/^[0-9a-f-]{36}$/i.test(accountId) || !/^[0-9a-f-]{36}$/i.test(assetId)) {
    return null;
  }
  return { accountId, assetId };
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

export const normalizePublicId = normalizeWidgetPublicId;

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
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
