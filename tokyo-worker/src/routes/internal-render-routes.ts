import { isUuid } from '@clickeen/ck-contracts';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  normalizeStorageId,
  normalizeSha256Hex,
} from '../asset-utils';
import { assertRomaAccountCapsuleAuth, TOKYO_INTERNAL_SERVICE_ROMA_EDGE } from '../auth';
import { json } from '../http';
import {
  AccountInstanceTransitionError,
  deleteInstanceMirror,
  duplicateAccountInstanceTransition,
  buildAccountInstanceIndexDryRun,
  createAccountInstanceFromDefaults,
  publishAccountInstanceTransition,
  readInstanceServeState,
  readAccountInstanceIndex,
  rebuildAccountInstanceIndexes,
  readSavedRenderConfig,
  saveAccountInstanceTransition,
  syncLiveSurface,
  unpublishAccountInstanceTransition,
  writeConfigPack,
  writeSavedRenderConfig,
} from '../domains/render';
import {
  enqueueAccountInstanceSyncJob,
  handleSyncAccountInstance,
} from '../domains/account-instance-sync';
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
import type { Env } from '../types';

function normalizeTransitionL10nIntent(raw: unknown): {
  baseLocale: string;
  desiredLocales: string[];
  countryToLocale: Record<string, string>;
} | null {
  if (!isRecord(raw)) return null;
  const baseLocale = typeof raw.baseLocale === 'string' ? raw.baseLocale.trim().toLowerCase() : '';
  const desiredLocales = Array.isArray(raw.desiredLocales)
    ? raw.desiredLocales
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    : [];
  if (!baseLocale || !desiredLocales.includes(baseLocale)) return null;
  const countryToLocale =
    isRecord(raw.countryToLocale)
      ? Object.fromEntries(
          Object.entries(raw.countryToLocale).flatMap(([country, locale]) => {
            if (!/^[A-Z]{2}$/.test(country) || typeof locale !== 'string') return [];
            const normalized = locale.trim().toLowerCase();
            return normalized ? [[country, normalized] as const] : [];
          }),
        )
      : {};
  return {
    baseLocale,
    desiredLocales: Array.from(new Set(desiredLocales)),
    countryToLocale,
  };
}

function transitionErrorResponse(error: unknown): Response {
  if (error instanceof AccountInstanceTransitionError) {
    return json(
      {
        error: {
          kind: error.kind,
          reasonKey: error.reasonKey,
          detail: error.message,
        },
      },
      { status: error.status },
    );
  }
  const detail = error instanceof Error ? error.message : String(error);
  return json(
    {
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail,
      },
    },
    { status: 502 },
  );
}

function toAccountAuthzSnapshot(capsule: RomaAccountAuthzCapsulePayload) {
  return {
    profile: capsule.profile,
    role: capsule.role,
    entitlements: capsule.entitlements ?? null,
  };
}

async function authorizeRomaEditorTransition(args: {
  req: Request;
  env: Env;
  accountId: string;
}): Promise<
  | { ok: true; capsule: RomaAccountAuthzCapsulePayload }
  | { ok: false; response: Response }
> {
  const auth = await assertRomaAccountCapsuleAuth(args.req, args.env, {
    requiredInternalServiceId: TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
  });
  if (!auth.ok) return auth;
  const capsule = auth.principal.accountAuthz;
  if (capsule.accountId !== args.accountId || roleRank(capsule.role) < roleRank('editor')) {
    return {
      ok: false,
      response: json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
        { status: 403 },
      ),
    };
  }
  return { ok: true, capsule };
}

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
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);
    const { capsule } = auth;
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
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);
    const { capsule } = auth;

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
    const l10nIntent = normalizeTransitionL10nIntent(body?.l10nIntent);
    if (!l10nIntent) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    try {
      const queued = await enqueueAccountInstanceSyncJob({
        env,
        accountId,
        instanceId: instanceId!,
        live,
        baseFingerprint: requestedBaseFingerprint,
        previousBaseFingerprint,
        accountAuthz: {
          profile: capsule.profile,
          role: capsule.role,
          entitlements: capsule.entitlements ?? null,
        },
        l10nIntent,
      });
      return respond(
        json({
          ok: true,
          ...queued,
        }),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const status =
        detail === 'tokyo_saved_not_found'
          ? 404
          : detail === 'tokyo_saved_l10n_base_missing' ||
              detail === 'tokyo.errors.render.staleBaseFingerprint'
            ? 422
            : detail.startsWith('tokyo_overlay_sync_enqueue_failed:')
              ? 503
              : 502;
      const kind =
        status === 404
          ? 'NOT_FOUND'
          : status === 422
            ? 'VALIDATION'
            : 'UPSTREAM_UNAVAILABLE';
      return respond(
        json(
          {
            error: {
              kind,
              reasonKey: detail,
              detail,
            },
          },
          { status },
        ),
      );
    }
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

    return respond(
      json({
        ok: true,
        accountId,
        accountInstances: accountIndex.value.entries.map((entry) => ({ ...entry, instanceId: entry.id })),
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

    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

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

  if (pathname === '/__internal/renders/widgets/create.json') {
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

    const rawBody = (await req.json().catch(() => null)) as unknown;
    if (!isRecord(rawBody)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const body = rawBody;
    const widgetType = typeof body.widgetType === 'string' ? body.widgetType.trim() : '';
    if (!widgetType) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const l10n =
      body.l10n === null || isRecord(body.l10n)
        ? (body.l10n as
            | {
                summary?: {
                  baseLocale: string;
                  desiredLocales: string[];
                } | null;
              }
            | null)
        : undefined;

    try {
      const created = await createAccountInstanceFromDefaults({
        env,
        accountId,
        widgetType,
        displayName: body.displayName,
        ...(l10n !== undefined ? { l10n } : {}),
      });
      return respond(
        json(
          {
            ok: true,
            ...created.pointer,
            instanceId: created.pointer.id,
            config: created.config,
          },
          { status: 201 },
        ),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return respond(
        json(
          {
            error: {
              kind: detail === 'tokyo.errors.widget.unsupported' ? 'VALIDATION' : 'UPSTREAM_UNAVAILABLE',
              reasonKey: detail,
              detail,
            },
          },
          { status: detail === 'tokyo.errors.widget.unsupported' ? 422 : 502 },
        ),
      );
    }
  }

  const internalRenderSaveTransitionMatch = pathname.match(
    /^\/__internal\/renders\/widgets\/([^/]+)\/save\.json$/,
  );
  if (internalRenderSaveTransitionMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalRenderSaveTransitionMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);
    const { capsule } = auth;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!isRecord(body) || !isRecord(body.config)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const l10nIntent = normalizeTransitionL10nIntent(body.l10nIntent);
    if (!l10nIntent) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    try {
      const result = await saveAccountInstanceTransition({
        env,
        accountId,
        instanceId: instanceId!,
        submittedWidgetType: body.widgetType as string,
        config: body.config,
        displayName: body.displayName,
        hasDisplayName: Object.prototype.hasOwnProperty.call(body, 'displayName'),
        meta: body.meta,
        hasMeta: Object.prototype.hasOwnProperty.call(body, 'meta'),
        l10nIntent,
        accountAuthz: toAccountAuthzSnapshot(capsule),
      });
      return respond(
        json({
          ok: true,
          instanceId,
          widgetType: result.pointer.widgetType,
          live: result.live,
          previousBaseFingerprint: result.previousBaseFingerprint,
          baseFingerprint: result.pointer.l10n?.baseFingerprint ?? null,
          translationFollowup: result.translationFollowup,
        }),
      );
    } catch (error) {
      return respond(transitionErrorResponse(error));
    }
  }

  const internalRenderDuplicateTransitionMatch = pathname.match(
    /^\/__internal\/renders\/widgets\/([^/]+)\/duplicate\.json$/,
  );
  if (internalRenderDuplicateTransitionMatch) {
    const sourceInstanceId = normalizeStorageId(decodeURIComponent(internalRenderDuplicateTransitionMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(sourceInstanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);
    const { capsule } = auth;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const l10nIntent = normalizeTransitionL10nIntent(body?.l10nIntent);
    if (!l10nIntent) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    try {
      const duplicated = await duplicateAccountInstanceTransition({
        env,
        accountId,
        sourceInstanceId: sourceInstanceId!,
        l10nIntent,
        accountAuthz: toAccountAuthzSnapshot(capsule),
      });
      return respond(json({ ok: true, ...duplicated }, { status: 201 }));
    } catch (error) {
      return respond(transitionErrorResponse(error));
    }
  }

  const internalRenderPublishTransitionMatch = pathname.match(
    /^\/__internal\/renders\/widgets\/([^/]+)\/publish\.json$/,
  );
  if (internalRenderPublishTransitionMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalRenderPublishTransitionMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);
    const { capsule } = auth;

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const l10nIntent = normalizeTransitionL10nIntent(body?.l10nIntent);
    if (!l10nIntent) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    try {
      const published = await publishAccountInstanceTransition({
        env,
        accountId,
        instanceId: instanceId!,
        accountAuthz: toAccountAuthzSnapshot(capsule),
        l10nIntent,
      });
      return respond(json({ ok: true, ...published }));
    } catch (error) {
      return respond(transitionErrorResponse(error));
    }
  }

  const internalRenderUnpublishTransitionMatch = pathname.match(
    /^\/__internal\/renders\/widgets\/([^/]+)\/unpublish\.json$/,
  );
  if (internalRenderUnpublishTransitionMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalRenderUnpublishTransitionMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);
    try {
      const unpublished = await unpublishAccountInstanceTransition({
        env,
        accountId,
        instanceId: instanceId!,
      });
      return respond(json({ ok: true, ...unpublished }));
    } catch (error) {
      return respond(transitionErrorResponse(error));
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
      const deleted = await deleteInstanceMirror(env, instanceId!, accountId);
      return respond(json({ ok: true, deleted: deleted.existed, existed: deleted.existed }));
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
