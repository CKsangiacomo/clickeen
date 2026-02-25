import {
  buildAccountAssetKey,
  buildAccountAssetVersionPath,
  buildAccountAssetReplaceKey,
  generateRenderSnapshots,
  guessContentTypeFromExt,
  json,
  loadSnapshotLocalesFromL10nIndex,
  normalizeAccountAssetReadKey,
  normalizePublicId,
  normalizeWidgetType,
  parseAccountAssetIdentityFromKey,
  pickExtension,
  requireDevAuth,
  sanitizeUploadFilename,
  sha256Hex,
  assertUploadAuth,
} from '../index';
import type { Env } from '../index';
import { isUuid } from '@clickeen/ck-contracts';
import {
  UPLOAD_SIZE_CAP_KEY,
  UPLOADS_BYTES_BUDGET_KEY,
  UPLOADS_COUNT_BUDGET_KEY,
  consumeAccountBudget,
  deleteAccountAssetByIdentity,
  deleteAccountAssetUsageByIdentity,
  deleteAccountAssetVariantsByIdentity,
  loadAccountAssetByIdentity,
  loadPrimaryAccountAssetKey,
  loadAccountAssetUsagePublicIdsByIdentity,
  loadAccountAssetVariantKeys,
  loadAccountMembershipRole,
  loadAccountUploadProfile,
  loadWorkspaceMembershipRole,
  loadWorkspaceUploadContext,
  normalizeAccountAssetSource,
  persistAccountAssetMetadata,
  replaceAccountAssetVariantAtomic,
  resolveUploadSizeLimitBytes,
  resolveUploadsBytesBudgetMax,
  resolveUploadsCountBudgetMax,
  roleRank,
  upsertInstanceRenderHealthBatch,
  type MemberRole,
  type ReplaceAccountAssetAtomicResult,
} from './assets';

const CLOUDFLARE_PURGE_CHUNK_SIZE = 30;

function normalizeBaseUrl(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  return value.replace(/\/+$/, '');
}

function resolveAssetPurgeUrls(args: { req: Request; env: Env; variantKeys: string[] }): string[] {
  const paths = Array.from(
    new Set(
      args.variantKeys
        .map((key) => {
          try {
            return buildAccountAssetVersionPath(key);
          } catch {
            return null;
          }
        })
        .filter((path): path is string => Boolean(path)),
    ),
  );
  if (!paths.length) return [];

  const bases = new Set<string>();
  try {
    bases.add(new URL(args.req.url).origin);
  } catch {
    // Ignore malformed request URL.
  }
  const veniceBase = normalizeBaseUrl(args.env.VENICE_BASE_URL);
  if (veniceBase) bases.add(veniceBase);

  const urls: string[] = [];
  bases.forEach((base) => {
    paths.forEach((path) => {
      urls.push(`${base}${path}`);
    });
  });
  return Array.from(new Set(urls));
}

type CloudflarePurgeResult = {
  total: number;
  purged: number;
  failed: number;
  details: string[];
};

function isLocalPurgeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  } catch {
    return false;
  }
}

async function purgeCloudflareByUrls(env: Env, urls: string[]): Promise<CloudflarePurgeResult> {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  if (!unique.length) return { total: 0, purged: 0, failed: 0, details: [] };

  const zoneId = String(env.CLOUDFLARE_ZONE_ID || '').trim();
  const apiToken = String(env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!zoneId || !apiToken) {
    const localOnly = unique.every((url) => isLocalPurgeUrl(url));
    if (localOnly) {
      return {
        total: unique.length,
        purged: unique.length,
        failed: 0,
        details: ['skipped Cloudflare purge for local-only URLs'],
      };
    }
    return {
      total: unique.length,
      purged: 0,
      failed: unique.length,
      details: ['missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN'],
    };
  }

  let purged = 0;
  let failed = 0;
  const details: string[] = [];

  for (let i = 0; i < unique.length; i += CLOUDFLARE_PURGE_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CLOUDFLARE_PURGE_CHUNK_SIZE);
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: chunk }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { success?: unknown; errors?: Array<{ message?: unknown }> }
        | null;
      const success = res.ok && payload?.success === true;
      if (!success) {
        failed += chunk.length;
        const message = Array.isArray(payload?.errors)
          ? payload?.errors
              .map((entry) => (typeof entry?.message === 'string' ? entry.message.trim() : ''))
              .filter(Boolean)
              .join('; ')
          : '';
        details.push(
          message
            ? `chunk ${Math.floor(i / CLOUDFLARE_PURGE_CHUNK_SIZE) + 1} failed: ${message}`
            : `chunk ${Math.floor(i / CLOUDFLARE_PURGE_CHUNK_SIZE) + 1} failed with status ${res.status}`,
        );
        continue;
      }
      purged += chunk.length;
    } catch (error) {
      failed += chunk.length;
      const detail = error instanceof Error ? error.message : String(error);
      details.push(`chunk ${Math.floor(i / CLOUDFLARE_PURGE_CHUNK_SIZE) + 1} failed: ${detail}`);
    }
  }

  return { total: unique.length, purged, failed, details };
}

type HealthUpdate = { status: 'healthy' | 'degraded' | 'error'; reason: string; detail: string | null };

function upsertHealthInMap(
  map: Map<string, HealthUpdate>,
  publicId: string,
  update: HealthUpdate,
): void {
  const nextRank = update.status === 'error' ? 3 : update.status === 'degraded' ? 2 : 1;
  const current = map.get(publicId);
  const currentRank = current ? (current.status === 'error' ? 3 : current.status === 'degraded' ? 2 : 1) : 0;
  if (nextRank >= currentRank) map.set(publicId, update);
}

async function handleUploadAccountAsset(req: Request, env: Env): Promise<Response> {
  const auth = await assertUploadAuth(req, env);
  if (!auth.ok) return auth.response;

  const accountId = (req.headers.get('x-account-id') || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }

  const account = await loadAccountUploadProfile(env, accountId);
  if (!account) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' } }, { status: 404 });
  }
  if (account.status !== 'active') {
    return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.account.disabled' } }, { status: 403 });
  }

  const source = normalizeAccountAssetSource(req.headers.get('x-source'));
  if (!source) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.source.invalid' } }, { status: 422 });
  }

  const workspaceId = (req.headers.get('x-workspace-id') || '').trim();
  let tier: string | null = null;
  if (workspaceId) {
    if (!isUuid(workspaceId)) {
      return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } }, { status: 422 });
    }
    const workspace = await loadWorkspaceUploadContext(env, workspaceId);
    if (!workspace) {
      return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } }, { status: 422 });
    }
    if (!workspace.accountId || workspace.accountId !== accountId) {
      return json(
        { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.account.workspaceMismatch' } },
        { status: 422 },
      );
    }

    if (!auth.trusted) {
      let membershipRole: MemberRole | null = null;
      try {
        membershipRole = await loadWorkspaceMembershipRole(env, workspaceId, auth.principal.userId);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return json(
          { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail } },
          { status: 500 },
        );
      }
      if (!membershipRole || roleRank(membershipRole) < roleRank('editor')) {
        return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 });
      }
    }
    tier = workspace.tier ?? tier;
  } else if (!auth.trusted) {
    let membershipRole: MemberRole | null = null;
    try {
      membershipRole = await loadAccountMembershipRole(env, accountId, auth.principal.userId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return json(
        { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail } },
        { status: 500 },
      );
    }
    if (!membershipRole || roleRank(membershipRole) < roleRank('editor')) {
      return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 });
    }
  }

  const publicIdRaw = (req.headers.get('x-public-id') || '').trim();
  const publicId = publicIdRaw ? normalizePublicId(publicIdRaw) : null;
  if (publicIdRaw && !publicId) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } }, { status: 422 });
  }

  const widgetTypeRaw = (req.headers.get('x-widget-type') || '').trim();
  const widgetType = widgetTypeRaw ? normalizeWidgetType(widgetTypeRaw) : null;
  if (widgetTypeRaw && !widgetType) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } }, { status: 422 });
  }

  const variant = (req.headers.get('x-variant') || '').trim() || 'original';
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(variant)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.variant.invalid' } }, { status: 422 });
  }

  const filename = (req.headers.get('x-filename') || '').trim() || 'upload.bin';
  const contentType = (req.headers.get('content-type') || '').trim() || 'application/octet-stream';
  const ext = pickExtension(filename, contentType);
  const safeFilename = sanitizeUploadFilename(filename, ext, variant);

  const maxBytes = resolveUploadSizeLimitBytes(tier);
  const contentLengthRaw = (req.headers.get('content-length') || '').trim();
  const contentLength = contentLengthRaw ? Number.parseInt(contentLengthRaw, 10) : NaN;
  if (maxBytes != null && Number.isFinite(contentLength) && contentLength > maxBytes) {
    return json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.upsell.reason.capReached',
          upsell: 'UP',
          detail: `${UPLOAD_SIZE_CAP_KEY}=${maxBytes}`,
        },
      },
      { status: 413 },
    );
  }

  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 });
  }
  if (maxBytes != null && body.byteLength > maxBytes) {
    return json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.upsell.reason.capReached',
          upsell: 'UP',
          detail: `${UPLOAD_SIZE_CAP_KEY}=${maxBytes}`,
        },
      },
      { status: 413 },
    );
  }

  const uploadsMax = resolveUploadsCountBudgetMax(tier);
  const uploadsBytesMax = resolveUploadsBytesBudgetMax(tier);

  const bytesBudget = await consumeAccountBudget({
    env,
    accountId,
    budgetKey: UPLOADS_BYTES_BUDGET_KEY,
    max: uploadsBytesMax,
    amount: body.byteLength,
  });
  if (!bytesBudget.ok) {
    return json(
      { error: { kind: 'DENY', reasonKey: bytesBudget.reasonKey, upsell: 'UP', detail: bytesBudget.detail } },
      { status: 403 },
    );
  }

  const uploadBudget = await consumeAccountBudget({
    env,
    accountId,
    budgetKey: UPLOADS_COUNT_BUDGET_KEY,
    max: uploadsMax,
    amount: 1,
  });
  if (!uploadBudget.ok) {
    return json(
      { error: { kind: 'DENY', reasonKey: uploadBudget.reasonKey, upsell: 'UP', detail: uploadBudget.detail } },
      { status: 403 },
    );
  }

  const assetId = crypto.randomUUID();
  const key = buildAccountAssetKey(accountId, assetId, variant, safeFilename);
  await env.TOKYO_R2.put(key, body, { httpMetadata: { contentType } });

  try {
    await persistAccountAssetMetadata({
      env,
      accountId,
      assetId,
      workspaceId: workspaceId || null,
      publicId,
      widgetType,
      variant,
      key,
      source,
      originalFilename: filename,
      normalizedFilename: safeFilename,
      contentType,
      sizeBytes: body.byteLength,
      sha256: await sha256Hex(body),
    });
  } catch (error) {
    await env.TOKYO_R2.delete(key);
    const detail = error instanceof Error ? error.message : String(error);
    return json(
      { error: { kind: 'INTERNAL', reasonKey: 'tokyo.errors.assets.metadataWriteFailed', detail } },
      { status: 500 },
    );
  }

  const origin = new URL(req.url).origin;
  const url = `${origin}${buildAccountAssetVersionPath(key)}`;
  return json(
    {
      accountId,
      assetId,
      variant,
      filename: safeFilename,
      ext,
      contentType,
      sizeBytes: body.byteLength,
      key,
      url,
      source,
      workspaceId: workspaceId || null,
      publicId: publicId ?? null,
      widgetType: widgetType ?? null,
    },
    { status: 200 },
  );
}

function respondImmutableR2Asset(key: string, obj: R2ObjectBody): Response {
  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('cdn-cache-control', 'public, max-age=31536000, immutable');
  headers.set('cloudflare-cdn-cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { status: 200, headers });
}

async function handleGetAccountAsset(env: Env, key: string): Promise<Response> {
  const canonical = normalizeAccountAssetReadKey(key.startsWith('/') ? key : `/${key}`);
  const identity = canonical ? parseAccountAssetIdentityFromKey(canonical) : null;
  if (!canonical || !identity) return new Response('Not found', { status: 404 });

  const assetRow = await loadAccountAssetByIdentity(env, identity.accountId, identity.assetId);
  if (!assetRow) return new Response('Not found', { status: 404 });

  const canonicalObj = await env.TOKYO_R2.get(canonical);
  if (canonicalObj) return respondImmutableR2Asset(canonical, canonicalObj);

  // Backfill compatibility: some environments still have variant keys stored as
  // legacy `arsenale/o/...` object paths even when reads come through `/assets/v/*`.
  const variantKey = await loadPrimaryAccountAssetKey(env, identity.accountId, identity.assetId);
  if (variantKey && variantKey !== canonical) {
    const variantObj = await env.TOKYO_R2.get(variantKey);
    if (variantObj) return respondImmutableR2Asset(variantKey, variantObj);
  }
  return new Response('Not found', { status: 404 });
}

async function handleGetLegacyAccountAssetByIdentity(
  env: Env,
  accountIdRaw: string,
  assetIdRaw: string,
  legacyObjectKeyRaw?: string | null,
): Promise<Response> {
  const accountId = String(accountIdRaw || '').trim();
  const assetId = String(assetIdRaw || '').trim();
  if (!isUuid(accountId) || !isUuid(assetId)) return new Response('Not found', { status: 404 });

  const legacyObjectKey = String(legacyObjectKeyRaw || '').trim();
  if (legacyObjectKey) {
    const legacyObj = await env.TOKYO_R2.get(legacyObjectKey);
    if (legacyObj) return respondImmutableR2Asset(legacyObjectKey, legacyObj);
  }

  const assetRow = await loadAccountAssetByIdentity(env, accountId, assetId);
  if (!assetRow) return new Response('Not found', { status: 404 });

  const key = await loadPrimaryAccountAssetKey(env, accountId, assetId);
  if (!key) return new Response('Not found', { status: 404 });

  const object = await env.TOKYO_R2.get(key);
  if (object) return respondImmutableR2Asset(key, object);
  return new Response('Not found', { status: 404 });
}

async function handleReplaceAccountAssetContent(
  req: Request,
  env: Env,
  accountIdRaw: string,
  assetIdRaw: string,
): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;

  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const assetId = String(assetIdRaw || '').trim();
  if (!assetId || !isUuid(assetId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assetId.invalid' } }, { status: 422 });
  }
  const idempotencyKey = (req.headers.get('idempotency-key') || '').trim();
  if (!idempotencyKey) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.idempotencyKey.required' } },
      { status: 422 },
    );
  }

  const existing = await loadAccountAssetByIdentity(env, accountId, assetId);
  if (!existing) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' } }, { status: 404 });
  }

  const variant = (req.headers.get('x-variant') || '').trim() || 'original';
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(variant)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.variant.invalid' } }, { status: 422 });
  }
  const source = normalizeAccountAssetSource(req.headers.get('x-source')) ?? 'api';
  const filename = (req.headers.get('x-filename') || '').trim() || 'upload.bin';
  const contentType = (req.headers.get('content-type') || '').trim() || 'application/octet-stream';
  const ext = pickExtension(filename, contentType);
  const safeFilename = sanitizeUploadFilename(filename, ext, variant);

  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 });
  }

  const requestSha256 = await sha256Hex(body);
  const key = buildAccountAssetReplaceKey(accountId, assetId, variant, safeFilename, requestSha256);
  await env.TOKYO_R2.put(key, body, { httpMetadata: { contentType } });

  let atomicResult: ReplaceAccountAssetAtomicResult;
  try {
    atomicResult = await replaceAccountAssetVariantAtomic({
      env,
      accountId,
      assetId,
      variant,
      key,
      normalizedFilename: safeFilename,
      contentType,
      sizeBytes: body.byteLength,
      source,
      originalFilename: filename,
      sha256: requestSha256,
      idempotencyKey,
      requestSha256,
    });
  } catch (error) {
    await env.TOKYO_R2.delete(key).catch(() => null);
    const code = (error as Error & { code?: string })?.code || '';
    if (code === 'ASSET_NOT_FOUND') {
      return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' } }, { status: 404 });
    }
    if (code === 'IDEMPOTENCY_CONFLICT') {
      return json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.idempotencyKey.conflict' } },
        { status: 409 },
      );
    }
    const detail = error instanceof Error ? error.message : String(error);
    return json(
      { error: { kind: 'INTERNAL', reasonKey: 'tokyo.errors.assets.metadataWriteFailed', detail } },
      { status: 500 },
    );
  }

  if (atomicResult.replay && atomicResult.currentKey !== key) {
    await env.TOKYO_R2.delete(key).catch(() => null);
  }

  if (!atomicResult.replay && atomicResult.previousKey && atomicResult.previousKey !== atomicResult.currentKey) {
    await env.TOKYO_R2.delete(atomicResult.previousKey).catch(() => null);
  }

  const effectiveKey = atomicResult.currentKey;
  const origin = new URL(req.url).origin;
  const url = `${origin}${buildAccountAssetVersionPath(effectiveKey)}`;
  return json(
    {
      accountId,
      assetId,
      variant,
      filename: safeFilename,
      contentType,
      sizeBytes: body.byteLength,
      key: effectiveKey,
      url,
      idempotencyKey,
      replay: atomicResult.replay,
      replaced: Boolean(!atomicResult.replay && atomicResult.previousKey && atomicResult.previousKey !== effectiveKey),
    },
    { status: 200 },
  );
}

async function handleDeleteAccountAsset(
  req: Request,
  env: Env,
  accountIdRaw: string,
  assetIdRaw: string,
): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;

  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const assetId = String(assetIdRaw || '').trim();
  if (!assetId || !isUuid(assetId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assetId.invalid' } }, { status: 422 });
  }

  const existing = await loadAccountAssetByIdentity(env, accountId, assetId);
  if (!existing) {
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' } }, { status: 404 });
  }

  const impactedPublicIds = await loadAccountAssetUsagePublicIdsByIdentity(env, accountId, assetId);
  const usageCount = impactedPublicIds.length;
  const confirmInUseRaw = (new URL(req.url).searchParams.get('confirmInUse') || '').trim().toLowerCase();
  const confirmInUse = confirmInUseRaw === '1' || confirmInUseRaw === 'true' || confirmInUseRaw === 'yes';
  if (usageCount > 0 && !confirmInUse) {
    return json(
      {
        error: { kind: 'DENY', reasonKey: 'coreui.errors.asset.inUseConfirmRequired' },
        usageCount,
        requiresConfirm: true,
      },
      { status: 409 },
    );
  }

  const variantKeys = await loadAccountAssetVariantKeys(env, accountId, assetId);
  await deleteAccountAssetUsageByIdentity(env, accountId, assetId);
  await deleteAccountAssetVariantsByIdentity(env, accountId, assetId);
  await deleteAccountAssetByIdentity(env, accountId, assetId);

  let failedBlobDeletes = 0;
  const failedBlobDeleteDetails: string[] = [];
  if (variantKeys.length) {
    const deleteResults = await Promise.allSettled(variantKeys.map((key) => env.TOKYO_R2.delete(key)));
    deleteResults.forEach((result, index) => {
      if (result.status === 'fulfilled') return;
      failedBlobDeletes += 1;
      const detail = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failedBlobDeleteDetails.push(`${variantKeys[index]}: ${detail}`);
    });
  }

  const purgeUrls = resolveAssetPurgeUrls({ req, env, variantKeys });
  const purgeResult = await purgeCloudflareByUrls(env, purgeUrls);

  let rebuiltSnapshotRevisions = 0;
  let failedSnapshotRebuilds = 0;
  const failedSnapshotRebuildDetails: string[] = [];
  const rebuiltPublicIds: string[] = [];
  const failedRebuildPublicIds: string[] = [];
  for (const publicId of impactedPublicIds) {
    try {
      const locales = await loadSnapshotLocalesFromL10nIndex({ env, publicId });
      await generateRenderSnapshots({ env, publicId, locales });
      rebuiltSnapshotRevisions += 1;
      rebuiltPublicIds.push(publicId);
    } catch (error) {
      failedSnapshotRebuilds += 1;
      failedRebuildPublicIds.push(publicId);
      const detail = error instanceof Error ? error.message : String(error);
      failedSnapshotRebuildDetails.push(`${publicId}: ${detail}`);
    }
  }

  const renderHealthByPublicId = new Map<string, HealthUpdate>();
  rebuiltPublicIds.forEach((publicId) => {
    upsertHealthInMap(renderHealthByPublicId, publicId, {
      status: 'healthy',
      reason: 'asset_delete_rebuild_applied',
      detail: `Asset ${assetId} deleted; clean revision published.`,
    });
  });
  failedRebuildPublicIds.forEach((publicId) => {
    upsertHealthInMap(renderHealthByPublicId, publicId, {
      status: 'error',
      reason: 'asset_delete_rebuild_failed',
      detail: `Asset ${assetId} deleted; clean revision rebuild failed.`,
    });
  });

  if (failedBlobDeletes > 0 || purgeResult.failed > 0) {
    impactedPublicIds.forEach((publicId) => {
      upsertHealthInMap(renderHealthByPublicId, publicId, {
        status: 'error',
        reason: 'asset_delete_cleanup_failed',
        detail: `Asset ${assetId} delete pipeline had storage or CDN purge failures.`,
      });
    });
  }

  let failedRenderHealthWrites = 0;
  if (renderHealthByPublicId.size > 0) {
    try {
      await upsertInstanceRenderHealthBatch(
        env,
        Array.from(renderHealthByPublicId.entries()).map(([publicId, update]) => ({
          publicId,
          status: update.status,
          reason: update.reason,
          detail: update.detail,
        })),
      );
    } catch {
      failedRenderHealthWrites = renderHealthByPublicId.size;
    }
  }

  if (failedBlobDeletes > 0 || failedSnapshotRebuilds > 0 || purgeResult.failed > 0 || failedRenderHealthWrites > 0) {
    const errorDetails: string[] = [];
    if (failedBlobDeletes > 0) errorDetails.push(`failed to delete ${failedBlobDeletes} asset blob(s)`);
    if (purgeResult.failed > 0) errorDetails.push(`failed to purge ${purgeResult.failed} CDN URL(s)`);
    if (failedSnapshotRebuilds > 0) {
      errorDetails.push(`failed to rebuild ${failedSnapshotRebuilds} snapshot revision(s)`);
    }
    if (failedRenderHealthWrites > 0) {
      errorDetails.push(`failed to persist ${failedRenderHealthWrites} render health update(s)`);
    }
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'tokyo.errors.assets.deletePipelinePartialFailure',
          detail: errorDetails.join('; '),
        },
        accountId,
        assetId,
        deleted: true,
        impactedPublicIds,
        snapshotRebuilds: {
          total: impactedPublicIds.length,
          rebuilt: rebuiltSnapshotRevisions,
          failed: failedSnapshotRebuilds,
        },
        failedBlobDeletes,
        failedBlobDeleteDetails,
        cdnPurge: {
          attempted: purgeResult.total,
          purged: purgeResult.purged,
          failed: purgeResult.failed,
          details: purgeResult.details,
        },
        failedSnapshotRebuildDetails,
        failedRenderHealthWrites,
      },
      { status: 502 },
    );
  }

  return json(
    {
      accountId,
      assetId,
      deleted: true,
      impactedPublicIds,
      snapshotRebuilds: {
        total: impactedPublicIds.length,
        rebuilt: rebuiltSnapshotRevisions,
        failed: failedSnapshotRebuilds,
      },
      cdnPurge: {
        attempted: purgeResult.total,
        purged: purgeResult.purged,
        failed: purgeResult.failed,
      },
    },
    { status: 200 },
  );
}


export {
  handleDeleteAccountAsset,
  handleGetAccountAsset,
  handleGetLegacyAccountAssetByIdentity,
  handleReplaceAccountAssetContent,
  handleUploadAccountAsset,
};
