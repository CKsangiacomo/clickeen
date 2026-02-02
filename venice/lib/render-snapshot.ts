import { normalizeLocaleToken } from '@clickeen/l10n';
import { tokyoFetch } from './tokyo';

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

type RenderIndexEntry = { e: string; r: string; meta: string };

type RenderIndex = {
  v: 1;
  publicId: string;
  current: Record<string, RenderIndexEntry>;
};

function normalizeSha256Hex(raw: unknown): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!SHA256_HEX_RE.test(value)) return null;
  return value;
}

function normalizeRenderIndex(raw: unknown, publicId: string): RenderIndex | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as any;
  if (payload.v !== 1) return null;
  const pid = typeof payload.publicId === 'string' ? payload.publicId.trim() : '';
  if (pid && pid !== publicId) return null;
  if (!payload.current || typeof payload.current !== 'object' || Array.isArray(payload.current)) return null;

  const current: Record<string, RenderIndexEntry> = {};
  for (const [localeKey, entry] of Object.entries(payload.current)) {
    const locale = normalizeLocaleToken(localeKey);
    if (!locale || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const e = normalizeSha256Hex((entry as any).e);
    const r = normalizeSha256Hex((entry as any).r);
    const meta = normalizeSha256Hex((entry as any).meta);
    if (!e || !r || !meta) continue;
    current[locale] = { e, r, meta };
  }

  return { v: 1, publicId, current };
}

export type RenderSnapshotVariant = 'e' | 'r' | 'meta';

export type RenderSnapshotLoadResult =
  | { ok: true; fingerprint: string; bytes: ArrayBuffer; contentType: string | null }
  | { ok: false; reason: string };

export async function loadRenderSnapshot(args: {
  publicId: string;
  locale: string;
  variant: RenderSnapshotVariant;
}): Promise<RenderSnapshotLoadResult> {
  const publicId = String(args.publicId || '').trim();
  if (!publicId) return { ok: false, reason: 'PUBLIC_ID_MISSING' };

  const locale = normalizeLocaleToken(args.locale) ?? 'en';
  const indexRes = await tokyoFetch(`/renders/instances/${encodeURIComponent(publicId)}/index.json`, { method: 'GET' });
  if (indexRes.status === 404) return { ok: false, reason: 'INDEX_NOT_FOUND' };
  if (!indexRes.ok) return { ok: false, reason: `INDEX_HTTP_${indexRes.status}` };

  const indexJson = (await indexRes.json().catch(() => null)) as unknown;
  const index = normalizeRenderIndex(indexJson, publicId);
  if (!index) return { ok: false, reason: 'INDEX_INVALID' };

  const entry = index.current[locale];
  if (!entry) return { ok: false, reason: 'LOCALE_MISSING' };

  const fingerprint = args.variant === 'e' ? entry.e : args.variant === 'meta' ? entry.meta : entry.r;
  const filename = args.variant === 'e' ? 'e.html' : args.variant === 'meta' ? 'meta.json' : 'r.json';
  const artifactRes = await tokyoFetch(
    `/renders/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(fingerprint)}/${filename}`,
    { method: 'GET' },
  );
  if (artifactRes.status === 404) return { ok: false, reason: 'ARTIFACT_NOT_FOUND' };
  if (!artifactRes.ok) return { ok: false, reason: `ARTIFACT_HTTP_${artifactRes.status}` };

  const bytes = await artifactRes.arrayBuffer();
  return { ok: true, fingerprint, bytes, contentType: artifactRes.headers.get('content-type') };
}

