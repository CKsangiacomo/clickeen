import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import { parseAccountAssetKey } from '@clickeen/ck-contracts';
import {
  buildAccountAssetKey,
  buildAccountAssetPublicPath,
  classifyAccountAssetType,
  pickExtension,
  validateUploadFilename,
} from '../asset-utils';
import { json } from '../http';
import {
  assertRomaAccountCapsuleAuth,
  TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
} from '../auth';
import type { Env } from '../types';
import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import {
  AccountAssetKeyError,
  AccountAssetMetadataError,
  type AccountAssetFile,
  type MemberRole,
  deleteAccountAssetByRef,
  directAccountAssetRefFromKey,
  isAccountAssetSource,
  listAccountAssetFilesByAccount,
  loadAccountAssetByRef,
  loadAccountStoredBytesUsage,
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

function isAssetRef(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !raw || raw.length > 240) return false;
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return false;
  const segments = raw.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return false;
  return !segments.some((segment) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(segment));
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
  const mime = args.contentType.split(';')[0]?.trim().toLowerCase();
  if (!mime) {
    return {
      ok: false,
      reasonKey: 'coreui.errors.assets.typeRejected',
      detail: 'mime_missing',
    };
  }
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

function isSvgUpload(args: { filename: string; contentType: string }): boolean {
  const ext = (args.filename.split('.').pop() || '').trim().toLowerCase();
  const mime = args.contentType.split(';')[0]?.trim().toLowerCase();
  return ext === 'svg' || mime === 'image/svg+xml';
}

function assertSafeSvgUpload(body: ArrayBuffer): { ok: true } | { ok: false; detail: string } {
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return { ok: false, detail: 'svg_utf8_invalid' };
  }
  const source = text.toLowerCase();
  if (!source.includes('<svg')) return { ok: false, detail: 'svg_root_missing' };
  if (/<script[\s>]/i.test(text)) return { ok: false, detail: 'svg_script_rejected' };
  if (/<foreignobject[\s>]/i.test(text)) return { ok: false, detail: 'svg_foreign_object_rejected' };
  if (/\son[a-z]+\s*=/i.test(text)) return { ok: false, detail: 'svg_event_handler_rejected' };
  if (/(?:href|xlink:href)\s*=\s*["']?\s*javascript:/i.test(text)) return { ok: false, detail: 'svg_javascript_href_rejected' };
  if (/data:text\/html/i.test(text)) return { ok: false, detail: 'svg_html_data_url_rejected' };
  return { ok: true };
}

function readLimitHeader(req: Request, name: string): number | null {
  const raw = req.headers.get(name);
  if (!raw) {
    throw new Error(`${name}_missing`);
  }
  if (raw === 'unlimited') return null;
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error(`${name}_invalid`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name}_invalid`);
  }
  return value;
}

function assetLimitResponse(detail: string): Response {
  return json(
    {
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.upsell.reason.limitReached',
        detail,
      },
    },
    { status: 403 },
  );
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
    assetRef: file.assetRef,
    url: `${origin}${buildAccountAssetPublicPath(file.key)}`,
  };
}

function accountAssetMetadataInvalidResponse(error: AccountAssetMetadataError): Response {
  return json(
    {
      error: {
        kind: 'VALIDATION',
        reasonKey: error.reasonKey,
        detail: error.key,
      },
    },
    { status: 422 },
  );
}

function accountAssetKeyInvalidResponse(error: AccountAssetKeyError): Response {
  return json(
    {
      error: {
        kind: 'VALIDATION',
        reasonKey: error.reasonKey,
        detail: error.key,
      },
    },
    { status: 422 },
  );
}

export async function handleUploadAccountAsset(req: Request, env: Env): Promise<Response> {
  const accountId = (req.headers.get('x-account-id') || '').trim();
  if (!accountId || !isCompactAccountPublicId(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const source = req.headers.get('x-source');
  if (!source) return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.source.invalid' } }, { status: 422 });
  if (!isAccountAssetSource(source)) return json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.source.invalid' } }, { status: 422 });

  const authorized = await resolveAccountAssetAuthorization({ req, env, accountId, minRole: 'editor' });
  if (!authorized.ok) return authorized.response;
  if (authorized.accountAuthz && authorized.accountAuthz.accountStatus !== 'active') {
    return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.account.disabled' } }, { status: 403 });
  }

  const filenameValidation = validateUploadFilename(req.headers.get('x-filename'));
  if (!filenameValidation.ok) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.filename.invalid', detail: filenameValidation.detail } }, { status: 422 });
  }
  const filename = filenameValidation.filename;
  const contentType = req.headers.get('content-type');
  if (!contentType || contentType.trim() !== contentType) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } }, { status: 422 });
  }
  const accepted = assertAcceptedUpload({ filename, contentType });
  if (!accepted.ok) {
    return json({ error: { kind: 'VALIDATION', reasonKey: accepted.reasonKey, detail: accepted.detail } }, { status: 422 });
  }

  const body = await req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' } }, { status: 422 });
  }
  if (isSvgUpload({ filename, contentType })) {
    const safeSvg = assertSafeSvgUpload(body);
    if (!safeSvg.ok) {
      return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.typeRejected', detail: safeSvg.detail } }, { status: 422 });
    }
  }

  let uploadSizeLimit: number | null = null;
  let storageLimit: number | null = null;
  try {
    uploadSizeLimit = readLimitHeader(req, 'x-upload-size-max');
    storageLimit = readLimitHeader(req, 'x-storage-bytes-max');
  } catch (error) {
    return json(
      {
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          detail: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 422 },
    );
  }
  if (uploadSizeLimit !== null && body.byteLength > uploadSizeLimit) {
    return assetLimitResponse('uploads.size.max');
  }

  const assetRef = filename;
  const key = buildAccountAssetKey(accountId, assetRef);
  const existing = await loadAccountAssetByRef(env, accountId, assetRef).catch((error) => {
    if (error instanceof AccountAssetMetadataError) return error;
    if (error instanceof AccountAssetKeyError) return error;
    throw error;
  });
  if (existing instanceof AccountAssetMetadataError) return accountAssetMetadataInvalidResponse(existing);
  if (existing instanceof AccountAssetKeyError) return accountAssetKeyInvalidResponse(existing);
  if (storageLimit !== null) {
    const currentBytes = await loadAccountStoredBytesUsage(env, accountId).catch((error) => {
      if (error instanceof AccountAssetMetadataError) return error;
      if (error instanceof AccountAssetKeyError) return error;
      throw error;
    });
    if (currentBytes instanceof AccountAssetMetadataError) return accountAssetMetadataInvalidResponse(currentBytes);
    if (currentBytes instanceof AccountAssetKeyError) return accountAssetKeyInvalidResponse(currentBytes);
    const replacedBytes = existing?.sizeBytes ?? 0;
    if (currentBytes - replacedBytes + body.byteLength > storageLimit) {
      return assetLimitResponse('storage.bytes.max');
    }
  }
  const createdAt = existing?.createdAt ?? new Date().toISOString();
  await env.TOKYO_R2.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: {
      filename,
      originalFilename: filename,
      source,
      createdAt,
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
      createdAt,
    },
    { status: 200 },
  );
}

async function respondAccountAsset(env: Env, key: string, obj: { body: ReadableStream | null; httpMetadata?: { contentType?: string | null } | null }): Promise<Response> {
  const parsed = parseAccountAssetKey(key);
  if (!parsed) return new Response('Not found', { status: 404 });
  const file = await loadAccountAssetByRef(env, parsed.accountId, parsed.assetRef).catch((error) => {
    if (error instanceof AccountAssetMetadataError) return error;
    if (error instanceof AccountAssetKeyError) return error;
    throw error;
  });
  if (file instanceof AccountAssetMetadataError) return accountAssetMetadataInvalidResponse(file);
  if (file instanceof AccountAssetKeyError) return accountAssetKeyInvalidResponse(file);
  if (!file) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  headers.set('content-type', file.contentType);
  headers.set('cache-control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  headers.set('cdn-cache-control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  headers.set('cloudflare-cdn-cache-control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  return new Response(obj.body, { status: 200, headers });
}

export async function handleGetAccountAsset(env: Env, key: string): Promise<Response> {
  const normalized = key.startsWith('/') ? key : `/${key}`;
  const directKey = normalized.match(/^\/?accounts\/([0-9A-Z]{8})\/assets\/(.+)$/)
    ? normalized.replace(/^\/+/, '')
    : null;
  if (!directKey) return new Response('Not found', { status: 404 });
  const parsed = parseAccountAssetKey(directKey);
  if (!parsed) return new Response('Not found', { status: 404 });
  if (!directAccountAssetRefFromKey(parsed.accountId, directKey)) {
    return accountAssetKeyInvalidResponse(new AccountAssetKeyError(directKey));
  }
  const obj = await env.TOKYO_R2.get(directKey);
  return obj ? respondAccountAsset(env, directKey, obj) : new Response('Not found', { status: 404 });
}

export async function handleListAccountAssetMetadata(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isCompactAccountPublicId(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const authErr = await authorizeAccountAssetAccess({ req, env, accountId, minRole: 'viewer' });
  if (authErr) return authErr;
  const files = await listAccountAssetFilesByAccount(env, accountId).catch((error) => {
    if (error instanceof AccountAssetMetadataError) return error;
    if (error instanceof AccountAssetKeyError) return error;
    throw error;
  });
  if (files instanceof AccountAssetMetadataError) return accountAssetMetadataInvalidResponse(files);
  if (files instanceof AccountAssetKeyError) return accountAssetKeyInvalidResponse(files);
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
  const storageBytesUsed = await loadAccountStoredBytesUsage(env, accountId).catch((error) => {
    if (error instanceof AccountAssetMetadataError) return error;
    if (error instanceof AccountAssetKeyError) return error;
    throw error;
  });
  if (storageBytesUsed instanceof AccountAssetMetadataError) return accountAssetMetadataInvalidResponse(storageBytesUsed);
  if (storageBytesUsed instanceof AccountAssetKeyError) return accountAssetKeyInvalidResponse(storageBytesUsed);
  return json({ accountId, storageBytesUsed });
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
  if (rawAssetRefs.some((assetRef) => !isAssetRef(assetRef))) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.resolve.invalidAssetRefs' } }, { status: 422 });
  }
  if (new Set(rawAssetRefs).size !== rawAssetRefs.length) return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.resolve.invalidAssetRefs' } }, { status: 422 });
  const assetRefs = rawAssetRefs as string[];

  const publicBaseUrl = resolveTokyoAssetPublicBaseUrl(env, req);
  const resolved = await Promise.all(
    assetRefs.map(async (assetRef) => ({ assetRef, file: await loadAccountAssetByRef(env, accountId, assetRef) })),
  ).catch((error) => {
    if (error instanceof AccountAssetMetadataError) return error;
    if (error instanceof AccountAssetKeyError) return error;
    throw error;
  });
  if (resolved instanceof AccountAssetMetadataError) return accountAssetMetadataInvalidResponse(resolved);
  if (resolved instanceof AccountAssetKeyError) return accountAssetKeyInvalidResponse(resolved);
  const missing = resolved.filter((entry) => !entry.file).map((entry) => entry.assetRef);
  if (missing.length) return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.resolve.missing', detail: missing.join(', ') } }, { status: 422 });
  return json({
    assets: resolved.map((entry) => serializeResolvedAccountAsset(entry.file!, publicBaseUrl)),
  });
}

export async function handleDeleteAccountAsset(req: Request, env: Env, accountIdRaw: string, assetRefRaw: string): Promise<Response> {
  const accountId = String(accountIdRaw || '').trim();
  if (!accountId || !isCompactAccountPublicId(accountId)) {
    return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 });
  }
  const authErr = await authorizeAccountAssetAccess({ req, env, accountId, minRole: 'editor' });
  if (authErr) return authErr;
  if (!isAssetRef(assetRefRaw)) return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assetRef.invalid' } }, { status: 422 });
  const assetRef = assetRefRaw;
  const existing = await loadAccountAssetByRef(env, accountId, assetRef).catch((error) => {
    if (error instanceof AccountAssetMetadataError) return error;
    if (error instanceof AccountAssetKeyError) return error;
    throw error;
  });
  if (existing instanceof AccountAssetMetadataError) return accountAssetMetadataInvalidResponse(existing);
  if (existing instanceof AccountAssetKeyError) return accountAssetKeyInvalidResponse(existing);
  if (!existing) return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.asset.notFound' } }, { status: 404 });
  await deleteAccountAssetByRef(env, accountId, assetRef);
  return json({ accountId, assetRef, deleted: true }, { status: 200 });
}
