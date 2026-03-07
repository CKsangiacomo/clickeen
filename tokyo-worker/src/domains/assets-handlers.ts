import {
  buildAccountAssetKey,
  buildAccountAssetVersionPath,
  classifyAccountAssetType,
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
  type AccountAssetManifest,
  type MemberRole,
  consumeAccountBudget,
  deleteAccountAssetByIdentity,
  deleteAccountAssetUsageByIdentity,
  loadAccountAssetByIdentity,
  loadAccountAssetUsagePublicIdsByIdentity,
  listAccountAssetManifestsByAccount,
  loadAccountAssetBlobIdentitiesByAccount,
  loadAccountAssetBlobKeys,
  loadAccountMembershipRole,
  loadAccountUploadProfile,
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
const ASSET_INTEGRITY_REASON_BLOB_MISSING_FOR_ASSET = 'coreui.errors.assets.integrity.blobMissingForAsset';

type UploadTierResolutionResult =
  | { ok: true }
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
  dbBlobCount: number;
  r2ObjectCount: number;
  missingInR2Count: number;
  orphanInR2Count: number;
  missingInR2: AssetMirrorIntegritySampleRef[];
  orphanInR2: string[];
};

type AssetIdentityIntegritySnapshot = {
  ok: boolean;
  reasonKey: string | null;
  dbBlobCount: number;
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
  minRole?: MemberRole;
}): Promise<UploadTierResolutionResult> {
  const { env, auth, accountId, minRole = 'editor' } = args;
  if (auth.trusted) return { ok: true };
  try {
    const membershipRole = await loadAccountMembershipRole(env, accountId, auth.principal.userId);
    if (!membershipRole || roleRank(membershipRole) < roleRank(minRole)) {
      return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 }) };
    }
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      response: json({ error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail } }, { status: 500 }),
    };
  }
}

async function authorizeAccountAssetAccess(args: {
  req: Request;
  env: Env;
  accountId: string;
  minRole: MemberRole;
}): Promise<Response | null> {
  const auth = await assertUploadAuth(args.req, args.env);
  if (!auth.ok) return auth.response;
  const authorized = await resolveUploadTierAndAuthorization({
    env: args.env,
    auth,
    accountId: args.accountId,
    minRole: args.minRole,
  });
  if (!authorized.ok) return authorized.response;
  return null;
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

function resolveAccountAssetMetadataPrefix(accountId: string): string {
  return `assets/meta/accounts/${accountId}/assets/`;
}

function resolveAccountAssetIdentityPrefix(accountId: string, assetId: string): string {
  return `${resolveAccountAssetNamespacePrefix(accountId)}${assetId}/`;
}

function serializeAccountAssetManifest(
  manifest: AccountAssetManifest,
  origin: string,
): Record<string, unknown> {
  const assetRef = String(manifest.key || '').trim();
  return {
    assetRef,
    assetType: manifest.assetType,
    contentType: manifest.contentType,
    sizeBytes: manifest.sizeBytes,
    filename: manifest.normalizedFilename,
    createdAt: manifest.createdAt,
    url: `${origin}${buildAccountAssetVersionPath(assetRef)}`,
  };
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
    listed.objects.forEach((obj: { key?: string }) => {
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
    listed.objects.forEach((obj: { key?: string }) => {
      const key = typeof obj.key === 'string' ? obj.key.trim() : '';
      if (key) keys.push(key);
    });
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return keys;
}

function resolveAssetIdentityIntegrityReasonKey(args: {
  dbBlobCount: number;
  missingInR2Count: number;
  orphanInR2Count: number;
}): string | null {
  if (args.dbBlobCount === 0) return ASSET_INTEGRITY_REASON_BLOB_MISSING_FOR_ASSET;
  if (args.missingInR2Count > 0) return ASSET_INTEGRITY_REASON_POINTER_MISSING_BLOB;
  if (args.orphanInR2Count > 0) return ASSET_INTEGRITY_REASON_ORPHAN_BLOB;
  return null;
}

async function buildAccountAssetIdentityIntegrity(
  env: Env,
  accountId: string,
  assetId: string,
): Promise<AssetIdentityIntegritySnapshot> {
  const [blobKeys, r2Keys] = await Promise.all([
    loadAccountAssetBlobKeys(env, accountId, assetId),
    listAccountAssetR2KeysByIdentity(env, accountId, assetId),
  ]);
  const blobKeySet = new Set<string>(blobKeys);
  const missingInR2: string[] = [];
  for (const key of blobKeys) {
    const found = await env.TOKYO_R2.head(key);
    if (!found) missingInR2.push(key);
  }
  const orphanInR2 = r2Keys.filter((key) => !blobKeySet.has(key));
  const reasonKey = resolveAssetIdentityIntegrityReasonKey({
    dbBlobCount: blobKeys.length,
    missingInR2Count: missingInR2.length,
    orphanInR2Count: orphanInR2.length,
  });
  return {
    ok: reasonKey == null,
    reasonKey,
    dbBlobCount: blobKeys.length,
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

async function deleteAccountAssetMetadataWithRetries(args: {
  env: Env;
  accountId: string;
  assetId: string;
  attempts?: number;
}): Promise<void> {
  const attempts = Number.isFinite(args.attempts as number) ? Math.max(1, Math.floor(args.attempts as number)) : 3;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await deleteAccountAssetUsageByIdentity(args.env, args.accountId, args.assetId);
      await deleteAccountAssetByIdentity(args.env, args.accountId, args.assetId);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 75));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'unknown metadata delete failure'));
}

async function sweepResidualAssetBlobs(args: {
  env: Env;
  accountId: string;
  assetId: string;
  attempts?: number;
}): Promise<string[]> {
  const attempts = Number.isFinite(args.attempts as number) ? Math.max(1, Math.floor(args.attempts as number)) : 2;
  let remaining: string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    remaining = await listAccountAssetR2KeysByIdentity(args.env, args.accountId, args.assetId);
    if (!remaining.length) return [];
    await args.env.TOKYO_R2.delete(remaining);
  }
  return listAccountAssetR2KeysByIdentity(args.env, args.accountId, args.assetId);
}

async function buildAccountAssetMirrorIntegrity(env: Env, accountId: string): Promise<AssetMirrorIntegritySnapshot> {
  const [assetRefs, r2Keys] = await Promise.all([
    loadAccountAssetBlobIdentitiesByAccount(env, accountId),
    listAccountAssetR2Keys(env, accountId),
  ]);
  const dbKeySet = new Set<string>();
  assetRefs.forEach((ref) => dbKeySet.add(ref.r2Key));
  const r2KeySet = new Set<string>(r2Keys);

  const missingInR2 = assetRefs.filter((ref) => !r2KeySet.has(ref.r2Key));
  const orphanInR2 = r2Keys.filter((key) => !dbKeySet.has(key));

  return {
    ok: missingInR2.length === 0 && orphanInR2.length === 0,
    dbBlobCount: assetRefs.length,
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

  const legacyVariant = (req.headers.get('x-variant') || '').trim();
  if (legacyVariant) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.variantUnsupported' } }, { status: 422 });
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

  const tierResolution = await resolveUploadTierAndAuthorization({
    env,
    auth,
    accountId,
  });
  if (!tierResolution.ok) return tierResolution.response;
  const tier = account.tier;

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

  const filename = (req.headers.get('x-filename') || '').trim() || 'upload.bin';
  const contentType = (req.headers.get('content-type') || '').trim() || 'application/octet-stream';
  const ext = pickExtension(filename, contentType);
  const safeFilename = sanitizeUploadFilename(filename, ext);
  const assetType = classifyAccountAssetType(contentType, ext);

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
  const key = buildAccountAssetKey(accountId, assetId, safeFilename);
  await env.TOKYO_R2.put(key, body, { httpMetadata: { contentType } });

  try {
    await persistAccountAssetMetadata({
      env,
      accountId,
      assetId,
      publicId,
      widgetType,
      key,
      source,
      originalFilename: filename,
      normalizedFilename: safeFilename,
      contentType,
      assetType,
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
      assetRef: key,
      filename: safeFilename,
      assetType,
      contentType,
      sizeBytes: body.byteLength,
      url,
      createdAt: new Date().toISOString(),
    },
    { status: 200 },
  );
}

function respondImmutableR2Asset(
  key: string,
  obj: { body: ReadableStream | null; httpMetadata?: { contentType?: string | null } | null },
): Response {
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

async function handleListAccountAssetMetadata(
  req: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const authErr = await authorizeAccountAssetAccess({ req, env, accountId, minRole: 'viewer' });
  if (authErr) return authErr;
  const origin = new URL(req.url).origin;
  const manifests = await listAccountAssetManifestsByAccount(env, accountId);
  manifests.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return json({
    accountId,
    assets: manifests.map((manifest) => serializeAccountAssetManifest(manifest, origin)),
  });
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
  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const authErr = await authorizeAccountAssetAccess({ req, env, accountId, minRole: 'editor' });
  if (authErr) return authErr;
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

  const blobKeys = await loadAccountAssetBlobKeys(env, accountId, assetId);
  try {
    if (blobKeys.length) {
      await env.TOKYO_R2.delete(blobKeys);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail: `failed to delete asset blobs: ${detail}`,
        },
      },
      { status: 500 },
    );
  }

  try {
    await deleteAccountAssetMetadataWithRetries({ env, accountId, assetId, attempts: 3 });
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

  try {
    const residualKeys = await sweepResidualAssetBlobs({ env, accountId, assetId, attempts: 2 });
    if (residualKeys.length > 0) {
      return json(
        {
          error: {
            kind: 'INTEGRITY',
            reasonKey: 'coreui.errors.assets.integrityMismatch',
            detail: `Residual blobs remain after delete (${residualKeys.length})`,
          },
          accountId,
          assetId,
          integrity: {
            ok: false,
            reasonKey: ASSET_INTEGRITY_REASON_ORPHAN_BLOB,
            dbBlobCount: 0,
            r2ObjectCount: residualKeys.length,
            missingInR2Count: 0,
            orphanInR2Count: residualKeys.length,
            missingInR2: [],
            orphanInR2: residualKeys.slice(0, ASSET_IDENTITY_INTEGRITY_SAMPLE_LIMIT),
          },
        },
        { status: 409 },
      );
    }
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

async function purgeR2NamespacePrefix(env: Env, prefix: string): Promise<{ deleted: number; sweeps: number; remaining: number }> {
  let deleted = 0;
  let sweeps = 0;

  // Deleting while paginating with cursors can lead to occasional misses depending on
  // listing behavior. Keep it simple and run a couple sweeps until empty (or we stop).
  for (let attempt = 0; attempt < 3; attempt += 1) {
    sweeps += 1;
    let cursor: string | undefined;
    let sweepDeleted = 0;
    do {
      const listed = await env.TOKYO_R2.list({
        prefix,
        limit: ACCOUNT_ASSET_R2_LIST_PAGE_SIZE,
        cursor,
      });
      const keys = listed.objects
        .map((obj: { key?: string }) => (typeof obj.key === 'string' ? obj.key.trim() : ''))
        .filter(Boolean);
      if (keys.length) {
        await env.TOKYO_R2.delete(keys);
        deleted += keys.length;
        sweepDeleted += keys.length;
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    if (sweepDeleted === 0) {
      return { deleted, sweeps, remaining: 0 };
    }
  }

  const remaining = await env.TOKYO_R2.list({ prefix, limit: 1 });
  return { deleted, sweeps, remaining: remaining.objects.length };
}

async function handlePurgeAccountAssets(
  req: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const authErr = await authorizeAccountAssetAccess({ req, env, accountId, minRole: 'editor' });
  if (authErr) return authErr;

  const confirmRaw = (new URL(req.url).searchParams.get('confirm') || '').trim().toLowerCase();
  const confirmed = confirmRaw === '1' || confirmRaw === 'true' || confirmRaw === 'yes';
  if (!confirmed) {
    return json(
      {
        error: { kind: 'DENY', reasonKey: 'coreui.errors.account.assetsPurgeConfirmRequired' },
        accountId,
        requiresConfirm: true,
      },
      { status: 409 },
    );
  }

  const blobPrefix = resolveAccountAssetNamespacePrefix(accountId);
  const metadataPrefix = resolveAccountAssetMetadataPrefix(accountId);
  try {
    const [blobs, metadata] = await Promise.all([
      purgeR2NamespacePrefix(env, blobPrefix),
      purgeR2NamespacePrefix(env, metadataPrefix),
    ]);
    if (blobs.remaining > 0 || metadata.remaining > 0) {
      return json(
        {
          error: {
            kind: 'INTEGRITY',
            reasonKey: 'coreui.errors.assets.integrityMismatch',
            detail: `Residual objects remain after purge (blobs=${blobs.remaining}, metadata=${metadata.remaining})`,
          },
          accountId,
          deletedCount: blobs.deleted + metadata.deleted,
          sweeps: blobs.sweeps + metadata.sweeps,
          remaining: blobs.remaining + metadata.remaining,
        },
        { status: 409 },
      );
    }

    return json(
      {
        ok: true,
        accountId,
        deletedCount: blobs.deleted + metadata.deleted,
        sweeps: blobs.sweeps + metadata.sweeps,
      },
      { status: 200 },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail: `failed to purge account asset blobs: ${detail}`,
        },
        accountId,
      },
      { status: 500 },
    );
  }
}

export {
  handleDeleteAccountAsset,
  handleGetAccountAsset,
  handleGetAccountAssetIdentityIntegrity,
  handleListAccountAssetMetadata,
  handleGetAccountAssetMirrorIntegrity,
  handlePurgeAccountAssets,
  handleUploadAccountAsset,
};
