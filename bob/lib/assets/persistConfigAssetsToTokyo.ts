'use client';

type PersistScope = 'workspace';

function resolveTokyoBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_TOKYO_URL || '').trim();
  if (raw) return raw;
  return 'http://localhost:4000';
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function extractPrimaryUrl(raw: string): string | null {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (/^(?:data|blob):/i.test(v) || /^https?:\/\//i.test(v)) return v;
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

function isNonPersistableUrl(rawUrl: string): boolean {
  const v = String(rawUrl || '').trim();
  return /^(?:data|blob):/i.test(v);
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

async function uploadTokyoAsset({
  tokyoBaseUrl,
  scope,
  workspaceId,
  blob,
  filename,
  variant = 'original',
}: {
  tokyoBaseUrl: string;
  scope: PersistScope;
  workspaceId: string;
  blob: Blob;
  filename: string;
  variant?: string;
}): Promise<string> {
  const headers = new Headers();
  headers.set('content-type', blob.type || 'application/octet-stream');
  headers.set('x-filename', filename || 'upload.bin');
  headers.set('x-variant', variant);

  let endpoint = '';
  if (scope === 'workspace') {
    headers.set('x-workspace-id', workspaceId);
    endpoint = `${tokyoBaseUrl.replace(/\/$/, '')}/workspace-assets/upload`;
  } else {
    throw new Error(`[persistConfigAssetsToTokyo] Unknown asset upload scope: ${String(scope)}`);
  }

  const res = await fetch(`${endpoint}?_t=${Date.now()}`, { method: 'POST', headers, body: blob });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`[persistConfigAssetsToTokyo] Asset upload failed (HTTP ${res.status})${text ? `: ${text}` : ''}`);
  }
  const json = text ? (JSON.parse(text) as any) : null;
  const url = json?.url;
  if (!url || typeof url !== 'string') throw new Error('[persistConfigAssetsToTokyo] Asset upload missing url');
  return url;
}

export async function persistConfigAssetsToTokyo(
  config: Record<string, unknown>,
  {
    scope = 'workspace',
    workspaceId,
    tokyoBaseUrl = resolveTokyoBaseUrl(),
  }: { scope?: PersistScope; workspaceId: string; tokyoBaseUrl?: string }
): Promise<Record<string, unknown>> {
  const next = cloneJson(config);
  const cache = new Map<string, string>();

  const visit = async (node: unknown): Promise<string | void> => {
    if (typeof node === 'string') {
      const url = extractPrimaryUrl(node);
      if (!url || !isNonPersistableUrl(url)) return;

      if (!cache.has(url)) {
        const blob = await fetch(url).then((r) => r.blob());
        const ext = extFromMime(blob.type);
        const filename = `upload.${ext}`;
        const uploadedUrl = await uploadTokyoAsset({
          tokyoBaseUrl,
          scope,
          workspaceId,
          blob,
          filename,
          variant: 'original',
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

