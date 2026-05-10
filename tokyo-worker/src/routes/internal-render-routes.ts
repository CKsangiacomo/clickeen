import { isUuid } from '@clickeen/ck-contracts';
import {
  normalizeStorageId,
  normalizeSha256Hex,
} from '../asset-utils';
import { assertRomaAccountCapsuleAuth, TOKYO_INTERNAL_SERVICE_ROMA_EDGE } from '../auth';
import { json } from '../http';
import {
  deleteSavedRenderConfig,
  enqueueTokyoMirrorJob,
  buildAccountInstanceIndexDryRun,
  readInstanceServeState,
  readAccountInstanceIndex,
  rebuildAccountInstanceIndexes,
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
    /^\/__internal\/renders\/widgets\/([^/]+)\/sync$/,
  );
  if (internalRenderSyncMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalRenderSyncMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(instanceId, accountId)) {
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
    return respond(await handleSyncAccountInstance(req, env, instanceId!, accountId, capsule));
  }

  const internalRenderSyncQueueMatch = pathname.match(
    /^\/__internal\/renders\/widgets\/([^/]+)\/sync\/queue$/,
  );
  if (internalRenderSyncQueueMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalRenderSyncQueueMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(instanceId, accountId)) {
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

    const saved = await readSavedRenderConfig({ env, instanceId: instanceId!, accountId });
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
      instanceId: instanceId!,
      accountId,
      generationId,
      status: translationStatus,
      baseFingerprint: resolvedBaseFingerprint,
      readyLocales: [normalizedBaseLocale],
      failedLocales: [],
      finishedAt,
    });

    const translation = {
      instanceId: instanceId!,
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
          instanceId: instanceId!,
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
        instanceId: instanceId!,
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
        instanceId,
        live,
        baseFingerprint: resolvedBaseFingerprint,
        translation,
      }),
    );
  }

  if (pathname === '/__internal/renders/widgets/serve-state.json') {
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
    const rawInstanceIds = Array.isArray(body?.instanceIds) ? body.instanceIds : null;
    if (!rawInstanceIds) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    const instanceIds = Array.from(
      new Set(
        rawInstanceIds
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => normalizeStorageId(entry))
          .filter((entry): entry is string => Boolean(entry)),
      ),
    );

    if (instanceIds.length !== rawInstanceIds.length) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    const serveEntries = await Promise.all(
      instanceIds.map(async (instanceId) => [
        instanceId,
        await readInstanceServeState({ env, accountId, instanceId }),
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

  if (pathname === '/__internal/renders/widgets/index.json') {
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

    const widgetTypes = Array.from(
      new Set(
        accountIndex.value.entries.map((entry) => entry.widgetType.trim().toLowerCase()).filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return respond(
      json({
        ok: true,
        accountId,
        accountInstances: accountIndex.value.entries.map((entry) => ({ ...entry, instanceId: entry.id })),
        widgetTypes,
        publishedCount: accountIndex.value.entries.filter((entry) => entry.publishStatus === 'published').length,
      }),
    );
  }

  if (pathname === '/__internal/renders/widgets/index/rebuild.json') {
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
          entryIds: index.entries.map((entry) => entry.id),
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

  const internalRenderLivePointerMatch = pathname.match(
    /^\/__internal\/renders\/widgets\/([^/]+)\/live\/r\.json$/,
  );
  if (internalRenderLivePointerMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalRenderLivePointerMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(instanceId, accountId)) {
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
      instanceId: instanceId!,
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
        instanceId,
        live: true,
        configFp,
      }),
    );
  }

  const internalRenderLiveSurfaceMatch = pathname.match(
    /^\/__internal\/renders\/widgets\/([^/]+)\/live\.json$/,
  );
  if (internalRenderLiveSurfaceMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalRenderLiveSurfaceMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(instanceId, accountId)) {
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
      instanceId: instanceId!,
      accountId,
      live: false,
    });
    return respond(json({ ok: true, instanceId, live: false }));
  }

  const internalRenderSavedMatch = pathname.match(
    /^\/__internal\/renders\/widgets\/([^/]+)\/saved\.json$/,
  );
  if (internalRenderSavedMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalRenderSavedMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(instanceId, accountId)) {
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
      const saved = await readSavedRenderConfig({ env, instanceId: instanceId!, accountId });
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
        instanceId: instanceId!,
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
      const deleted = await deleteSavedRenderConfig({ env, instanceId: instanceId!, accountId });
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
    /^\/__internal\/renders\/widgets\/([^/]+)\/config-pack$/,
  );
  if (internalRenderConfigPackWriteMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalRenderConfigPackWriteMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(instanceId, accountId)) {
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
      instanceId: instanceId!,
      accountId,
      widgetType,
      configFp,
      configPack,
    });

    return respond(
      json({
        instanceId,
        widgetType,
        configFp,
        written: true,
      }),
    );
  }

  return null;
}
