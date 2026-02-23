import {
  guessContentTypeFromExt,
  normalizeLocale,
  normalizeSha256Hex,
  prettyStableJson,
  sha256Hex,
  supabaseFetch,
} from '../index';
import type { Env } from '../index';

export type RenderSnapshotQueueJob = {
  v: 1;
  kind: 'render-snapshot';
  publicId: string;
  locales?: string[];
  action?: 'upsert' | 'delete';
};

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
  updatedAt: string;
};

type InstanceEnforcementState = {
  mode: 'frozen';
  periodKey: string;
  frozenAt: string;
  resetAt: string;
};

async function loadInstanceEnforcement(env: Env, publicId: string): Promise<InstanceEnforcementState | null> {
  try {
    const params = new URLSearchParams({
      select: 'public_id,mode,period_key,frozen_at,reset_at',
      public_id: `eq.${publicId}`,
      limit: '1',
    });
    const res = await supabaseFetch(env, `/rest/v1/instance_enforcement_state?${params.toString()}`, { method: 'GET' });
    if (!res.ok) return null;
    const rows = (await res.json().catch(() => null)) as Array<{
      public_id?: unknown;
      mode?: unknown;
      period_key?: unknown;
      frozen_at?: unknown;
      reset_at?: unknown;
    }> | null;
    const row = rows?.[0];
    if (!row) return null;
    if (row.mode !== 'frozen') return null;
    const resetAt = typeof row.reset_at === 'string' ? row.reset_at : '';
    const resetMs = resetAt ? Date.parse(resetAt) : NaN;
    if (!Number.isFinite(resetMs) || resetMs <= Date.now()) return null;
    const periodKey = typeof row.period_key === 'string' ? row.period_key : '';
    const frozenAt = typeof row.frozen_at === 'string' ? row.frozen_at : '';
    return {
      mode: 'frozen',
      periodKey,
      frozenAt,
      resetAt,
    };
  } catch {
    return null;
  }
}

function resolveVeniceBase(env: Env): string {
  const raw = typeof env.VENICE_BASE_URL === 'string' ? env.VENICE_BASE_URL.trim() : '';
  if (!raw) throw new Error('[tokyo] Missing VENICE_BASE_URL for render snapshot generation');
  return raw.replace(/\/+$/, '');
}

function isRenderSnapshotJob(value: unknown): value is RenderSnapshotQueueJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const job = value as any;
  if (job.v !== 1) return false;
  if (job.kind !== 'render-snapshot') return false;
  return typeof job.publicId === 'string';
}

function normalizeRenderLocales(locales: unknown): string[] {
  if (!Array.isArray(locales)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  locales.forEach((raw) => {
    const normalized = normalizeLocale(raw);
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

function renderIndexKey(publicId: string): string {
  return `renders/instances/${publicId}/index.json`;
}

function renderPublishedPointerKey(publicId: string): string {
  return `renders/instances/${publicId}/published.json`;
}

function renderRevisionIndexKey(publicId: string, revision: string): string {
  return `renders/instances/${publicId}/revisions/${revision}/index.json`;
}

function renderArtifactKey(publicId: string, fingerprint: string, filename: 'e.html' | 'r.json' | 'meta.json'): string {
  return `renders/instances/${publicId}/${fingerprint}/${filename}`;
}

function normalizeRenderRevision(raw: unknown): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (!/^[a-z0-9][a-z0-9_-]{7,63}$/i.test(value)) return null;
  return value;
}

function assertRenderIndexShape(payload: any, publicId: string): RenderIndex {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('[tokyo] render index must be an object');
  }
  if (payload.v !== 1) throw new Error('[tokyo] render index.v must be 1');
  const pid = typeof payload.publicId === 'string' ? payload.publicId.trim() : '';
  if (pid && pid !== publicId) throw new Error('[tokyo] render index.publicId mismatch');
  const current = payload.current;
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    throw new Error('[tokyo] render index.current must be an object');
  }

  const normalized: Record<string, RenderIndexEntry> = {};
  for (const [rawLocale, entry] of Object.entries(current)) {
    const locale = normalizeLocale(rawLocale);
    if (!locale || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const e = normalizeSha256Hex((entry as any).e);
    const r = normalizeSha256Hex((entry as any).r);
    const meta = normalizeSha256Hex((entry as any).meta);
    if (!e || !r || !meta) continue;
    normalized[locale] = { e, r, meta };
  }

  return { v: 1, publicId, current: normalized };
}

function assertRenderPublishedPointerShape(payload: any, publicId: string): RenderPublishedPointer {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('[tokyo] published pointer must be an object');
  }
  if (payload.v !== 1) throw new Error('[tokyo] published pointer.v must be 1');
  const pid = typeof payload.publicId === 'string' ? payload.publicId.trim() : '';
  if (pid && pid !== publicId) throw new Error('[tokyo] published pointer.publicId mismatch');
  const revision = normalizeRenderRevision(payload.revision);
  if (!revision) throw new Error('[tokyo] published pointer.revision invalid');
  const rawPreviousRevision =
    typeof payload.previousRevision === 'string' ? payload.previousRevision.trim() : '';
  const previousRevision = rawPreviousRevision ? normalizeRenderRevision(rawPreviousRevision) : null;
  if (rawPreviousRevision && !previousRevision) {
    throw new Error('[tokyo] published pointer.previousRevision invalid');
  }
  if (previousRevision && previousRevision === revision) {
    throw new Error('[tokyo] published pointer.previousRevision must differ from revision');
  }
  const updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt.trim() : '';
  if (!updatedAt) throw new Error('[tokyo] published pointer.updatedAt missing');
  return {
    v: 1,
    publicId,
    revision,
    previousRevision: previousRevision ?? null,
    updatedAt,
  };
}

async function loadRenderPublishedPointer(env: Env, publicId: string): Promise<RenderPublishedPointer | null> {
  const obj = await env.TOKYO_R2.get(renderPublishedPointerKey(publicId));
  if (!obj) return null;
  const json = (await obj.json().catch(() => null)) as any;
  if (!json) return null;
  return assertRenderPublishedPointerShape(json, publicId);
}

async function putRenderPublishedPointer(
  env: Env,
  publicId: string,
  pointer: RenderPublishedPointer,
): Promise<void> {
  await env.TOKYO_R2.put(renderPublishedPointerKey(publicId), prettyStableJson(pointer), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function deleteRenderPublishedPointer(env: Env, publicId: string): Promise<void> {
  await env.TOKYO_R2.delete(renderPublishedPointerKey(publicId));
}

async function putRenderRevisionIndex(
  env: Env,
  publicId: string,
  revision: string,
  index: RenderIndex,
): Promise<void> {
  await env.TOKYO_R2.put(renderRevisionIndexKey(publicId, revision), prettyStableJson(index), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function loadRenderIndex(env: Env, publicId: string): Promise<RenderIndex | null> {
  const pointer = await loadRenderPublishedPointer(env, publicId).catch(() => null);
  if (pointer?.revision) {
    const revisionObj = await env.TOKYO_R2.get(renderRevisionIndexKey(publicId, pointer.revision));
    if (revisionObj) {
      const revisionJson = (await revisionObj.json().catch(() => null)) as any;
      if (revisionJson) return assertRenderIndexShape(revisionJson, publicId);
    }
  }

  const legacyObj = await env.TOKYO_R2.get(renderIndexKey(publicId));
  if (!legacyObj) return null;
  const legacyJson = (await legacyObj.json().catch(() => null)) as any;
  if (!legacyJson) return null;
  return assertRenderIndexShape(legacyJson, publicId);
}

async function putRenderIndex(env: Env, publicId: string, index: RenderIndex): Promise<void> {
  await env.TOKYO_R2.put(renderIndexKey(publicId), prettyStableJson(index), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function deleteRenderIndex(env: Env, publicId: string): Promise<void> {
  await deleteRenderPublishedPointer(env, publicId);
  await env.TOKYO_R2.delete(renderIndexKey(publicId));
}

async function fetchVeniceBytes(
  env: Env,
  pathnameWithQuery: string,
  opts?: { headers?: Record<string, string> },
): Promise<{ bytes: ArrayBuffer; contentType: string | null; effectiveLocale: string | null; l10nStatus: string | null }> {
  const base = resolveVeniceBase(env);
  const bypassToken = String(env.VENICE_INTERNAL_BYPASS_TOKEN || '').trim();
  const headers: Record<string, string> = {
    'X-Request-ID': crypto.randomUUID(),
    ...opts?.headers,
  };
  if (bypassToken && headers['X-Ck-Snapshot-Bypass'] === '1') {
    headers['X-Ck-Internal-Bypass-Token'] = bypassToken;
  }
  const res = await fetch(`${base}${pathnameWithQuery.startsWith('/') ? pathnameWithQuery : `/${pathnameWithQuery}`}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[tokyo] Venice snapshot fetch failed (${res.status}) ${detail}`.trim());
  }
  const bytes = await res.arrayBuffer();
  const contentType = res.headers.get('content-type');
  const effectiveLocale = res.headers.get('x-ck-l10n-effective-locale') ?? res.headers.get('X-Ck-L10n-Effective-Locale');
  const l10nStatus = res.headers.get('x-ck-l10n-status') ?? res.headers.get('X-Ck-L10n-Status');
  return { bytes, contentType, effectiveLocale: effectiveLocale ? effectiveLocale.trim() : null, l10nStatus: l10nStatus ? l10nStatus.trim() : null };
}

async function putImmutableRenderArtifact(args: {
  env: Env;
  publicId: string;
  filename: 'e.html' | 'r.json' | 'meta.json';
  bytes: ArrayBuffer;
  contentType: string;
}): Promise<string> {
  const fingerprint = await sha256Hex(args.bytes);
  const key = renderArtifactKey(args.publicId, fingerprint, args.filename);
  await args.env.TOKYO_R2.put(key, args.bytes, {
    httpMetadata: { contentType: args.contentType },
  });
  return fingerprint;
}

async function generateRenderSnapshots(args: {
  env: Env;
  publicId: string;
  locales: string[];
}): Promise<void> {
  const { env, publicId } = args;
  const enforcement = await loadInstanceEnforcement(env, publicId);
  const requestedLocales = args.locales.length ? args.locales : ['en'];
  const locales = enforcement ? ['en'] : Array.from(new Set(['en', ...requestedLocales]));
  const existing = enforcement ? null : await loadRenderIndex(env, publicId).catch(() => null);
  const nextCurrent: Record<string, RenderIndexEntry> = existing?.current ? { ...existing.current } : {};

  for (const locale of locales) {
    const bypassHeaders = { 'X-Ck-Snapshot-Bypass': '1' };
    const enforcementQuery = enforcement
      ? `&enforcement=frozen&frozenAt=${encodeURIComponent(enforcement.frozenAt)}&resetAt=${encodeURIComponent(
          enforcement.resetAt,
        )}`
      : '';
    const ePromise = fetchVeniceBytes(
      env,
      `/e/${encodeURIComponent(publicId)}?locale=${encodeURIComponent(locale)}${enforcementQuery}`,
      {
        headers: bypassHeaders,
      },
    );
    const rPromise = fetchVeniceBytes(
      env,
      `/r/${encodeURIComponent(publicId)}?locale=${encodeURIComponent(locale)}${enforcementQuery}`,
      {
        headers: bypassHeaders,
      },
    );
    const metaPromise = fetchVeniceBytes(
      env,
      `/r/${encodeURIComponent(publicId)}?locale=${encodeURIComponent(locale)}&meta=1${enforcementQuery}`,
      {
        headers: bypassHeaders,
      },
    );
    const [e, r, meta] = await Promise.all([ePromise, rPromise, metaPromise]);

    const eFp = await putImmutableRenderArtifact({
      env,
      publicId,
      filename: 'e.html',
      bytes: e.bytes,
      contentType: e.contentType || 'text/html; charset=utf-8',
    });
    const rFp = await putImmutableRenderArtifact({
      env,
      publicId,
      filename: 'r.json',
      bytes: r.bytes,
      contentType: r.contentType || 'application/json; charset=utf-8',
    });
    const metaFp = await putImmutableRenderArtifact({
      env,
      publicId,
      filename: 'meta.json',
      bytes: meta.bytes,
      contentType: meta.contentType || 'application/json; charset=utf-8',
    });

    nextCurrent[locale] = { e: eFp, r: rFp, meta: metaFp };
  }

  const index: RenderIndex = { v: 1, publicId, current: nextCurrent };
  const revision =
    `${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`.toLowerCase();
  const existingPointer = await loadRenderPublishedPointer(env, publicId).catch(() => null);
  const previousRevision =
    existingPointer?.revision && existingPointer.revision !== revision
      ? existingPointer.revision
      : null;
  await putRenderRevisionIndex(env, publicId, revision, index);
  await putRenderPublishedPointer(env, publicId, {
    v: 1,
    publicId,
    revision,
    previousRevision,
    updatedAt: new Date().toISOString(),
  });
  // Legacy compatibility for tooling that still reads /index.json directly.
  await putRenderIndex(env, publicId, index);
}

async function handleGetRenderObject(env: Env, key: string, cacheControl: string): Promise<Response> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', cacheControl);
  return new Response(obj.body, { status: 200, headers });
}

export {
  deleteRenderIndex,
  generateRenderSnapshots,
  handleGetRenderObject,
  isRenderSnapshotJob,
  normalizeRenderLocales,
  normalizeRenderRevision,
  renderArtifactKey,
  renderIndexKey,
  renderPublishedPointerKey,
  renderRevisionIndexKey,
};
