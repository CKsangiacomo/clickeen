import {
  buildAccountAssetKey,
  buildAccountAssetVersionPath,
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
  loadAccountAssetUsagePublicIdsByIdentity,
  loadAccountAssetVariantIdentitiesByAccount,
  loadAccountAssetVariantKeys,
  loadAccountMembershipRole,
  loadAccountUploadProfile,
  loadWorkspaceMembershipRole,
  loadWorkspaceUploadContext,
  normalizeAccountAssetSource,
  persistAccountAssetMetadata,
  resolveUploadSizeLimitBytes,
  resolveUploadsBytesBudgetMax,
  resolveUploadsCountBudgetMax,
  roleRank,
} from './assets';

const ACCOUNT_ASSET_NAMESPACE_PREFIX = 'assets/versions/';
const ACCOUNT_ASSET_R2_LIST_PAGE_SIZE = 1000;
const ASSET_INTEGRITY_SAMPLE_LIMIT = 50;
const ASSET_IDENTITY_INTEGRITY_SAMPLE_LIMIT = 50;

const ASSET_INTEGRITY_REASON_POINTER_MISSING_BLOB = 'coreui.errors.assets.integrity.dbPointerMissingBlob';
const ASSET_INTEGRITY_REASON_ORPHAN_BLOB = 'coreui.errors.assets.integrity.orphanBlob';
const ASSET_INTEGRITY_REASON_VARIANTS_MISSING = 'coreui.errors.assets.integrity.variantsMissingForAsset';

type UploadTierResolutionResult =
  | { ok: true; tier: string | null }
  | { ok: false; response: Response };

type UploadBudgetResult =
  | { ok: true }
  | { ok: false; response: Response };

type AssetMirrorIntegritySampleRef = {
  assetId: string;
  r2Key: string;
};

type AssetMirrorIntegritySnapshot = {
  ok: boolean;
  dbVariantCount: number;
  r2ObjectCount: number;
  missingInR2Count: number;
  orphanInR2Count: number;
  missingInR2: AssetMirrorIntegritySampleRef[];
  orphanInR2: string[];
};

type AssetIdentityIntegritySnapshot = {
  ok: boolean;
  reasonKey: string | null;
  dbVariantCount: number;
  r2ObjectCount: number;
  missingInR2Count: number;
  orphanInR2Count: number;
  missingInR2: string[];
  orphanInR2: string[];
};

function denyEntitlement(reasonKey: string, detail: string, status: number): Response {
  return json(
    {
      error: {
        kind: 'DENY',
        reasonKey,
        upsell: 'UP',
        detail,
      },
    },
    { status },
  );
}

async function resolveUploadTierAndAuthorization(args: {
  env: Env;
  auth: Exclude<Awaited<ReturnType<typeof assertUploadAuth>>, { ok: false }>;
  accountId: string;
  workspaceId: string;
}): Promise<UploadTierResolutionResult> {
  const { env, auth, accountId, workspaceId } = args;
  if (!workspaceId) {
    if (auth.trusted) return { ok: true, tier: null };
    try {
      const membershipRole = await loadAccountMembershipRole(env, accountId, auth.principal.userId);
      if (!membershipRole || roleRank(membershipRole) < roleRank('editor')) {
        return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 }) };
      }
      return { ok: true, tier: null };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        response: json({ error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail } }, { status: 500 }),
      };
    }
  }

  if (!isUuid(workspaceId)) {
    return { ok: false, response: json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } }, { status: 422 }) };
  }

  const workspace = await loadWorkspaceUploadContext(env, workspaceId);
  if (!workspace) {
    return { ok: false, response: json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } }, { status: 422 }) };
  }
  if (!workspace.accountId || workspace.accountId !== accountId) {
    return {
      ok: false,
      response: json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.account.workspaceMismatch' } }, { status: 422 }),
    };
  }

  if (auth.trusted) return { ok: true, tier: workspace.tier ?? null };

  try {
    const membershipRole = await loadWorkspaceMembershipRole(env, workspaceId, auth.principal.userId);
    if (!membershipRole || roleRank(membershipRole) < roleRank('editor')) {
      return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 }) };
    }
    return { ok: true, tier: workspace.tier ?? null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      response: json({ error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail } }, { status: 500 }),
    };
  }
}

async function enforceUploadBudgets(args: {
  env: Env;
  accountId: string;
  uploadsBytesMax: number | null;
  uploadsCountMax: number | null;
  bodyBytes: number;
}): Promise<UploadBudgetResult> {
  const { env, accountId, uploadsBytesMax, uploadsCountMax, bodyBytes } = args;
  const checks: Array<{ budgetKey: string; max: number | null; amount: number }> = [
    { budgetKey: UPLOADS_BYTES_BUDGET_KEY, max: uploadsBytesMax, amount: bodyBytes },
    { budgetKey: UPLOADS_COUNT_BUDGET_KEY, max: uploadsCountMax, amount: 1 },
  ];
  for (const check of checks) {
    const budget = await consumeAccountBudget({
      env,
      accountId,
      budgetKey: check.budgetKey,
      max: check.max,
      amount: check.amount,
    });
    if (budget.ok) continue;
    return {
      ok: false,
      response: denyEntitlement(budget.reasonKey, budget.detail, 403),
    };
  }
  return { ok: true };
}

function resolveAccountAssetNamespacePrefix(accountId: string): string {
  return `${ACCOUNT_ASSET_NAMESPACE_PREFIX}${accountId}/`;
}

function resolveAccountAssetIdentityPrefix(accountId: string, assetId: string): string {
  return `${resolveAccountAssetNamespacePrefix(accountId)}${assetId}/`;
}

async function listAccountAssetR2Keys(env: Env, accountId: string): Promise<string[]> {
  const prefix = resolveAccountAssetNamespacePrefix(accountId);
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.TOKYO_R2.list({
      prefix,
      limit: ACCOUNT_ASSET_R2_LIST_PAGE_SIZE,
      cursor,
    });
    listed.objects.forEach((obj) => {
      const key = typeof obj.key === 'string' ? obj.key.trim() : '';
      if (key) keys.push(key);
    });
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return keys;
}

async function listAccountAssetR2KeysByIdentity(env: Env, accountId: string, assetId: string): Promise<string[]> {
  const prefix = resolveAccountAssetIdentityPrefix(accountId, assetId);
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.TOKYO_R2.list({
      prefix,
      limit: ACCOUNT_ASSET_R2_LIST_PAGE_SIZE,
      cursor,
    });
    listed.objects.forEach((obj) => {
      const key = typeof obj.key === 'string' ? obj.key.trim() : '';
      if (key) keys.push(key);
    });
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return keys;
}

function resolveAssetIdentityIntegrityReasonKey(args: {
  dbVariantCount: number;
  missingInR2Count: number;
  orphanInR2Count: number;
}): string | null {
  if (args.dbVariantCount === 0) return ASSET_INTEGRITY_REASON_VARIANTS_MISSING;
  if (args.missingInR2Count > 0) return ASSET_INTEGRITY_REASON_POINTER_MISSING_BLOB;
  if (args.orphanInR2Count > 0) return ASSET_INTEGRITY_REASON_ORPHAN_BLOB;
  return null;
}

async function buildAccountAssetIdentityIntegrity(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<AssetIdentityIntegritySnapshot> {
  const [variantKeys, r2Keys] = await Promise.all([
    loadAccountAssetVariantKeys(env, accountId, assetId),
    listAccountAssetR2KeysByIdentity(env, accountId, assetId),
  ]);
  const variantKeySet = new Set<string>(variantKeys);
  const missingInR2: string[] = [];
  for (const key of variantKeys) {
    const found = await env.TOKYO_R2.head(key);
    if (!found) missingInR2.push(key);
  }
  const orphanInR2 = r2Keys.filter((key) => !variantKeySet.has(key));
  const reasonKey = resolveAssetIdentityIntegrityReasonKey({
    dbVariantCount: variantKeys.length,
    missingInR2Count: missingInR2.length,
    orphanInR2Count: orphanInR2.length,
  });
  return {
    ok: reasonKey == null,
    reasonKey,
    dbVariantCount: variantKeys.length,
    r2ObjectCount: r2Keys.length,
    missingInR2Count: missingInR2.length,
    orphanInR2Count: orphanInR2.length,
    missingInR2: missingInR2.slice(0, ASSET_IDENTITY_INTEGRITY_SAMPLE_LIMIT),
    orphanInR2: orphanInR2.slice(0, ASSET_IDENTITY_INTEGRITY_SAMPLE_LIMIT),
  };
}

function jsonAssetIdentityIntegrityMismatch(
  accountId: string,
  assetId: string,
  snapshot: AssetIdentityIntegritySnapshot,
): Response {
  const reasonKey = snapshot.reasonKey || 'coreui.errors.assets.integrityMismatch';
  return json(
    {
      error: {
        kind: 'INTEGRITY',
        reasonKey,
        detail: 'Asset metadata and stored blobs are out of sync for this asset identity.',
      },
      accountId,
      assetId,
      integrity: snapshot,
    },
    { status: 409 },
  );
}

async function buildAccountAssetMirrorIntegrity(env: Env, accountId: string): Promise<AssetMirrorIntegritySnapshot> {
  const [variantRefs, r2Keys] = await Promise.all([
    loadAccountAssetVariantIdentitiesByAccount(env, accountId),
    listAccountAssetR2Keys(env, accountId),
  ]);
  const dbKeySet = new Set<string>();
  variantRefs.forEach((ref) => dbKeySet.add(ref.r2Key));
  const r2KeySet = new Set<string>(r2Keys);

  const missingInR2 = variantRefs.filter((ref) => !r2KeySet.has(ref.r2Key));
  const orphanInR2 = r2Keys.filter((key) => !dbKeySet.has(key));

  return {
    ok: missingInR2.length === 0 && orphanInR2.length === 0,
    dbVariantCount: variantRefs.length,
    r2ObjectCount: r2Keys.length,
    missingInR2Count: missingInR2.length,
    orphanInR2Count: orphanInR2.length,
    missingInR2: missingInR2.slice(0, ASSET_INTEGRITY_SAMPLE_LIMIT),
    orphanInR2: orphanInR2.slice(0, ASSET_INTEGRITY_SAMPLE_LIMIT),
  };
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
  const tierResolution = await resolveUploadTierAndAuthorization({
    env,
    auth,
    accountId,
    workspaceId,
  });
  if (!tierResolution.ok) return tierResolution.response;
  const tier = tierResolution.tier;

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
  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 });
  }
  if (maxBytes != null && body.byteLength > maxBytes) {
    return denyEntitlement('coreui.upsell.reason.capReached', `${UPLOAD_SIZE_CAP_KEY}=${maxBytes}`, 413);
  }

  const uploadsMax = resolveUploadsCountBudgetMax(tier);
  const uploadsBytesMax = resolveUploadsBytesBudgetMax(tier);
  const budgetResult = await enforceUploadBudgets({
    env,
    accountId,
    uploadsBytesMax,
    uploadsCountMax: uploadsMax,
    bodyBytes: body.byteLength,
  });
  if (!budgetResult.ok) return budgetResult.response;

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
  return new Response('Not found', { status: 404 });
}

async function handleGetAccountAssetIdentityIntegrity(
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

  const snapshot = await buildAccountAssetIdentityIntegrity(env, accountId, assetId);
  if (snapshot.ok) {
    return json({
      accountId,
      assetId,
      integrity: snapshot,
    });
  }
  return jsonAssetIdentityIntegrityMismatch(accountId, assetId, snapshot);
}

async function handleGetAccountAssetMirrorIntegrity(
  req: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const authErr = requireDevAuth(req, env);
  if (authErr) return authErr;
  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }

  const snapshot = await buildAccountAssetMirrorIntegrity(env, accountId);
  if (snapshot.ok) {
    return json({
      accountId,
      integrity: snapshot,
    });
  }

  return json(
    {
      error: {
        kind: 'INTEGRITY',
        reasonKey: 'coreui.errors.assets.integrityMismatch',
        detail: 'Account asset metadata and R2 namespace are out of sync.',
      },
      accountId,
      integrity: snapshot,
    },
    { status: 409 },
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

  const integritySnapshot = await buildAccountAssetIdentityIntegrity(env, accountId, assetId);
  if (!integritySnapshot.ok) {
    return jsonAssetIdentityIntegrityMismatch(accountId, assetId, integritySnapshot);
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
  for (const key of variantKeys) {
    try {
      await env.TOKYO_R2.delete(key);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: `failed to delete blob ${key}: ${detail}`,
          },
        },
        { status: 500 },
      );
    }
  }

  try {
    await deleteAccountAssetUsageByIdentity(env, accountId, assetId);
    await deleteAccountAssetVariantsByIdentity(env, accountId, assetId);
    await deleteAccountAssetByIdentity(env, accountId, assetId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail,
        },
      },
      { status: 500 },
    );
  }

  return json(
    {
      accountId,
      assetId,
      deleted: true,
      usageCount,
    },
    { status: 200 },
  );
}


export {
  handleDeleteAccountAsset,
  handleGetAccountAsset,
  handleGetAccountAssetIdentityIntegrity,
  handleGetAccountAssetMirrorIntegrity,
  handleUploadAccountAsset,
};
