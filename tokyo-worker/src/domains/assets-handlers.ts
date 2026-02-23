import {
  buildAccountAssetKey,
  buildAccountAssetPointerPath,
  buildAccountAssetReplaceKey,
  guessContentTypeFromExt,
  json,
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
  loadAccountAssetUsageCountByIdentity,
  loadAccountAssetVariantKeys,
  loadAccountMembershipRole,
  loadAccountUploadProfile,
  loadPrimaryAccountAssetKey,
  loadWorkspaceMembershipRole,
  loadWorkspaceUploadContext,
  normalizeAccountAssetSource,
  persistAccountAssetMetadata,
  replaceAccountAssetVariantAtomic,
  resolveUploadSizeLimitBytes,
  resolveUploadsBytesBudgetMax,
  resolveUploadsCountBudgetMax,
  roleRank,
  type MemberRole,
  type ReplaceAccountAssetAtomicResult,
} from './assets';

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
  const url = `${origin}${buildAccountAssetPointerPath(accountId, assetId)}`;
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

function respondPointerR2Asset(key: string, obj: R2ObjectBody): Response {
  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', 'no-store');
  headers.set('cdn-cache-control', 'no-store');
  headers.set('cloudflare-cdn-cache-control', 'no-store');
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
  return new Response('Not found', { status: 404 });
}

async function handleGetAccountAssetPointer(
  env: Env,
  accountIdRaw: string,
  assetIdRaw: string,
): Promise<Response> {
  const accountId = String(accountIdRaw || '').trim();
  const assetId = String(assetIdRaw || '').trim();
  if (!accountId || !assetId || !isUuid(accountId) || !isUuid(assetId)) {
    return new Response('Not found', { status: 404 });
  }

  const assetRow = await loadAccountAssetByIdentity(env, accountId, assetId);
  if (!assetRow) return new Response('Not found', { status: 404 });

  const key = await loadPrimaryAccountAssetKey(env, accountId, assetId);
  if (!key) return new Response('Not found', { status: 404 });

  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return respondPointerR2Asset(key, obj);
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
  const url = `${origin}${buildAccountAssetPointerPath(accountId, assetId)}`;
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
  ctx: ExecutionContext,
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

  const usageCount = await loadAccountAssetUsageCountByIdentity(env, accountId, assetId);
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
  if (variantKeys.length) {
    ctx.waitUntil(Promise.allSettled(variantKeys.map((key) => env.TOKYO_R2.delete(key))));
  }

  return json({
    accountId,
    assetId,
    deleted: true,
  });
}


export {
  handleDeleteAccountAsset,
  handleGetAccountAsset,
  handleGetAccountAssetPointer,
  handleReplaceAccountAssetContent,
  handleUploadAccountAsset,
};
