import {
  resolvePolicyFromEntitlementsSnapshot,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import {
  buildAccountAssetKey,
  buildAccountAssetVersionPath,
  classifyAccountAssetType,
  guessContentTypeFromExt,
  normalizeAccountAssetReadKey,
  normalizePublicId,
  normalizeWidgetType,
  parseAccountAssetIdentityFromKey,
  pickExtension,
  validateUploadFilename,
  sha256Hex,
} from '../asset-utils';
import { json } from '../http';
import {
  assertProductAccountAuth,
  INTERNAL_SERVICE_HEADER,
  requireDevAuth,
  TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL,
} from '../auth';
import type { Env } from '../types';
import { isUuid } from '@clickeen/ck-contracts';
import {
  UPLOAD_SIZE_CAP_KEY,
  type AccountAssetManifest,
  type MemberRole,
  deleteAccountAssetByIdentity,
  deleteAccountAssetUsageByIdentity,
  loadAccountAssetByIdentity,
  loadAccountAssetManifestByIdentity,
  loadAccountStoredBytesUsage,
  loadAccountAssetUsagePublicIdsByIdentity,
  listAccountAssetManifestsByAccount,
  loadAccountAssetBlobIdentitiesByAccount,
  loadAccountAssetBlobKeys,
  normalizeAccountAssetSource,
  persistAccountAssetMetadata,
  resolveUploadSizeLimitBytes,
  resolveStorageBytesBudgetMax,
  roleRank,
  STORAGE_BYTES_BUDGET_KEY,
  sumAccountAssetManifestSizeBytes,
  syncAccountStoredBytesUsage,
} from './assets';

const ACCOUNT_ASSET_NAMESPACE_PREFIX = 'assets/versions/';
const ACCOUNT_ASSET_R2_LIST_PAGE_SIZE = 1000;
const ASSET_INTEGRITY_SAMPLE_LIMIT = 50;
const ASSET_IDENTITY_INTEGRITY_SAMPLE_LIMIT = 50;

const ASSET_INTEGRITY_REASON_POINTER_MISSING_BLOB = 'coreui.errors.assets.integrity.dbPointerMissingBlob';
const ASSET_INTEGRITY_REASON_ORPHAN_BLOB = 'coreui.errors.assets.integrity.orphanBlob';
const ASSET_INTEGRITY_REASON_BLOB_MISSING_FOR_ASSET = 'coreui.errors.assets.integrity.blobMissingForAsset';

type UploadTierResolutionResult =
  | { ok: true; accountAuthz: RomaAccountAuthzCapsulePayload }
  | { ok: false; response: Response };

type UploadStorageResult =
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
  auth: Exclude<Awaited<ReturnType<typeof assertProductAccountAuth>>, { ok: false }>;
  accountId: string;
  minRole?: MemberRole;
}): Promise<UploadTierResolutionResult> {
  const { env, auth, accountId, minRole = 'editor' } = args;
  const capsule = auth.principal.accountAuthz;
  if (capsule.accountId !== accountId || roleRank(capsule.role) < roleRank(minRole)) {
    return { ok: false, response: json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 }) };
  }
  return { ok: true, accountAuthz: capsule };
}

async function authorizeAccountAssetAccess(args: {
  req: Request;
  env: Env;
  accountId: string;
  minRole: MemberRole;
}): Promise<Response | null> {
  const internalServiceId = String(args.req.headers.get(INTERNAL_SERVICE_HEADER) || '')
    .trim()
    .toLowerCase();
  if (internalServiceId === TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL) {
    return requireDevAuth(args.req, args.env, {
      allowTrustedInternalServices: [TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL],
    });
  }
  const auth = await assertProductAccountAuth(args.req, args.env);
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

async function enforceAccountStorageLimit(args: {
  env: Env;
  accountId: string;
  storageBytesMax: number | null;
  bodyBytes: number;
}): Promise<UploadStorageResult> {
  const { env, accountId, storageBytesMax, bodyBytes } = args;
  try {
    const currentStoredBytes = await loadAccountStoredBytesUsage(env, accountId);
    const nextStoredBytes = currentStoredBytes + bodyBytes;
    if (storageBytesMax != null && nextStoredBytes > storageBytesMax) {
      return {
        ok: false,
        response: denyEntitlement('coreui.upsell.reason.budgetExceeded', `${STORAGE_BYTES_BUDGET_KEY}=${storageBytesMax}`, 403),
      };
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

async function mirrorAccountStorageUsage(
  env: Env,
  accountId: string,
  manifests?: AccountAssetManifest[],
): Promise<void> {
  try {
    await syncAccountStoredBytesUsage(env, accountId, manifests);
  } catch (error) {
    // Asset manifests remain the source of truth, but the mirror failure must be explicit.
    console.warn('[tokyo] account storage usage mirror degraded', {
      accountId,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function resolveAccountAssetNamespacePrefix(accountId: string): string {
  return `${ACCOUNT_ASSET_NAMESPACE_PREFIX}${accountId}/`;
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
    assetId: manifest.assetId,
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
  const accountId = (req.headers.get('x-account-id') || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const authErr = await authorizeAccountAssetAccess({
    req,
    env,
    accountId,
    minRole: 'editor',
  });
  if (authErr) return authErr;

  const auth = await assertProductAccountAuth(req, env);

  const legacyVariant = (req.headers.get('x-variant') || '').trim();
  if (legacyVariant) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.variantUnsupported' } }, { status: 422 });
  }

  const source = normalizeAccountAssetSource(req.headers.get('x-source'));
  if (!source) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.source.invalid' } }, { status: 422 });
  }

  let accountAuthz: RomaAccountAuthzCapsulePayload | null = null;
  if (auth.ok) {
    const tierResolution = await resolveUploadTierAndAuthorization({
      env,
      auth,
      accountId,
    });
    if (!tierResolution.ok) return tierResolution.response;
    accountAuthz = tierResolution.accountAuthz;
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

  const filenameRaw = (req.headers.get('x-filename') || '').trim() || 'upload.bin';
  const filenameValidation = validateUploadFilename(filenameRaw);
  if (!filenameValidation.ok) {
    return json(
      {
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.filename.invalid',
          detail: filenameValidation.detail,
        },
      },
      { status: 422 },
    );
  }
  const filename = filenameValidation.filename;
  const contentType = (req.headers.get('content-type') || '').trim() || 'application/octet-stream';
  const ext = pickExtension(filename, contentType);
  const assetType = classifyAccountAssetType(contentType, ext);

  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 });
  }
  if (accountAuthz && accountAuthz.accountStatus !== 'active') {
    return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.account.disabled' } }, { status: 403 });
  }
  const policy = accountAuthz
    ? resolvePolicyFromEntitlementsSnapshot({
        profile: accountAuthz.profile,
        role: accountAuthz.role,
        entitlements: accountAuthz.entitlements ?? null,
      })
    : null;
  const uploadSizeCap = policy ? policy.caps[UPLOAD_SIZE_CAP_KEY] : null;
  const maxBytes =
    uploadSizeCap === null || (typeof uploadSizeCap === 'number' && Number.isFinite(uploadSizeCap) && uploadSizeCap > 0)
      ? uploadSizeCap
      : null;
  const storageBudget = policy ? policy.budgets[STORAGE_BYTES_BUDGET_KEY]?.max ?? null : null;
  const storageBytesMax =
    storageBudget === null || (typeof storageBudget === 'number' && Number.isFinite(storageBudget) && storageBudget >= 0)
      ? storageBudget
      : null;
  if (maxBytes != null && body.byteLength > maxBytes) {
    return denyEntitlement('coreui.upsell.reason.capReached', `${UPLOAD_SIZE_CAP_KEY}=${maxBytes}`, 413);
  }

  const budgetResult = await enforceAccountStorageLimit({
    env,
    accountId,
    storageBytesMax,
    bodyBytes: body.byteLength,
  });
  if (!budgetResult.ok) return budgetResult.response;

  const assetId = crypto.randomUUID();
  const key = buildAccountAssetKey(accountId, assetId, filename);
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
      normalizedFilename: filename,
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

  await mirrorAccountStorageUsage(env, accountId);

  const origin = new URL(req.url).origin;
  const url = `${origin}${buildAccountAssetVersionPath(key)}`;
  return json(
    {
      assetId,
      assetRef: key,
      filename,
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
  const authErr = await authorizeAccountAssetAccess({
    req,
    env,
    accountId,
    minRole: 'viewer',
  });
  if (authErr) return authErr;
  const origin = new URL(req.url).origin;
  const manifests = await listAccountAssetManifestsByAccount(env, accountId);
  manifests.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const storageBytesUsed = sumAccountAssetManifestSizeBytes(manifests);
  await mirrorAccountStorageUsage(env, accountId, manifests);
  return json({
    accountId,
    storageBytesUsed,
    assets: manifests.map((manifest) => serializeAccountAssetManifest(manifest, origin)),
  });
}

async function handleResolveAccountAssetMetadata(
  req: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const authErr = await authorizeAccountAssetAccess({
    req,
    env,
    accountId,
    minRole: 'viewer',
  });
  if (authErr) return authErr;

  const body = (await req.json().catch(() => null)) as { assetIds?: unknown } | null;
  const rawAssetIds = Array.isArray(body?.assetIds) ? body.assetIds : null;
  if (!rawAssetIds) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.resolve.invalidPayload' } },
      { status: 422 },
    );
  }

  const seen = new Set<string>();
  const assetIds = rawAssetIds
    .map((entry) => String(entry || '').trim())
    .filter((assetId) => {
      if (!assetId || !isUuid(assetId) || seen.has(assetId)) return false;
      seen.add(assetId);
      return true;
    });

  if (assetIds.length !== rawAssetIds.length) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.resolve.invalidAssetIds' } },
      { status: 422 },
    );
  }

  const origin = new URL(req.url).origin;
  const resolvedEntries = await Promise.all(
    assetIds.map(async (assetId) => ({
      assetId,
      manifest: await loadAccountAssetManifestByIdentity(env, accountId, assetId),
    })),
  );

  const assets: Record<string, unknown>[] = [];
  const missingAssetIds: string[] = [];

  for (const entry of resolvedEntries) {
    if (!entry.manifest) {
      missingAssetIds.push(entry.assetId);
      continue;
    }
    assets.push(serializeAccountAssetManifest(entry.manifest, origin));
  }

  return json({
    accountId,
    assets,
    missingAssetIds,
  });
}

async function handleGetAccountAssetIdentityIntegrity(
  req: Request,
  env: Env,
  accountIdRaw: string,
  assetIdRaw: string,
): Promise<Response> {
  const authErr = requireDevAuth(req, env, {
    allowTrustedInternalServices: [TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL],
  });
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
  const authErr = requireDevAuth(req, env, {
    allowTrustedInternalServices: [TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL],
  });
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
  const authErr = await authorizeAccountAssetAccess({
    req,
    env,
    accountId,
    minRole: 'editor',
  });
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

  await mirrorAccountStorageUsage(env, accountId);

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
  handleListAccountAssetMetadata,
  handleResolveAccountAssetMetadata,
  handleGetAccountAssetMirrorIntegrity,
  handleUploadAccountAsset,
};
