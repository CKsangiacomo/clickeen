import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  buildAccountAssetKey,
  buildAccountAssetPublicPath,
  classifyAccountAssetType,
  guessContentTypeFromExt,
  pickExtension,
  validateUploadFilename,
} from '../asset-utils';
import { json } from '../http';
import {
  assertRomaAccountCapsuleAuth,
  INTERNAL_SERVICE_HEADER,
  requireDevAuth,
  TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL,
  TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
} from '../auth';
import type { Env } from '../types';
import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import {
  type AccountAssetFile,
  type MemberRole,
  deleteAccountAssetByRef,
  listAccountAssetFilesByAccount,
  loadAccountAssetByRef,
  loadAccountStoredBytesUsage,
  normalizeAccountAssetSource,
  roleRank,
  sumAccountAssetFileSizeBytes,
} from './assets';

type AccountAssetAuthorizationResult =
  | { ok: true; accountAuthz: RomaAccountAuthzCapsulePayload | null }
  | { ok: false; response: Response };

const SCRIPTABLE_OR_EXECUTABLE_EXTENSIONS = new Set([
  'html',
  'htm',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'svg',
  'xml',
  'xhtml',
  'wasm',
  'sh',
  'bat',
  'cmd',
  'exe',
  'dmg',
  'pkg',
]);

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];
const ALLOWED_EXACT_MIME_TYPES = new Set(['application/pdf']);

async function resolveAccountAssetAuthorization(args: {
  req: Request;
  env: Env;
  accountId: string;
  minRole: MemberRole;
}): Promise<AccountAssetAuthorizationResult> {
  const internalServiceId = String(args.req.headers.get(INTERNAL_SERVICE_HEADER) || '')
    .trim()
    .toLowerCase();
  if (internalServiceId === TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL) {
    const authErr = requireDevAuth(args.req, args.env, {
      allowTrustedInternalServices: [TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL],
    });
    return authErr ? { ok: false, response: authErr } : { ok: true, accountAuthz: null };
  }

  const auth = await assertRomaAccountCapsuleAuth(args.req, args.env, {
    requiredInternalServiceId: TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
  });
  if (!auth.ok) return { ok: false, response: auth.response };

  const capsule = auth.principal.accountAuthz;
  if (capsule.accountPublicId !== args.accountId || roleRank(capsule.role) < roleRank(args.minRole)) {
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
  const authorized = await resolveAccountAssetAuthorization(args);
  return authorized.ok ? null : authorized.response;
}

function resolveTokyoAssetPublicBaseUrl(env: Env, req: Request): string {
  const configured =
    typeof env.TOKYO_PUBLIC_BASE_URL === 'string' ? env.TOKYO_PUBLIC_BASE_URL.trim() : '';
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(req.url).origin.replace(/\/+$/, '');
}

function normalizeAssetRef(raw: unknown): string | null {
  const value = String(raw || '').trim().replace(/^\/+/, '');
  if (!value || value.length > 240) return null;
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  if (segments.some((segment) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(segment))) return null;
  return segments.join('/');
}

function assertAcceptedUpload(args: {
  filename: string;
  contentType: string;
}): { ok: true } | { ok: false; reasonKey: string; detail: string } {
  const ext = (args.filename.split('.').pop() || '').trim().toLowerCase();
  if (!ext || SCRIPTABLE_OR_EXECUTABLE_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      reasonKey: 'coreui.errors.assets.typeRejected',
      detail: 'scriptable_or_executable_upload_rejected',
    };
  }
  const mime = args.contentType.split(';')[0]?.trim().toLowerCase() || 'application/octet-stream';
  const allowedMime = ALLOWED_EXACT_MIME_TYPES.has(mime) || ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
  if (!allowedMime) {
    return {
      ok: false,
      reasonKey: 'coreui.errors.assets.typeRejected',
      detail: `mime_rejected:${mime}`,
    };
  }
  return { ok: true };
}

function serializeAccountAssetRecord(file: AccountAssetFile): Record<string, unknown> {
  return {
    assetRef: file.assetRef,
    assetType: file.assetType,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    filename: file.normalizedFilename,
    createdAt: file.createdAt,
  };
}

function serializeResolvedAccountAsset(
  file: AccountAssetFile,
  origin: string,
): Record<string, unknown> {
  return {
    ...serializeAccountAssetRecord(file),
    url: `${origin}${buildAccountAssetPublicPath(file.key)}`,
  };
}

export async function handleUploadAccountAsset(req: Request, env: Env): Promise<Response> {
  const accountId = (req.headers.get('x-account-id') || '').trim();
  if (!accountId || !isCompactAccountPublicId(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const source = normalizeAccountAssetSource(req.headers.get('x-source'));
  if (!source) return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.source.invalid' } }, { status: 422 });

  const authorized = await resolveAccountAssetAuthorization({ req, env, accountId, minRole: 'editor' });
  if (!authorized.ok) return authorized.response;
  if (authorized.accountAuthz && authorized.accountAuthz.accountStatus !== 'active') {
    return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.account.disabled' } }, { status: 403 });
  }

  const filenameRaw = (req.headers.get('x-filename') || '').trim() || 'upload.bin';
  const filenameValidation = validateUploadFilename(filenameRaw);
  if (!filenameValidation.ok) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.filename.invalid', detail: filenameValidation.detail } }, { status: 422 });
  }
  const filename = filenameValidation.filename;
  const contentType = (req.headers.get('content-type') || '').trim() || 'application/octet-stream';
  const accepted = assertAcceptedUpload({ filename, contentType });
  if (!accepted.ok) {
    return json({ error: { kind: 'VALIDATION', reasonKey: accepted.reasonKey, detail: accepted.detail } }, { status: 422 });
  }

  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 });
  }

  const assetRef = filename;
  const key = buildAccountAssetKey(accountId, assetRef);
  const existing = await loadAccountAssetByRef(env, accountId, assetRef);
  await env.TOKYO_R2.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: {
      filename,
      originalFilename: filenameRaw,
      source,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      sizeBytes: String(body.byteLength),
    },
  });

  return json(
    {
      assetRef,
      filename,
      assetType: classifyAccountAssetType(contentType, pickExtension(filename, contentType)),
      contentType,
      sizeBytes: body.byteLength,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    },
    { status: 200 },
  );
}

function respondAccountAsset(
  key: string,
  obj: { body: ReadableStream | null; httpMetadata?: { contentType?: string | null } | null },
): Response {
  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  headers.set('cdn-cache-control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  headers.set('cloudflare-cdn-cache-control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  return new Response(obj.body, { status: 200, headers });
}

export async function handleGetAccountAsset(env: Env, key: string): Promise<Response> {
  const normalized = key.startsWith('/') ? key : `/${key}`;
  const parsed = normalized.match(/^\/?accounts\/([0-9A-Z]{8})\/assets\/(.+)$/)
    ? { key: normalized.replace(/^\/+/, '') }
    : null;
  const directKey = parsed?.key ?? null;
  if (!directKey) return new Response('Not found', { status: 404 });
  const obj = await env.TOKYO_R2.get(directKey);
  return obj ? respondAccountAsset(directKey, obj) : new Response('Not found', { status: 404 });
}

export async function handleListAccountAssetMetadata(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isCompactAccountPublicId(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const authErr = await authorizeAccountAssetAccess({ req, env, accountId, minRole: 'viewer' });
  if (authErr) return authErr;
  const files = await listAccountAssetFilesByAccount(env, accountId);
  files.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return json({
    accountId,
    storageBytesUsed: sumAccountAssetFileSizeBytes(files),
    assets: files.map((file) => serializeAccountAssetRecord(file)),
  });
}

export async function handleGetAccountAssetUsage(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isCompactAccountPublicId(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const authErr = await authorizeAccountAssetAccess({ req, env, accountId, minRole: 'viewer' });
  if (authErr) return authErr;
  return json({ accountId, storageBytesUsed: await loadAccountStoredBytesUsage(env, accountId) });
}

export async function handleResolveAccountAssetMetadata(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isCompactAccountPublicId(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const authErr = await authorizeAccountAssetAccess({ req, env, accountId, minRole: 'viewer' });
  if (authErr) return authErr;
  const body = (await req.json().catch(() => null)) as { assetRefs?: unknown } | null;
  const rawAssetRefs = Array.isArray(body?.assetRefs) ? body.assetRefs : null;
  if (!rawAssetRefs) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.resolve.invalidPayload' } }, { status: 422 });
  }
  const seen = new Set<string>();
  const assetRefs = rawAssetRefs
    .map((entry) => normalizeAssetRef(entry))
    .filter((assetRef): assetRef is string => {
      if (!assetRef || seen.has(assetRef)) return false;
      seen.add(assetRef);
      return true;
    });
  if (assetRefs.length !== rawAssetRefs.length) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.resolve.invalidAssetRefs' } }, { status: 422 });
  }

  const publicBaseUrl = resolveTokyoAssetPublicBaseUrl(env, req);
  const resolved = await Promise.all(
    assetRefs.map(async (assetRef) => ({ assetRef, file: await loadAccountAssetByRef(env, accountId, assetRef) })),
  );
  return json({
    accountId,
    assets: resolved.filter((entry) => entry.file).map((entry) => serializeResolvedAccountAsset(entry.file!, publicBaseUrl)),
    missingAssetRefs: resolved.filter((entry) => !entry.file).map((entry) => entry.assetRef),
  });
}

export async function handleDeleteAccountAsset(req: Request, env: Env, accountIdRaw: string, assetRefRaw: string): Promise<Response> {
  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isCompactAccountPublicId(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const authErr = await authorizeAccountAssetAccess({ req, env, accountId, minRole: 'editor' });
  if (authErr) return authErr;
  const assetRef = normalizeAssetRef(assetRefRaw);
  if (!assetRef) return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assetRef.invalid' } }, { status: 422 });
  const existing = await loadAccountAssetByRef(env, accountId, assetRef);
  if (!existing) return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' } }, { status: 404 });
  await deleteAccountAssetByRef(env, accountId, assetRef);
  return json({ accountId, assetRef, deleted: true }, { status: 200 });
}
