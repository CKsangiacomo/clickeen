import { isUuid } from '@clickeen/ck-contracts';
import {
  normalizePublicId,
  normalizeSha256Hex,
} from '../asset-utils';
import { assertRomaAccountCapsuleAuth, TOKYO_INTERNAL_SERVICE_ROMA_EDGE } from '../auth';
import { json } from '../http';
import {
  deleteSavedRenderConfig,
  enqueueTokyoMirrorJob,
  readInstanceServeState,
  readSavedRenderConfig,
  syncLiveSurface,
  writeConfigPack,
  writeSavedRenderConfig,
  writeSavedRenderL10nStatus,
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

  const internalRenderSyncQueueMatch = pathname.match(
    /^\/__internal\/renders\/instances\/([^/]+)\/sync\/queue$/,
  );
  if (internalRenderSyncQueueMatch) {
    const publicId = normalizePublicId(decodeURIComponent(internalRenderSyncQueueMatch[1]));
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

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const live = body?.live === true;
    if (body && Object.prototype.hasOwnProperty.call(body, 'live') && typeof body.live !== 'boolean') {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const previousBaseFingerprint =
      body && Object.prototype.hasOwnProperty.call(body, 'previousBaseFingerprint')
        ? normalizeSha256Hex(body.previousBaseFingerprint)
        : null;
    const requestedBaseFingerprint =
      body && Object.prototype.hasOwnProperty.call(body, 'baseFingerprint')
        ? normalizeSha256Hex(body.baseFingerprint)
        : null;
    if (
      body &&
      Object.prototype.hasOwnProperty.call(body, 'previousBaseFingerprint') &&
      body.previousBaseFingerprint !== null &&
      !previousBaseFingerprint
    ) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (
      body &&
      Object.prototype.hasOwnProperty.call(body, 'baseFingerprint') &&
      body.baseFingerprint !== null &&
      !requestedBaseFingerprint
    ) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const l10nIntent =
      body && isRecord(body.l10nIntent)
        ? body.l10nIntent
        : null;
    const baseLocale =
      l10nIntent && typeof l10nIntent.baseLocale === 'string' ? l10nIntent.baseLocale.trim() : '';
    const desiredLocales = Array.isArray(l10nIntent?.desiredLocales)
      ? l10nIntent.desiredLocales
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      : [];
    const countryToLocale =
      l10nIntent && isRecord(l10nIntent.countryToLocale)
        ? Object.fromEntries(
            Object.entries(l10nIntent.countryToLocale).flatMap(([country, locale]) => {
              if (!/^[A-Z]{2}$/.test(country) || typeof locale !== 'string') return [];
              const normalized = locale.trim().toLowerCase();
              return normalized ? [[country, normalized] as const] : [];
            }),
          )
        : {};
    if (!baseLocale || !desiredLocales.length) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    const saved = await readSavedRenderConfig({ env, publicId: publicId!, accountId });
    if (!saved.ok) {
      return respond(
        json(
          { error: { kind: saved.kind, reasonKey: saved.reasonKey } },
          { status: saved.kind === 'NOT_FOUND' ? 404 : 422 },
        ),
      );
    }
    const savedBaseFingerprint = normalizeSha256Hex(saved.value.pointer.l10n?.baseFingerprint);
    const resolvedBaseFingerprint = requestedBaseFingerprint ?? savedBaseFingerprint;
    if (!resolvedBaseFingerprint) {
      return respond(
        json(
          { error: { kind: 'VALIDATION', reasonKey: 'tokyo_saved_l10n_base_missing' } },
          { status: 422 },
        ),
      );
    }
    if (requestedBaseFingerprint && savedBaseFingerprint && requestedBaseFingerprint !== savedBaseFingerprint) {
      return respondValidation(respond, 'tokyo.errors.render.staleBaseFingerprint');
    }

    const normalizedBaseLocale = baseLocale.toLowerCase();
    const requestedLocales = Array.from(
      new Set([
        normalizedBaseLocale,
        ...desiredLocales.map((locale) => locale.trim().toLowerCase()).filter(Boolean),
      ]),
    );
    const generationId = crypto.randomUUID();
    const nonBaseLocales = requestedLocales.filter((locale) => locale !== normalizedBaseLocale);
    const translationStatus = nonBaseLocales.length > 0 ? 'accepted' : 'ready';
    const finishedAt = translationStatus === 'ready' ? new Date().toISOString() : null;

    const statusPointer = await writeSavedRenderL10nStatus({
      env,
      publicId: publicId!,
      accountId,
      generationId,
      status: translationStatus,
      baseFingerprint: resolvedBaseFingerprint,
      readyLocales: [normalizedBaseLocale],
      failedLocales: [],
      finishedAt,
    });

    const translation = {
      publicId: publicId!,
      widgetType: saved.value.pointer.widgetType,
      baseFingerprint: resolvedBaseFingerprint,
      baseLocale: normalizedBaseLocale,
      requestedLocales,
      readyLocales: [normalizedBaseLocale],
      status: translationStatus,
      failedLocales: [],
      generationId,
      updatedAt: statusPointer?.l10n?.updatedAt ?? new Date().toISOString(),
    };

    const shouldQueue = nonBaseLocales.length > 0;
    try {
      if (shouldQueue) {
        await enqueueTokyoMirrorJob(env, {
          v: 1,
          kind: 'sync-instance-overlays',
          publicId: publicId!,
          accountId,
          baseFingerprint: resolvedBaseFingerprint,
          generationId,
          live,
          accountAuthz: {
            profile: capsule.profile,
            role: capsule.role,
            entitlements: capsule.entitlements ?? null,
          },
          baseLocale: normalizedBaseLocale,
          desiredLocales: requestedLocales,
          countryToLocale,
          previousBaseFingerprint,
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await writeSavedRenderL10nStatus({
        env,
        publicId: publicId!,
        accountId,
        generationId,
        status: 'failed',
        baseFingerprint: resolvedBaseFingerprint,
        readyLocales: [normalizedBaseLocale],
        failedLocales: nonBaseLocales.map((locale) => ({
          locale,
          reasonKey: 'tokyo_translation_enqueue_failed',
          detail,
        })),
        lastError: detail,
        finishedAt: new Date().toISOString(),
        guardCurrentGeneration: true,
      });
      return respond(
        json(
          {
            error: {
              kind: 'VALIDATION',
              reasonKey: 'tokyo_overlay_sync_enqueue_failed',
              detail,
            },
          },
          { status: 503 },
        ),
      );
    }

    return respond(
      json({
        ok: true,
        queued: shouldQueue,
        publicId,
        live,
        baseFingerprint: resolvedBaseFingerprint,
        translation,
      }),
    );
  }

  if (pathname === '/__internal/renders/instances/serve-state.json') {
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isUuid(accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }

    const authErr = await authorizeSavedRenderControlRequest({
      req,
      env,
      accountId,
      minRole: 'viewer',
    });
    if (authErr) return respond(authErr);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const rawPublicIds = Array.isArray(body?.publicIds) ? body.publicIds : null;
    if (!rawPublicIds) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    const publicIds = Array.from(
      new Set(
        rawPublicIds
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => normalizePublicId(entry))
          .filter((entry): entry is string => Boolean(entry)),
      ),
    );

    if (publicIds.length !== rawPublicIds.length) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    const serveEntries = await Promise.all(
      publicIds.map(async (publicId) => [
        publicId,
        await readInstanceServeState({ env, publicId }),
      ] as const),
    );
    const serveStates = Object.fromEntries(serveEntries);
    const publishedCount = serveEntries.filter(([, state]) => state === 'published').length;

    return respond(
      json({
        ok: true,
        serveStates,
        publishedCount,
      }),
    );
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
      const l10n =
        body.l10n === null || isRecord(body.l10n)
          ? (body.l10n as
              | {
                  baseFingerprint?: string | null;
                  summary?: {
                    baseLocale: string;
                    desiredLocales: string[];
                  } | null;
                }
              | null)
          : undefined;
      const savedWrite = await writeSavedRenderConfig({
        env,
        publicId: publicId!,
        accountId,
        widgetType: body.widgetType as string,
        config: body.config as Record<string, unknown>,
        displayName: body.displayName,
        source: body.source,
        meta: body.meta,
        ...(l10n !== undefined ? { l10n } : {}),
      });
      return respond(
        json({
          ...savedWrite.pointer,
          config: body?.config,
          previousBaseFingerprint: savedWrite.previousBaseFingerprint,
        }),
      );
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
