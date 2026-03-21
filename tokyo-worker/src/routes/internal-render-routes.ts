import { isUuid } from '@clickeen/ck-contracts';
import {
  normalizePublicId,
  normalizeSha256Hex,
} from '../asset-utils';
import { assertRomaAccountCapsuleAuth, TOKYO_INTERNAL_SERVICE_ROMA_EDGE } from '../auth';
import { json } from '../http';
import {
  deleteSavedRenderConfig,
  readSavedRenderConfig,
  syncLiveSurface,
  writeConfigPack,
  writeSavedRenderConfig,
} from '../domains/render';
import { handleSyncAccountInstance } from '../domains/account-instance-sync';
import {
  authorizeRomaAccountScopedRequest,
  authorizeSavedRenderControlRequest,
  isRecord,
  isValidScopedInstance,
  respondMethodNotAllowed,
  respondValidation,
  sha256StableJson,
  type TokyoRouteArgs,
} from '../route-helpers';
import { roleRank } from '../domains/assets';

export async function tryHandleInternalRenderRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const internalRenderSyncMatch = pathname.match(
    /^\/__internal\/renders\/instances\/([^/]+)\/sync$/,
  );
  if (internalRenderSyncMatch) {
    const publicId = normalizePublicId(decodeURIComponent(internalRenderSyncMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(publicId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }
    const auth = await assertRomaAccountCapsuleAuth(req, env, {
      requiredInternalServiceId: TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
    });
    if (!auth.ok) return respond(auth.response);
    const capsule = auth.principal.accountAuthz;
    if (capsule.accountId !== accountId || roleRank(capsule.role) < roleRank('editor')) {
      return respond(
        json(
          { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
          { status: 403 },
        ),
      );
    }
    return respond(await handleSyncAccountInstance(req, env, publicId!, accountId, capsule));
  }

  const internalRenderLivePointerMatch = pathname.match(
    /^\/__internal\/renders\/instances\/([^/]+)\/live\/r\.json$/,
  );
  if (internalRenderLivePointerMatch) {
    const publicId = normalizePublicId(decodeURIComponent(internalRenderLivePointerMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(publicId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }
    const authErr = await authorizeRomaAccountScopedRequest({
      req,
      env,
      accountId,
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
    const configFp = normalizeSha256Hex(body?.configFp);
    const localePolicy = body?.localePolicy;
    if (!widgetType || !configFp || !isRecord(localePolicy)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    await syncLiveSurface(env, {
      v: 1,
      kind: 'sync-live-surface',
      publicId: publicId!,
      live: true,
      widgetType,
      configFp,
      localePolicy: localePolicy as any,
      seoGeo: body?.seoGeo === true,
    });

    return respond(
      json({
        ok: true,
        publicId,
        live: true,
        configFp,
      }),
    );
  }

  const internalRenderLiveSurfaceMatch = pathname.match(
    /^\/__internal\/renders\/instances\/([^/]+)\/live\.json$/,
  );
  if (internalRenderLiveSurfaceMatch) {
    const publicId = normalizePublicId(decodeURIComponent(internalRenderLiveSurfaceMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(publicId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'DELETE') {
      return respondMethodNotAllowed(respond);
    }
    const authErr = await authorizeRomaAccountScopedRequest({
      req,
      env,
      accountId,
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);
    await syncLiveSurface(env, {
      v: 1,
      kind: 'sync-live-surface',
      publicId: publicId!,
      live: false,
    });
    return respond(json({ ok: true, publicId, live: false }));
  }

  const internalRenderSavedMatch = pathname.match(
    /^\/__internal\/renders\/instances\/([^/]+)\/saved\.json$/,
  );
  if (internalRenderSavedMatch) {
    const publicId = normalizePublicId(decodeURIComponent(internalRenderSavedMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(publicId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    if (req.method === 'GET') {
      const authErr = await authorizeSavedRenderControlRequest({
        req,
        env,
        accountId,
        minRole: 'viewer',
      });
      if (authErr) return respond(authErr);
      const saved = await readSavedRenderConfig({ env, publicId: publicId!, accountId });
      if (!saved.ok && saved.kind === 'NOT_FOUND') {
        return respond(
          json(
            { error: { kind: 'NOT_FOUND', reasonKey: saved.reasonKey } },
            { status: 404 },
          ),
        );
      }
      if (!saved.ok) {
        return respond(
          json(
            { error: { kind: 'VALIDATION', reasonKey: saved.reasonKey } },
            { status: 422 },
          ),
        );
      }
      return respond(json({ ...saved.value.pointer, config: saved.value.config }));
    }

    if (req.method === 'PUT') {
      const authErr = await authorizeSavedRenderControlRequest({
        req,
        env,
        accountId,
        minRole: 'editor',
      });
      if (authErr) return respond(authErr);
      const rawBody = (await req.json().catch(() => null)) as unknown;
      if (!isRecord(rawBody)) {
        return respondValidation(respond, 'tokyo.errors.render.invalid');
      }
      const body = rawBody;
      const pointer = await writeSavedRenderConfig({
        env,
        publicId: publicId!,
        accountId,
        widgetType: body.widgetType as string,
        config: body.config as Record<string, unknown>,
        displayName: body.displayName,
        source: body.source,
        meta: body.meta,
      });
      return respond(json({ ...pointer, config: body?.config }));
    }

    if (req.method === 'DELETE') {
      const authErr = await authorizeSavedRenderControlRequest({
        req,
        env,
        accountId,
        minRole: 'editor',
      });
      if (authErr) return respond(authErr);
      const deleted = await deleteSavedRenderConfig({ env, publicId: publicId!, accountId });
      if (!deleted.ok && deleted.kind === 'NOT_FOUND') {
        return respond(
          json(
            { error: { kind: 'NOT_FOUND', reasonKey: deleted.reasonKey } },
            { status: 404 },
          ),
        );
      }
      if (!deleted.ok) {
        return respond(
          json(
            { error: { kind: 'VALIDATION', reasonKey: deleted.reasonKey } },
            { status: 422 },
          ),
        );
      }
      return respond(json({ ok: true, deleted: true }));
    }

    return respondMethodNotAllowed(respond);
  }

  const internalRenderConfigPackWriteMatch = pathname.match(
    /^\/__internal\/renders\/instances\/([^/]+)\/config-pack$/,
  );
  if (internalRenderConfigPackWriteMatch) {
    const publicId = normalizePublicId(decodeURIComponent(internalRenderConfigPackWriteMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(publicId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }

    const authErr = await authorizeRomaAccountScopedRequest({
      req,
      env,
      accountId,
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
    const configPack =
      isRecord(body?.configPack) ? (body.configPack as Record<string, unknown>) : null;
    if (!widgetType || !configPack) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    const configFp = await sha256StableJson(configPack);
    await writeConfigPack(env, {
      v: 1,
      kind: 'write-config-pack',
      publicId: publicId!,
      widgetType,
      configFp,
      configPack,
    });

    return respond(
      json({
        publicId,
        widgetType,
        configFp,
        written: true,
      }),
    );
  }

  return null;
}
