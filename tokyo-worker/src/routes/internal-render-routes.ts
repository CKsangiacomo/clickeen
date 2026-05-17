import { CK_REQUEST_ID_HEADER, isRecord, serializeCkLogEvent } from '@clickeen/ck-contracts';
import {
  DEFAULT_OVERLAY_EXPERIMENT,
  DEFAULT_OVERLAY_PERSONALIZATION,
  isCompactAccountPublicId,
  isOverlayExperimentCode,
  isOverlayId,
  isOverlayLanguageCode,
  isOverlayPersonalizationCode,
  parseOverlayId,
} from '@clickeen/ck-contracts/overlay-identity';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  normalizeStorageId,
} from '../asset-utils';
import { assertRomaAccountCapsuleAuth, TOKYO_INTERNAL_SERVICE_ROMA_EDGE } from '../auth';
import { json } from '../http';
import {
  AccountInstanceTransitionError,
  allocateOverlayId,
  deleteSelectedOverlayPointer,
  deleteInstanceMirror,
  duplicateAccountInstanceTransition,
  createAccountInstanceFromDefaults,
  listLocaleOverlayInventory,
  publishAccountInstanceTransition,
  readOverlayObject,
  readInstanceServeState,
  readAccountInstanceIndex,
  rebuildAccountInstanceIndexes,
  readSavedRenderConfig,
  readSelectedOverlayPointer,
  saveAccountInstanceTransition,
  unpublishAccountInstanceTransition,
  writeOverlayObject,
  writeSavedRenderConfig,
  writeSelectedOverlayPointer,
} from '../domains/render';
import {
  listWidgetCatalogEntries,
  resolveWidgetCode,
} from '../domains/widget-catalog';
import {
  authorizeRomaAccountScopedRequest,
  authorizeSavedRenderControlRequest,
  isValidScopedInstance,
  respondMethodNotAllowed,
  respondValidation,
  type TokyoRouteArgs,
} from '../route-helpers';
import { roleRank } from '../domains/assets';
import type { Env } from '../types';

const OVERLAY_VERSION_TECHNICAL_MAX = 100;

function normalizeAccountPublicId(value: unknown): string {
  const accountId = String(value || '').trim().toUpperCase();
  return isCompactAccountPublicId(accountId) ? accountId : '';
}

function normalizeOverlaySegment(value: unknown, fallback: string, guard: (entry: unknown) => boolean): string {
  const segment = String(value || fallback).trim().toUpperCase();
  return guard(segment) ? segment : '';
}

function normalizeOverlayValues(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function transitionErrorResponse(error: unknown): Response {
  if (error instanceof AccountInstanceTransitionError) {
    return json(
      {
        error: {
          kind: error.kind,
          reasonKey: error.reasonKey,
          detail: error.message,
          ...(error.paths?.length ? { paths: error.paths } : {}),
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

function logInternalRenderWarning(args: {
  req: Request;
  env: Env;
  boundary: string;
  detail: string;
  instanceId?: string | null;
  accountId?: string | null;
}): void {
  console.warn(
    serializeCkLogEvent({
      event: 'boundary.parse_failed',
      service: 'tokyo-worker',
      stage: typeof args.env.ENV_STAGE === 'string' && args.env.ENV_STAGE.trim() ? args.env.ENV_STAGE.trim() : 'unknown',
      requestId: String(args.req.headers.get(CK_REQUEST_ID_HEADER) || '').trim() || crypto.randomUUID(),
      boundary: args.boundary,
      method: args.req.method,
      path: new URL(args.req.url).pathname,
      detail: args.detail,
      ...(args.instanceId ? { instanceId: args.instanceId } : {}),
      ...(args.accountId ? { accountId: args.accountId } : {}),
    }),
  );
}

async function readInternalRenderJsonBody(args: {
  req: Request;
  env: Env;
  boundary: string;
  instanceId?: string | null;
  accountId?: string | null;
}): Promise<unknown | null> {
  try {
    return await args.req.json();
  } catch (error) {
    logInternalRenderWarning({
      req: args.req,
      env: args.env,
      boundary: args.boundary,
      instanceId: args.instanceId,
      accountId: args.accountId,
      detail: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
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
  if (capsule.accountPublicId !== args.accountId || roleRank(capsule.role) < roleRank('editor')) {
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

  if (pathname === '/__internal/overlays/languages/write.json') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || req.method !== 'POST') {
      return !accountId
        ? respondValidation(respond, 'tokyo.errors.render.invalid')
        : respondMethodNotAllowed(respond);
    }
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    const body = (await readInternalRenderJsonBody({
      req,
      env,
      boundary: 'internal.overlay.languageWrite.body',
      accountId,
    })) as Record<string, unknown> | null;
    const instanceId = normalizeStorageId(body?.instanceId);
    const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
    const widgetCode = widgetType ? resolveWidgetCode(widgetType) : null;
    const languageCode = normalizeOverlaySegment(body?.languageCode, '', isOverlayLanguageCode);
    const experiment = normalizeOverlaySegment(body?.experiment, DEFAULT_OVERLAY_EXPERIMENT, isOverlayExperimentCode);
    const personalization = normalizeOverlaySegment(body?.personalization, DEFAULT_OVERLAY_PERSONALIZATION, isOverlayPersonalizationCode);
    const values = normalizeOverlayValues(body?.values);
    if (!instanceId || !widgetType || !widgetCode || !languageCode || !experiment || !personalization || !values || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    const saved = await readSavedRenderConfig({ env, accountId, instanceId, widgetType });
    if (!saved.ok) {
      return respond(
        json(
          { error: { kind: saved.kind, reasonKey: saved.reasonKey } },
          { status: saved.kind === 'NOT_FOUND' ? 404 : 422 },
        ),
      );
    }

    try {
      const overlayId = await allocateOverlayId({
        env,
        coordinate: {
          accountId,
          widgetCode: saved.value.pointer.widgetCode,
          instanceId,
          languageCode,
          experiment,
          personalization,
        },
        maxVersions: OVERLAY_VERSION_TECHNICAL_MAX,
      });
      await writeOverlayObject({ env, overlayId, values });
      await writeSelectedOverlayPointer({ env, overlayId });
      return respond(json({ ok: true, overlayId }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return respond(
        json(
          { error: { kind: 'VALIDATION', reasonKey: detail, detail } },
          { status: detail === 'tokyo.overlay.version_slots_exhausted' ? 409 : 422 },
        ),
      );
    }
  }

  if (pathname === '/__internal/overlays/languages/clear.json') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || req.method !== 'POST') {
      return !accountId
        ? respondValidation(respond, 'tokyo.errors.render.invalid')
        : respondMethodNotAllowed(respond);
    }
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    const body = (await readInternalRenderJsonBody({
      req,
      env,
      boundary: 'internal.overlay.languageClear.body',
      accountId,
    })) as Record<string, unknown> | null;
    const instanceId = normalizeStorageId(body?.instanceId);
    const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
    const languageCode = normalizeOverlaySegment(body?.languageCode, '', isOverlayLanguageCode);
    const experiment = normalizeOverlaySegment(body?.experiment, DEFAULT_OVERLAY_EXPERIMENT, isOverlayExperimentCode);
    const personalization = normalizeOverlaySegment(body?.personalization, DEFAULT_OVERLAY_PERSONALIZATION, isOverlayPersonalizationCode);
    if (!instanceId || !widgetType || !languageCode || !experiment || !personalization || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const saved = await readSavedRenderConfig({ env, accountId, instanceId, widgetType });
    if (!saved.ok) {
      return respond(
        json(
          { error: { kind: saved.kind, reasonKey: saved.reasonKey } },
          { status: saved.kind === 'NOT_FOUND' ? 404 : 422 },
        ),
      );
    }

    await deleteSelectedOverlayPointer({
      env,
      coordinate: {
        accountId,
        widgetCode: saved.value.pointer.widgetCode,
        instanceId,
        languageCode,
        experiment,
        personalization,
      },
    });
    return respond(json({ ok: true }));
  }

  if (pathname === '/__internal/overlays/languages/selected.json') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || req.method !== 'POST') {
      return !accountId
        ? respondValidation(respond, 'tokyo.errors.render.invalid')
        : respondMethodNotAllowed(respond);
    }
    const authErr = await authorizeSavedRenderControlRequest({
      req,
      env,
      accountId,
      minRole: 'viewer',
    });
    if (authErr) return respond(authErr);

    const body = (await readInternalRenderJsonBody({
      req,
      env,
      boundary: 'internal.overlay.languageSelected.body',
      accountId,
    })) as Record<string, unknown> | null;
    const instanceId = normalizeStorageId(body?.instanceId);
    const widgetType = typeof body?.widgetType === 'string' ? body.widgetType.trim() : '';
    const languageCode = normalizeOverlaySegment(body?.languageCode, '', isOverlayLanguageCode);
    const experiment = normalizeOverlaySegment(body?.experiment, DEFAULT_OVERLAY_EXPERIMENT, isOverlayExperimentCode);
    const personalization = normalizeOverlaySegment(body?.personalization, DEFAULT_OVERLAY_PERSONALIZATION, isOverlayPersonalizationCode);
    if (!instanceId || !widgetType || !languageCode || !experiment || !personalization || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const saved = await readSavedRenderConfig({ env, accountId, instanceId, widgetType });
    if (!saved.ok) {
      return respond(
        json(
          { error: { kind: saved.kind, reasonKey: saved.reasonKey } },
          { status: saved.kind === 'NOT_FOUND' ? 404 : 422 },
        ),
      );
    }
    const selected = await readSelectedOverlayPointer({
      env,
      coordinate: {
        accountId,
        widgetCode: saved.value.pointer.widgetCode,
        instanceId,
        languageCode,
        experiment,
        personalization,
      },
    });
    return respond(json({ ok: true, overlayId: selected?.overlayId ?? null }));
  }

  if (pathname === '/__internal/overlays/languages/list.json') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || req.method !== 'POST') {
      return !accountId
        ? respondValidation(respond, 'tokyo.errors.render.invalid')
        : respondMethodNotAllowed(respond);
    }
    const authErr = await authorizeSavedRenderControlRequest({
      req,
      env,
      accountId,
      minRole: 'viewer',
    });
    if (authErr) return respond(authErr);

    const body = (await readInternalRenderJsonBody({
      req,
      env,
      boundary: 'internal.overlay.languageList.body',
      accountId,
    })) as Record<string, unknown> | null;
    const instanceId = normalizeStorageId(body?.instanceId);
    const baseLocale = typeof body?.baseLocale === 'string' ? body.baseLocale.trim() : '';
    if (!instanceId || !baseLocale || !isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const overlays = await listLocaleOverlayInventory({ env, accountId, instanceId });
    return respond(json({ ok: true, v: 1, baseLocale, overlays }));
  }

  const internalOverlayObjectMatch = pathname.match(/^\/__internal\/overlays\/([^/]+)\.json$/);
  if (internalOverlayObjectMatch) {
    const overlayId = decodeURIComponent(internalOverlayObjectMatch[1]);
    if (!isOverlayId(overlayId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const parsed = parseOverlayId(overlayId);
    if (!parsed.ok) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId || accountId !== parsed.value.accountPublicId) {
      return respondValidation(respond, 'tokyo.errors.render.invalid', accountId ? 403 : 422);
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
    try {
      const object = await readOverlayObject({ env, overlayId });
      if (!object) {
        return respond(json({ error: { kind: 'NOT_FOUND', reasonKey: 'tokyo.overlay.notFound' } }, { status: 404 }));
      }
      return respond(json({ ok: true, overlayId, ...object }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return respond(json({ error: { kind: 'VALIDATION', reasonKey: detail, detail } }, { status: 422 }));
    }
  }

  if (pathname === '/__internal/renders/widgets/serve-state.json') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId) {
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

    const body = (await readInternalRenderJsonBody({
      req,
      env,
      boundary: 'internal.render.serveState.body',
      accountId,
    })) as Record<string, unknown> | null;
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
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId) {
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

  if (pathname === '/__internal/renders/widgets/catalog.json') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'GET') {
      return respondMethodNotAllowed(respond);
    }
    const authErr = await authorizeRomaAccountScopedRequest({
      req,
      env,
      accountId,
      minRole: 'viewer',
    });
    if (authErr) return respond(authErr);
    return respond(json({ ok: true, widgets: listWidgetCatalogEntries() }));
  }

  if (pathname === '/__internal/renders/widgets/index/rebuild.json') {
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }

    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    try {
      const index = await rebuildAccountInstanceIndexes(env, accountId);
      return respond(
        json({
          ok: true,
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
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!accountId) {
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

    const rawBody = await readInternalRenderJsonBody({
      req,
      env,
      boundary: 'internal.render.create.body',
      accountId,
    });
    if (!isRecord(rawBody)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    const body = rawBody;
    const widgetType = typeof body.widgetType === 'string' ? body.widgetType.trim() : '';
    if (!widgetType) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }

    try {
      const created = await createAccountInstanceFromDefaults({
        env,
        accountId,
        widgetType,
        displayName: body.displayName,
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
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    const body = (await readInternalRenderJsonBody({
      req,
      env,
      boundary: 'internal.render.save.body',
      instanceId,
      accountId,
    })) as Record<string, unknown> | null;
    if (!isRecord(body) || !isRecord(body.config)) {
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
      });
      return respond(
        json({
          ok: true,
          instanceId,
          widgetType: result.pointer.widgetType,
          sourceVersion: result.pointer.sourceVersion,
          generation: result.pointer.generation,
          live: result.live,
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
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!isValidScopedInstance(sourceInstanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    try {
      const duplicated = await duplicateAccountInstanceTransition({
        env,
        accountId,
        sourceInstanceId: sourceInstanceId!,
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
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
    if (!isValidScopedInstance(instanceId, accountId)) {
      return respondValidation(respond, 'tokyo.errors.render.invalid');
    }
    if (req.method !== 'POST') {
      return respondMethodNotAllowed(respond);
    }
    const auth = await authorizeRomaEditorTransition({ req, env, accountId });
    if (!auth.ok) return respond(auth.response);

    try {
      const published = await publishAccountInstanceTransition({
        env,
        accountId,
        instanceId: instanceId!,
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
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
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

  const internalRenderSavedMatch = pathname.match(
    /^\/__internal\/renders\/widgets\/([^/]+)\/saved\.json$/,
  );
  if (internalRenderSavedMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalRenderSavedMatch[1]));
    const accountId = normalizeAccountPublicId(req.headers.get('x-account-id'));
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
      const rawBody = await readInternalRenderJsonBody({
        req,
        env,
        boundary: 'internal.render.savedWrite.body',
        instanceId,
        accountId,
      });
      if (!isRecord(rawBody)) {
        return respondValidation(respond, 'tokyo.errors.render.invalid');
      }
      const body = rawBody;
      if (typeof body.widgetType !== 'string' || !isRecord(body.config)) {
        return respondValidation(respond, 'tokyo.errors.render.invalid');
      }
      const savedWrite = await writeSavedRenderConfig({
        env,
        instanceId: instanceId!,
        accountId,
        widgetType: body.widgetType as string,
        config: body.config as Record<string, unknown>,
        displayName: body.displayName,
        meta: body.meta,
      });
      return respond(
        json({
          ...savedWrite.pointer,
          config: body?.config,
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

  return null;
}
