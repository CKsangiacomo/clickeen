import { isUuid } from '@clickeen/ck-contracts';
import {
  normalizePublicId,
  normalizeSha256Hex,
} from '../asset-utils';
import { assertRomaAccountCapsuleAuth, INTERNAL_SERVICE_HEADER, TOKYO_INTERNAL_SERVICE_ROMA_EDGE } from '../auth';
import { json } from '../http';
import {
  deleteSavedRenderConfig,
  enqueueTokyoMirrorJob,
  buildAccountInstanceIndexDryRun,
  readInstanceServeState,
  readAccountInstanceIndex,
  readListedInstanceIndex,
  rebuildAccountInstanceIndexes,
  resolvePlatformAccountId,
  accountInstanceProjectionGapKey,
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
    const translationStatus = nonBaseLocales.length > 0 ? 'queued' : 'ready';
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
        await readInstanceServeState({ env, accountId, publicId }),
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

  if (pathname === '/__internal/renders/instances/index.json') {
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isUuid(accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'GET') {
      return respondMethodNotAllowed(respond);
    }

    const authErr = await authorizeSavedRenderControlRequest({
      req,
      env,
      accountId,
      minRole: 'viewer',
    });
    if (authErr) return respond(authErr);

    const accountIndex = await readAccountInstanceIndex({ env, accountId });
    if (!accountIndex.ok) {
      return respond(
        json(
          { error: { kind: accountIndex.kind, reasonKey: accountIndex.reasonKey, detail: accountIndex.detail } },
          { status: accountIndex.kind === 'NOT_FOUND' ? 404 : 422 },
        ),
      );
    }

    const platformAccountId = resolvePlatformAccountId(env);
    let listedInstances = [] as typeof accountIndex.value.entries;
    if (accountId !== platformAccountId) {
      const listedIndex = await readListedInstanceIndex({ env, platformAccountId });
      if (!listedIndex.ok) {
        return respond(
          json(
            { error: { kind: listedIndex.kind, reasonKey: listedIndex.reasonKey, detail: listedIndex.detail } },
            { status: listedIndex.kind === 'NOT_FOUND' ? 404 : 422 },
          ),
        );
      }
      listedInstances = listedIndex.value.entries.filter((entry) => entry.duplicable);
    }

    const widgetTypes = Array.from(
      new Set(
        [...accountIndex.value.entries, ...listedInstances]
          .map((entry) => entry.widgetType.trim().toLowerCase())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return respond(
      json({
        ok: true,
        accountId,
        platformAccountId,
        accountInstances: accountIndex.value.entries,
        listedInstances,
        widgetTypes,
        publishedCount: accountIndex.value.entries.filter((entry) => entry.publishStatus === 'published').length,
      }),
    );
  }

  if (pathname === '/__internal/renders/instances/index/rebuild.json') {
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
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const dryRun = body?.dryRun !== false;

    try {
      const index = dryRun
        ? await buildAccountInstanceIndexDryRun(env, accountId)
        : await rebuildAccountInstanceIndexes(env, accountId);
      return respond(
        json({
          ok: true,
          dryRun,
          accountId,
          entries: index.entries.length,
          entryPublicIds: index.entries.map((entry) => entry.publicId),
          listedEntries:
            accountId === resolvePlatformAccountId(env)
              ? index.entries.filter((entry) => entry.listed).length
              : 0,
          listedPublicIds:
            accountId === resolvePlatformAccountId(env)
              ? index.entries.filter((entry) => entry.listed).map((entry) => entry.publicId)
              : [],
        }),
      );
    } catch (error) {
      return respond(
        json(
          {
            error: {
              kind: 'VALIDATION',
              reasonKey: 'tokyo.errors.instance.indexInvalid',
              detail: error instanceof Error ? error.message : String(error),
            },
          },
          { status: 422 },
        ),
      );
    }
  }

  if (pathname === '/__internal/renders/instances/projection-gap.json') {
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
      minRole: 'editor',
    });
    if (authErr) return respond(authErr);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const publicId = normalizePublicId(body?.publicId);
    if (!isValidScopedInstance(publicId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const action = typeof body?.action === 'string' ? body.action.trim() : '';
    if (action !== 'create' && action !== 'delete') {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const reasonKey = typeof body?.reasonKey === 'string' ? body.reasonKey.trim() : '';
    if (!reasonKey) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const detail = typeof body?.detail === 'string' ? body.detail.trim() : null;
    const status =
      typeof body?.status === 'number' && Number.isFinite(body.status)
        ? Math.max(0, Math.floor(body.status))
        : null;
    const createdAt = new Date().toISOString();
    const gapId = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
    await env.TOKYO_R2.put(
      accountInstanceProjectionGapKey(accountId, gapId),
      JSON.stringify({
        v: 1,
        kind: 'instance-projection-gap',
        accountId,
        publicId,
        action,
        reasonKey,
        detail,
        status,
        createdAt,
      }),
      {
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
      },
    );

    return respond(json({ ok: true, gapId, createdAt }));
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
      accountId,
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
      accountId,
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
      const internalServiceId = String(req.headers.get(INTERNAL_SERVICE_HEADER) || '').trim().toLowerCase();
      const isRomaListedRead =
        internalServiceId === TOKYO_INTERNAL_SERVICE_ROMA_EDGE &&
        publicId != null &&
        (await isRomaListedSavedReadAllowed({
          env,
          accountId,
          publicId,
        }));
      if (!isRomaListedRead) {
        const authErr = await authorizeSavedRenderControlRequest({
          req,
          env,
          accountId,
          minRole: 'viewer',
        });
        if (authErr) return respond(authErr);
      }
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
      accountId,
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

async function isRomaListedSavedReadAllowed(args: {
  env: TokyoRouteArgs['env'];
  accountId: string;
  publicId: string;
}): Promise<boolean> {
  const platformAccountId = resolvePlatformAccountId(args.env);
  if (args.accountId !== platformAccountId) return false;
  const listedIndex = await readListedInstanceIndex({
    env: args.env,
    platformAccountId,
  });
  if (!listedIndex.ok) return false;
  return listedIndex.value.entries.some(
    (entry) =>
      entry.accountId === args.accountId &&
      entry.publicId === args.publicId &&
      entry.listed === true &&
      entry.duplicable === true,
  );
}
