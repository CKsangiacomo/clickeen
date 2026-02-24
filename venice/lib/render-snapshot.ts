import { normalizeLocaleToken } from '@clickeen/l10n';
import { tokyoFetch } from './tokyo';

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

type RenderIndexEntry = { e: string; r: string; meta: string };

type RenderIndex = {
  v: 1;
  publicId: string;
  current: Record<string, RenderIndexEntry>;
};

type RenderPublishedPointer = {
  v: 1;
  publicId: string;
  revision: string;
  previousRevision?: string | null;
  updatedAt?: string | null;
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

function normalizeRenderPublishedPointer(raw: unknown, publicId: string): RenderPublishedPointer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw as any;
  if (payload.v !== 1) return null;
  const pid = typeof payload.publicId === 'string' ? payload.publicId.trim() : '';
  if (pid && pid !== publicId) return null;
  const revision = typeof payload.revision === 'string' ? payload.revision.trim().toLowerCase() : '';
  if (!/^[a-z0-9][a-z0-9_-]{7,63}$/.test(revision)) return null;
  const previousRevisionRaw =
    typeof payload.previousRevision === 'string' ? payload.previousRevision.trim().toLowerCase() : '';
  const previousRevision = previousRevisionRaw
    ? /^[a-z0-9][a-z0-9_-]{7,63}$/.test(previousRevisionRaw)
      ? previousRevisionRaw
      : null
    : null;
  if (previousRevisionRaw && !previousRevision) return null;
  if (previousRevision && previousRevision === revision) return null;
  const updatedAtRaw = typeof payload.updatedAt === 'string' ? payload.updatedAt.trim() : '';
  const updatedAt = updatedAtRaw || null;
  return { v: 1, publicId, revision, previousRevision, updatedAt };
}

export type RenderSnapshotVariant = 'e' | 'r' | 'meta';

export type RenderSnapshotLoadResult =
  | {
      ok: true;
      fingerprint: string;
      bytes: ArrayBuffer;
      contentType: string | null;
      pointerUpdatedAt: string | null;
    }
  | { ok: false; reason: string };

async function loadRevisionRenderIndex(args: {
  publicId: string;
  revision: string;
}): Promise<{ index: RenderIndex | null; reason: string | null }> {
  const revisionIndexRes = await tokyoFetch(
    `/renders/instances/${encodeURIComponent(args.publicId)}/revisions/${encodeURIComponent(args.revision)}/index.json`,
    { method: 'GET' },
  );
  if (revisionIndexRes.status === 404) return { index: null, reason: 'REVISION_INDEX_NOT_FOUND' };
  if (!revisionIndexRes.ok) return { index: null, reason: `REVISION_INDEX_HTTP_${revisionIndexRes.status}` };
  const revisionIndexJson = (await revisionIndexRes.json().catch(() => null)) as unknown;
  const index = normalizeRenderIndex(revisionIndexJson, args.publicId);
  if (!index) return { index: null, reason: 'REVISION_INDEX_INVALID' };
  return { index, reason: null };
}

export async function loadRenderSnapshot(args: {
  publicId: string;
  locale: string;
  variant: RenderSnapshotVariant;
}): Promise<RenderSnapshotLoadResult> {
  const publicId = String(args.publicId || '').trim();
  if (!publicId) return { ok: false, reason: 'PUBLIC_ID_MISSING' };

  const locale = normalizeLocaleToken(args.locale) ?? 'en';
  let index: RenderIndex | null = null;
  let pointerUpdatedAt: string | null = null;
  const pointerRes = await tokyoFetch(`/renders/instances/${encodeURIComponent(publicId)}/published.json`, { method: 'GET' });
  if (pointerRes.ok) {
    const pointerJson = (await pointerRes.json().catch(() => null)) as unknown;
    const pointer = normalizeRenderPublishedPointer(pointerJson, publicId);
    if (!pointer) return { ok: false, reason: 'POINTER_INVALID' };
    pointerUpdatedAt = pointer.updatedAt ?? null;

    const primaryRevision = await loadRevisionRenderIndex({ publicId, revision: pointer.revision });
    if (primaryRevision.index) {
      index = primaryRevision.index;
    }

    if (!index) {
      return { ok: false, reason: primaryRevision.reason ?? 'REVISION_INDEX_NOT_FOUND' };
    }
  } else if (pointerRes.status === 404) {
    return { ok: false, reason: 'NEVER_PUBLISHED' };
  } else {
    return { ok: false, reason: `POINTER_HTTP_${pointerRes.status}` };
  }

  if (!index) return { ok: false, reason: 'INDEX_UNAVAILABLE' };

  const entry = index.current[locale] ?? null;
  if (!entry) return { ok: false, reason: 'LOCALE_MISSING' };

  const filename = args.variant === 'e' ? 'e.html' : args.variant === 'meta' ? 'meta.json' : 'r.json';
  const fingerprint = args.variant === 'e' ? entry.e : args.variant === 'meta' ? entry.meta : entry.r;
  const artifactRes = await tokyoFetch(
    `/renders/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(fingerprint)}/${filename}`,
    { method: 'GET' },
  );
  if (artifactRes.status === 404) return { ok: false, reason: 'ARTIFACT_NOT_FOUND' };
  if (!artifactRes.ok) return { ok: false, reason: `ARTIFACT_HTTP_${artifactRes.status}` };
  const bytes = await artifactRes.arrayBuffer();
  return {
    ok: true,
    fingerprint,
    bytes,
    contentType: artifactRes.headers.get('content-type'),
    pointerUpdatedAt,
  };
}
