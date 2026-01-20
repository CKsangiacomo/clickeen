'use client';

type PersistScope = 'workspace' | 'curated';

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
  scope,
  workspaceId,
  publicId,
  widgetType,
  blob,
  filename,
  variant = 'original',
  uploadEndpoint,
}: {
  scope: PersistScope;
  workspaceId?: string;
  publicId?: string;
  widgetType?: string;
  blob: Blob;
  filename: string;
  variant?: string;
  uploadEndpoint: string;
}): Promise<string> {
  const headers = new Headers();
  headers.set('content-type', blob.type || 'application/octet-stream');
  headers.set('x-filename', filename || 'upload.bin');
  headers.set('x-variant', variant);

  if (scope === 'workspace') {
    if (!workspaceId) throw new Error('[persistConfigAssetsToTokyo] Missing workspaceId for workspace asset upload');
    headers.set('x-workspace-id', workspaceId);
  } else if (scope === 'curated') {
    if (!publicId) throw new Error('[persistConfigAssetsToTokyo] Missing publicId for curated asset upload');
    if (!widgetType) throw new Error('[persistConfigAssetsToTokyo] Missing widgetType for curated asset upload');
    headers.set('x-public-id', publicId);
    headers.set('x-widget-type', widgetType);
  } else {
    throw new Error(`[persistConfigAssetsToTokyo] Unknown asset upload scope: ${String(scope)}`);
  }

  const endpoint = `${uploadEndpoint.replace(/\/$/, '')}?scope=${encodeURIComponent(scope)}&_t=${Date.now()}`;
  const res = await fetch(endpoint, { method: 'POST', headers, body: blob });
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
    publicId,
    widgetType,
    uploadEndpoint = '/api/assets/upload',
  }: {
    scope?: PersistScope;
    workspaceId?: string;
    publicId?: string;
    widgetType?: string;
    uploadEndpoint?: string;
  }
): Promise<Record<string, unknown>> {
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
      if (!url || !isNonPersistableUrl(url)) return;

      if (!cache.has(url)) {
        const blob = await fetch(url).then((r) => r.blob());
        const ext = extFromMime(blob.type);
        const filename = `upload.${ext}`;
        const uploadedUrl = await uploadTokyoAsset({
          scope,
          workspaceId,
          publicId,
          widgetType,
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
