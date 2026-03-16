import { isUuid, parseCanonicalAssetRef } from '@clickeen/ck-contracts';
import {
  handleDeleteAccountAsset,
  handleGetAccountAsset,
  handleGetAccountAssetIdentityIntegrity,
  handleGetAccountAssetMirrorIntegrity,
  handleListAccountAssetMetadata,
  handleUploadAccountAsset,
  roleRank,
  type MemberRole,
} from './domains/assets';
import { handleGetL10nAsset } from './domains/l10n-read';
import {
  handleDeleteL10nOverlay,
  handleUpsertL10nOverlay,
  handleWriteL10nBaseSnapshot,
} from './domains/l10n-authoring';
import {
  deleteInstanceMirror,
  deleteSavedRenderConfig,
  enforceLiveSurface,
  handleGetR2Object,
  isTokyoMirrorJob,
  readSavedRenderConfig,
  renderConfigPackKey,
  renderLivePointerKey,
  renderMetaLivePointerKey,
  renderMetaPackKey,
  syncLiveSurface,
  updateSavedRenderPointerMetadata,
  writeSavedRenderConfig,
  writeConfigPack,
  writeMetaPack,
  writeTextPack,
  type TokyoMirrorQueueJob,
} from './domains/render';
import {
  assertUploadAuth,
  requireDevAuth,
  TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL,
  TOKYO_INTERNAL_SERVICE_SANFRANCISCO_L10N,
} from './auth';
import {
  guessContentTypeFromExt,
  handleGetTokyoFontAsset,
  normalizeLocale,
  normalizePublicId,
  normalizeSha256Hex,
  prettyStableJson,
  sha256Hex,
} from './asset-utils';
import { json } from './http';
import type { Env } from './types';

export type { Env } from './types';
export { json } from './http';
export {
  assertUploadAuth,
  requireDevAuth,
  TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL,
} from './auth';
export {
  resolveL10nHttpBase,
  buildL10nBridgeHeaders,
  supabaseFetch,
} from './supabase';
export {
  classifyAccountAssetType,
  type AccountAssetType,
  pickExtension,
  validateUploadFilename,
  buildAccountAssetKey,
  normalizeAccountAssetReadKey,
  buildAccountAssetVersionPath,
  parseAccountAssetIdentityFromKey,
  guessContentTypeFromExt,
  normalizePublicId,
  normalizeWidgetType,
  normalizeLocale,
  normalizeSha256Hex,
  prettyStableJson,
  sha256Hex,
} from './asset-utils';

async function authorizeAccountScopedRequest(args: {
  req: Request;
  env: Env;
  accountId: string;
  minRole: MemberRole;
}): Promise<Response | null> {
  const auth = await assertUploadAuth(args.req, args.env);
  if (!auth.ok) return auth.response;
  const capsule = auth.principal.accountAuthz;
  if (!capsule) {
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.auth.contextUnavailable',
          detail: 'account_authz_capsule_missing',
        },
      },
      { status: 500 },
    );
  }
  if (capsule.accountId !== args.accountId) {
    return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 });
  }
  if (roleRank(capsule.role) < roleRank(args.minRole)) {
    return json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 });
  }
  return null;
}

function hasTrustedInternalService(req: Request, serviceId: string): boolean {
  const raw = req.headers.get('x-ck-internal-service');
  if (typeof raw !== 'string') return false;
  return raw.trim().toLowerCase() === serviceId;
}

async function authorizeSavedRenderRequest(args: {
  req: Request;
  env: Env;
  accountId: string;
  minRole: MemberRole;
}): Promise<Response | null> {
  if (hasTrustedInternalService(args.req, TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL)) {
    return requireDevAuth(args.req, args.env, {
      allowTrustedInternalServices: [TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL],
    });
  }
  return authorizeAccountScopedRequest(args);
}

async function authorizeL10nAuthoringRequest(args: {
  req: Request;
  env: Env;
  accountId: string;
}): Promise<Response | null> {
  if (hasTrustedInternalService(args.req, TOKYO_INTERNAL_SERVICE_SANFRANCISCO_L10N)) {
    return requireDevAuth(args.req, args.env, {
      allowTrustedInternalServices: [TOKYO_INTERNAL_SERVICE_SANFRANCISCO_L10N],
    });
  }
  return authorizeAccountScopedRequest({
    req: args.req,
    env: args.env,
    accountId: args.accountId,
    minRole: 'editor',
  });
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set(
    'access-control-allow-headers',
    'authorization, content-type, x-account-id, x-filename, x-public-id, x-widget-type, x-source, idempotency-key, x-tokyo-l10n-bridge, x-ck-internal-service',
  );
  return new Response(res.body, { status: res.status, headers });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function sha256StableJson(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(prettyStableJson(value));
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return await sha256Hex(arrayBuffer);
}
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (req.method === 'OPTIONS') {
        return withCors(new Response(null, { status: 204 }));
      }

      if (pathname === '/healthz') {
        return withCors(json({ up: true }, { status: 200 }));
      }

      const renderLivePointerMatch = pathname.match(
        /^\/renders\/instances\/([^/]+)\/live\/r\.json$/,
      );
      if (renderLivePointerMatch) {
        const publicId = normalizePublicId(decodeURIComponent(renderLivePointerMatch[1]));
        if (!publicId) {
          return withCors(
            json(
              { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalidPublicId' } },
              { status: 422 },
            ),
          );
        }

        if (req.method === 'GET') {
          return withCors(await handleGetR2Object(env, renderLivePointerKey(publicId), 'no-store'));
        }

        if (req.method === 'POST') {
          const accountId = String(
            url.searchParams.get('accountId') || req.headers.get('x-account-id') || '',
          ).trim();
          if (!isUuid(accountId)) {
            return withCors(
              json(
                { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
                { status: 422 },
              ),
            );
          }
          const authErr = await authorizeAccountScopedRequest({
            req,
            env,
            accountId,
            minRole: 'editor',
          });
          if (authErr) return withCors(authErr);

          const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
          const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
          const configFp = normalizeSha256Hex(body?.configFp);
          const localePolicy = body?.localePolicy;
          if (!widgetType || !configFp || !isRecord(localePolicy)) {
            return withCors(
              json(
                { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
                { status: 422 },
              ),
            );
          }

          await syncLiveSurface(env, {
            v: 1,
            kind: 'sync-live-surface',
            publicId,
            live: true,
            widgetType,
            configFp,
            localePolicy: localePolicy as any,
            seoGeo: body?.seoGeo === true,
          });

          return withCors(
            json({
              ok: true,
              publicId,
              live: true,
              configFp,
            }),
          );
        }

        return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
      }

      const renderLiveSurfaceMatch = pathname.match(/^\/renders\/instances\/([^/]+)\/live\.json$/);
      if (renderLiveSurfaceMatch) {
        const publicId = normalizePublicId(decodeURIComponent(renderLiveSurfaceMatch[1]));
        const accountId = String(
          url.searchParams.get('accountId') || req.headers.get('x-account-id') || '',
        ).trim();
        if (!publicId || !isUuid(accountId)) {
          return withCors(
            json(
              { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
              { status: 422 },
            ),
          );
        }

        if (req.method === 'DELETE') {
          const authErr = await authorizeAccountScopedRequest({
            req,
            env,
            accountId,
            minRole: 'editor',
          });
          if (authErr) return withCors(authErr);
          await syncLiveSurface(env, { v: 1, kind: 'sync-live-surface', publicId, live: false });
          return withCors(json({ ok: true, publicId, live: false }));
        }

        return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
      }

      const renderSavedMatch = pathname.match(/^\/renders\/instances\/([^/]+)\/saved\.json$/);
      if (renderSavedMatch) {
        const publicId = normalizePublicId(decodeURIComponent(renderSavedMatch[1]));
        const accountId = String(
          url.searchParams.get('accountId') || req.headers.get('x-account-id') || '',
        ).trim();
        if (!publicId || !isUuid(accountId)) {
          return withCors(
            json(
              { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
              { status: 422 },
            ),
          );
        }

        if (req.method === 'GET') {
          const authErr = await authorizeSavedRenderRequest({
            req,
            env,
            accountId,
            minRole: 'viewer',
          });
          if (authErr) return withCors(authErr);
          const saved = await readSavedRenderConfig({ env, publicId, accountId });
          if (!saved) {
            return withCors(
              json(
                { error: { kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' } },
                { status: 404 },
              ),
            );
          }
          return withCors(
            json({
              ...saved.pointer,
              config: saved.config,
            }),
          );
        }

        if (req.method === 'PUT') {
          const authErr = await authorizeSavedRenderRequest({
            req,
            env,
            accountId,
            minRole: 'editor',
          });
          if (authErr) return withCors(authErr);
          const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
          const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
          const displayName =
            body?.displayName === undefined
              ? undefined
              : typeof body.displayName === 'string'
                ? body.displayName.trim() || null
                : null;
          const source =
            body?.source === 'curated'
              ? 'curated'
              : body?.source === 'account'
                ? 'account'
                : undefined;
          const meta =
            body?.meta === undefined
              ? undefined
              : body?.meta === null
                ? null
                : body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
                  ? (body.meta as Record<string, unknown>)
                  : null;
          const config =
            body?.config && typeof body.config === 'object' && !Array.isArray(body.config)
              ? (body.config as Record<string, unknown>)
              : null;
          if (!widgetType || !config) {
            return withCors(
              json(
                { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
                { status: 422 },
              ),
            );
          }
          const pointer = await writeSavedRenderConfig({
            env,
            publicId,
            accountId,
            widgetType,
            config,
            displayName,
            source,
            meta,
          });
          return withCors(json({ ...pointer, config }));
        }

        if (req.method === 'PATCH') {
          const authErr = await authorizeAccountScopedRequest({
            req,
            env,
            accountId,
            minRole: 'editor',
          });
          if (authErr) return withCors(authErr);
          const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
          const displayName =
            body?.displayName === undefined
              ? undefined
              : typeof body.displayName === 'string'
                ? body.displayName.trim() || null
                : null;
          const source =
            body?.source === 'curated'
              ? 'curated'
              : body?.source === 'account'
                ? 'account'
                : undefined;
          const meta =
            body?.meta === undefined
              ? undefined
              : body?.meta === null
                ? null
                : body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
                  ? (body.meta as Record<string, unknown>)
                  : null;
          if (displayName === undefined && source === undefined && meta === undefined) {
            return withCors(
              json(
                { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
                { status: 422 },
              ),
            );
          }
          const pointer = await updateSavedRenderPointerMetadata({
            env,
            publicId,
            accountId,
            displayName,
            source,
            meta,
          });
          if (!pointer) {
            return withCors(
              json(
                { error: { kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' } },
                { status: 404 },
              ),
            );
          }
          return withCors(json(pointer));
        }

        if (req.method === 'DELETE') {
          const authErr = await authorizeAccountScopedRequest({
            req,
            env,
            accountId,
            minRole: 'editor',
          });
          if (authErr) return withCors(authErr);
          await deleteSavedRenderConfig({ env, publicId, accountId });
          return withCors(json({ ok: true, deleted: true }));
        }

        return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
      }

      const renderMetaLivePointerMatch = pathname.match(
        /^\/renders\/instances\/([^/]+)\/live\/meta\/([^/]+)\.json$/,
      );
      if (renderMetaLivePointerMatch) {
        if (req.method !== 'GET')
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const publicId = normalizePublicId(decodeURIComponent(renderMetaLivePointerMatch[1]));
        const locale = normalizeLocale(decodeURIComponent(renderMetaLivePointerMatch[2]));
        if (!publicId || !locale) {
          return withCors(
            json(
              { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
              { status: 422 },
            ),
          );
        }
        return withCors(
          await handleGetR2Object(env, renderMetaLivePointerKey(publicId, locale), 'no-store'),
        );
      }

      const renderConfigPackWriteMatch = pathname.match(
        /^\/renders\/instances\/([^/]+)\/config-pack$/,
      );
      if (renderConfigPackWriteMatch) {
        const publicId = normalizePublicId(decodeURIComponent(renderConfigPackWriteMatch[1]));
        const accountId = String(
          url.searchParams.get('accountId') || req.headers.get('x-account-id') || '',
        ).trim();
        if (!publicId || !isUuid(accountId)) {
          return withCors(
            json(
              { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
              { status: 422 },
            ),
          );
        }
        if (req.method !== 'POST') {
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        }

        const authErr = await authorizeAccountScopedRequest({
          req,
          env,
          accountId,
          minRole: 'editor',
        });
        if (authErr) return withCors(authErr);

        const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
        const configPack =
          isRecord(body?.configPack) ? (body.configPack as Record<string, unknown>) : null;
        if (!widgetType || !configPack) {
          return withCors(
            json(
              { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
              { status: 422 },
            ),
          );
        }

        const configFp = await sha256StableJson(configPack);
        await writeConfigPack(env, {
          v: 1,
          kind: 'write-config-pack',
          publicId,
          widgetType,
          configFp,
          configPack,
        });

        return withCors(
          json({
            publicId,
            widgetType,
            configFp,
            written: true,
          }),
        );
      }

      const renderConfigPackMatch = pathname.match(
        /^\/renders\/instances\/([^/]+)\/config\/([^/]+)\/config\.json$/,
      );
      if (renderConfigPackMatch) {
        if (req.method !== 'GET')
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const publicId = normalizePublicId(decodeURIComponent(renderConfigPackMatch[1]));
        const configFp = normalizeSha256Hex(decodeURIComponent(renderConfigPackMatch[2]));
        if (!publicId || !configFp) {
          return withCors(
            json(
              { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
              { status: 422 },
            ),
          );
        }
        return withCors(
          await handleGetR2Object(
            env,
            renderConfigPackKey(publicId, configFp),
            'public, max-age=31536000, immutable',
          ),
        );
      }

      const renderMetaPackMatch = pathname.match(
        /^\/renders\/instances\/([^/]+)\/meta\/([^/]+)\/([^/]+)\.json$/,
      );
      if (renderMetaPackMatch) {
        if (req.method !== 'GET')
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const publicId = normalizePublicId(decodeURIComponent(renderMetaPackMatch[1]));
        const locale = normalizeLocale(decodeURIComponent(renderMetaPackMatch[2]));
        const metaFp = normalizeSha256Hex(decodeURIComponent(renderMetaPackMatch[3]));
        if (!publicId || !locale || !metaFp) {
          return withCors(
            json(
              { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
              { status: 422 },
            ),
          );
        }
        return withCors(
          await handleGetR2Object(
            env,
            renderMetaPackKey(publicId, locale, metaFp),
            'public, max-age=31536000, immutable',
          ),
        );
      }

      const legacyRenderSurfaceMatch = pathname.match(
        /^\/renders\/instances\/[^/]+\/(published|revisions|snapshot)(?:\/|$)/,
      );
      if (legacyRenderSurfaceMatch) {
        return withCors(
          json(
            {
              error: {
                kind: 'VALIDATION',
                reasonKey: 'tokyo.errors.render.legacyUnsupported',
                detail:
                  'Legacy render snapshot endpoints are removed. Use /renders/instances/{publicId}/live/r.json + config/text packs.',
              },
            },
            { status: 410 },
          ),
        );
      }

      if (pathname === '/assets/upload') {
        if (req.method !== 'POST')
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handleUploadAccountAsset(req, env));
      }

      const accountAssetsListMatch = pathname.match(/^\/assets\/account\/([0-9a-f-]{36})$/i);
      if (accountAssetsListMatch) {
        const accountId = decodeURIComponent(accountAssetsListMatch[1] || '');
        if (req.method === 'GET') {
          return withCors(await handleListAccountAssetMetadata(req, env, accountId));
        }
        return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
      }

      const accountAssetVersion = parseCanonicalAssetRef(pathname);
      if (accountAssetVersion) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        }
        const response = await handleGetAccountAsset(env, accountAssetVersion.versionKey);
        if (req.method === 'HEAD') {
          return withCors(
            new Response(null, { status: response.status, headers: response.headers }),
          );
        }
        return withCors(response);
      }

      const accountAssetMatch = pathname.match(/^\/assets\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/i);
      if (accountAssetMatch) {
        const accountId = decodeURIComponent(accountAssetMatch[1] || '');
        const assetId = decodeURIComponent(accountAssetMatch[2] || '');
        if (req.method === 'DELETE') {
          return withCors(await handleDeleteAccountAsset(req, env, accountId, assetId));
        }
        return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
      }

      const accountAssetIntegrityMatch = pathname.match(/^\/assets\/integrity\/([0-9a-f-]{36})$/i);
      if (accountAssetIntegrityMatch) {
        const accountId = decodeURIComponent(accountAssetIntegrityMatch[1] || '');
        if (req.method === 'GET') {
          return withCors(await handleGetAccountAssetMirrorIntegrity(req, env, accountId));
        }
        return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
      }

      const accountAssetIdentityIntegrityMatch = pathname.match(
        /^\/assets\/integrity\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/i,
      );
      if (accountAssetIdentityIntegrityMatch) {
        const accountId = decodeURIComponent(accountAssetIdentityIntegrityMatch[1] || '');
        const assetId = decodeURIComponent(accountAssetIdentityIntegrityMatch[2] || '');
        if (req.method === 'GET') {
          return withCors(
            await handleGetAccountAssetIdentityIntegrity(req, env, accountId, assetId),
          );
        }
        return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
      }

      if (pathname.startsWith('/fonts/')) {
        if (req.method !== 'GET')
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        return withCors(await handleGetTokyoFontAsset(env, pathname));
      }

      const l10nVersionedMatch = pathname.match(/^\/l10n\/v\/[^/]+\/(.+)$/);
      if (l10nVersionedMatch) {
        if (req.method !== 'GET')
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const rest = l10nVersionedMatch[1];
        const key = `l10n/${rest}`;
        return withCors(await handleGetL10nAsset(env, key));
      }

      const l10nBaseSnapshotMatch = pathname.match(
        /^\/l10n\/instances\/([^/]+)\/bases\/([^/]+)$/,
      );
      if (l10nBaseSnapshotMatch) {
        if (req.method !== 'POST')
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const publicId = normalizePublicId(decodeURIComponent(l10nBaseSnapshotMatch[1]));
        const baseFingerprint = normalizeSha256Hex(
          decodeURIComponent(l10nBaseSnapshotMatch[2]),
        );
        const accountId = String(
          url.searchParams.get('accountId') || req.headers.get('x-account-id') || '',
        ).trim();
        if (!publicId || !isUuid(accountId) || !baseFingerprint) {
          return withCors(
            json(
              { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } },
              { status: 422 },
            ),
          );
        }
        const authErr = await authorizeL10nAuthoringRequest({ req, env, accountId });
        if (authErr) return withCors(authErr);
        return withCors(await handleWriteL10nBaseSnapshot(req, env, publicId, baseFingerprint));
      }

      const l10nOverlayMatch = pathname.match(
        /^\/l10n\/instances\/([^/]+)\/([^/]+)\/([^/]+)$/,
      );
      if (l10nOverlayMatch) {
        const publicId = normalizePublicId(decodeURIComponent(l10nOverlayMatch[1]));
        const layerRaw = decodeURIComponent(l10nOverlayMatch[2]);
        const layer =
          layerRaw === 'locale' || layerRaw === 'user' ? layerRaw : null;
        const layerKeyRaw = decodeURIComponent(l10nOverlayMatch[3]);
        const layerKey =
          layer === 'locale'
            ? normalizeLocale(layerKeyRaw)
            : normalizeLocale(layerKeyRaw) || (layerKeyRaw === 'global' ? 'global' : null);
        const accountId = String(
          url.searchParams.get('accountId') || req.headers.get('x-account-id') || '',
        ).trim();
        if (!publicId || !isUuid(accountId) || !layer || !layerKey) {
          return withCors(
            json(
              { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } },
              { status: 422 },
            ),
          );
        }
        if (req.method === 'POST') {
          const authErr = await authorizeL10nAuthoringRequest({ req, env, accountId });
          if (authErr) return withCors(authErr);
          return withCors(await handleUpsertL10nOverlay(req, env, publicId, layer, layerKey));
        }
        if (req.method === 'DELETE') {
          const authErr = await authorizeL10nAuthoringRequest({ req, env, accountId });
          if (authErr) return withCors(authErr);
          return withCors(await handleDeleteL10nOverlay(req, env, publicId, layer, layerKey));
        }
      }

      if (pathname.startsWith('/l10n/')) {
        if (req.method !== 'GET')
          return withCors(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
        const key = pathname.replace(/^\//, '');
        return withCors(await handleGetL10nAsset(env, key));
      }

      return withCors(new Response('Not found', { status: 404 }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return withCors(
        json(
          { error: { kind: 'INTERNAL', reasonKey: 'tokyo.errors.internal', detail: message } },
          { status: 500 },
        ),
      );
    }
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    const retryDelaySeconds = (attempt: number, baseSeconds: number, capSeconds: number) =>
      Math.min(capSeconds, baseSeconds * Math.max(1, attempt));
    const shouldRetryMissingPrereqs = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return message.includes('[tokyo] missing required');
    };

    for (const msg of batch.messages) {
      const body = msg.body;
      if (!isTokyoMirrorJob(body)) {
        msg.ack();
        continue;
      }

      const publicId = normalizePublicId(body.publicId);
      if (!publicId) {
        msg.ack();
        continue;
      }

      try {
        switch (body.kind) {
          case 'write-config-pack':
            await writeConfigPack(env, body);
            break;
          case 'write-text-pack':
            await writeTextPack(env, body);
            break;
          case 'write-meta-pack':
            await writeMetaPack(env, body);
            break;
          case 'sync-live-surface':
            await syncLiveSurface(env, body);
            break;
          case 'enforce-live-surface':
            await enforceLiveSurface(env, body);
            break;
          case 'delete-instance-mirror':
            await deleteInstanceMirror(env, publicId);
            break;
        }
        msg.ack();
      } catch (error) {
        const attempt =
          typeof msg.attempts === 'number' && Number.isFinite(msg.attempts) ? msg.attempts : 0;
        const maxAttempts = 10;
        const message = error instanceof Error ? error.message : String(error);

        if (attempt >= maxAttempts) {
          console.error('[tokyo] queue job failed permanently', body.kind, publicId, message);
          msg.ack();
          continue;
        }

        const delaySeconds = shouldRetryMissingPrereqs(error)
          ? retryDelaySeconds(attempt, 2, 30)
          : retryDelaySeconds(attempt, 5, 60);
        console.warn(
          '[tokyo] queue job failed, retrying',
          body.kind,
          publicId,
          `attempt=${attempt}`,
          message,
        );
        msg.retry({ delaySeconds });
      }
    }
  },
};
