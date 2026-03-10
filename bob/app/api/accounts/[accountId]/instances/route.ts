import { classifyWidgetPublicId, isUuid } from '@clickeen/ck-contracts';
import { after, NextRequest, NextResponse } from 'next/server';
import {
  deleteSavedConfigFromTokyo,
  isRecord,
  runParisSaveAftermath,
  validatePersistableConfig,
  writeSavedConfigToTokyo,
} from '../../../../../lib/account-instance-direct';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../lib/account-authz-capsule';
import { resolveCorsHeaders } from '../../../../../lib/api/cors';
import {
  resolveParisSession,
  withSessionAndCors,
} from '../../../../../lib/api/paris/proxy-helpers';
import { resolveParisBaseUrl } from '../../../../../lib/env/paris';
import { resolveTokyoBaseUrl } from '../../../../../lib/env/tokyo';
import {
  createAccountInstanceRow,
  deleteAccountInstanceRow,
  isTrustedLocalDevAccessToken,
} from '../../../../../lib/michael';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string }> };

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function resolveTokyoAccessToken(accessToken: string): string {
  if (isTrustedLocalDevAccessToken(accessToken)) {
    const tokyoDevJwt = String(process.env.TOKYO_DEV_JWT || '').trim();
    if (!tokyoDevJwt) {
      throw new Error('tokyo_dev_jwt_missing');
    }
    return tokyoDevJwt;
  }
  return accessToken;
}

function validateAccountId(
  request: NextRequest,
  accountIdRaw: string,
): { ok: true; accountId: string } | { ok: false; response: NextResponse } {
  const corsHeaders = resolveCorsHeaders(request, 'POST,OPTIONS');
  const accountId = String(accountIdRaw || '').trim();
  if (!isUuid(accountId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422, headers: corsHeaders },
      ),
    };
  }
  return { ok: true, accountId };
}

async function rollbackDirectCreate(args: {
  accountId: string;
  publicId: string;
  tokyoAccessToken: string;
  accessToken: string;
}) {
  const [michaelRollback, tokyoRollback] = await Promise.allSettled([
    deleteAccountInstanceRow(args.accountId, args.publicId, args.accessToken),
    deleteSavedConfigFromTokyo({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      tokyoAccessToken: args.tokyoAccessToken,
      accountId: args.accountId,
      publicId: args.publicId,
    }),
  ]);

  if (michaelRollback.status === 'rejected' && process.env.NODE_ENV === 'development') {
    console.warn('[bob instances route] failed to rollback Michael row', michaelRollback.reason);
  }
  if (tokyoRollback.status === 'rejected' && process.env.NODE_ENV === 'development') {
    console.warn(
      '[bob instances route] failed to rollback Tokyo saved config',
      tokyoRollback.reason,
    );
  }
}

function misconfiguredResponse(
  request: NextRequest,
  sessionSetCookies: Parameters<typeof withSessionAndCors>[2],
  detail: string,
) {
  return withSessionAndCors(
    request,
    NextResponse.json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.misconfigured',
          detail,
        },
      },
      { status: 500, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
    ),
    sessionSetCookies,
    resolveCorsHeaders(request, 'POST,OPTIONS'),
  );
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: resolveCorsHeaders(request, 'POST,OPTIONS'),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { accountId: accountIdRaw } = await context.params;
  const validated = validateAccountId(request, accountIdRaw);
  if (!validated.ok) return validated.response;

  const session = await resolveParisSession(request);
  if (!session.ok) {
    return withSessionAndCors(
      request,
      session.response,
      undefined,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId: validated.accountId,
    minRole: 'editor',
    allowBypass: () => isTrustedLocalDevAccessToken(session.accessToken),
  });
  if (!authz.ok) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: authz.error },
        { status: authz.status, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await request.json()) as Record<string, unknown> | null;
  } catch {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
        { status: 422, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  if (!isRecord(body)) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  const widgetType = asTrimmedString(body.widgetType);
  const publicId = asTrimmedString(body.publicId);
  const displayName =
    body.displayName === undefined ? undefined : asTrimmedString(body.displayName);
  const meta =
    body.meta === undefined
      ? undefined
      : body.meta === null
        ? null
        : isRecord(body.meta)
          ? body.meta
          : false;
  const requestedStatus = asTrimmedString(body.status);

  if (!widgetType || !/^[a-z0-9][a-z0-9_-]*$/.test(widgetType) || !publicId || meta === false) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  const publicIdKind = classifyWidgetPublicId(publicId);
  if (!publicIdKind) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  if (publicIdKind === 'user' && body.meta !== undefined) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  const normalizedStatus = publicIdKind === 'user' ? 'unpublished' : 'published';
  if (
    requestedStatus &&
    ((publicIdKind === 'user' && requestedStatus !== 'unpublished') ||
      (publicIdKind !== 'user' && requestedStatus !== 'published'))
  ) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  const validatedConfig = validatePersistableConfig(body.config, validated.accountId);
  if (!validatedConfig.ok) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: validatedConfig.error },
        { status: validatedConfig.status, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  let tokyoAccessToken = session.accessToken;
  try {
    tokyoAccessToken = resolveTokyoAccessToken(session.accessToken);
  } catch (error) {
    return misconfiguredResponse(
      request,
      session.setCookies,
      error instanceof Error ? error.message : String(error),
    );
  }

  const createdRow = await createAccountInstanceRow({
    accountId: validated.accountId,
    publicId,
    widgetType,
    config: validatedConfig.value.config,
    displayName,
    status: normalizedStatus,
    meta: meta && typeof meta === 'object' ? meta : null,
    berlinAccessToken: session.accessToken,
  });

  if (!createdRow.ok) {
    const status = createdRow.status === 401 ? 401 : createdRow.status;
    const kind =
      status === 401
        ? 'AUTH'
        : status === 403
          ? 'DENY'
          : status === 409
            ? 'VALIDATION'
            : status === 422
              ? 'VALIDATION'
              : 'UPSTREAM_UNAVAILABLE';
    return withSessionAndCors(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey: createdRow.reasonKey,
            detail: createdRow.detail,
          },
        },
        { status, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  if (!createdRow.row) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: 'instance_create_empty',
          },
        },
        { status: 500, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  const created = createdRow.row;

  try {
    await writeSavedConfigToTokyo({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      tokyoAccessToken,
      accountId: validated.accountId,
      publicId,
      widgetType: created.widgetType,
      config: validatedConfig.value.config,
      displayName: created.displayName,
      source: created.source,
      meta: created.meta ?? null,
    });
  } catch (error) {
    await rollbackDirectCreate({
      accountId: validated.accountId,
      publicId,
      tokyoAccessToken,
      accessToken: session.accessToken,
    });
    return withSessionAndCors(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: error instanceof Error ? error.message : String(error),
          },
        },
        { status: 502, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'POST,OPTIONS'),
    );
  }

  after(async () => {
    try {
      const warning = await runParisSaveAftermath({
        parisBaseUrl: resolveParisBaseUrl(),
        parisAccessToken: session.accessToken,
        authzCapsule: request.headers.get('x-ck-authz-capsule'),
        internalServiceName: isTrustedLocalDevAccessToken(session.accessToken) ? 'bob.local' : null,
        accountId: validated.accountId,
        publicId,
        previousConfig: {},
        instance: {
          widgetType: created.widgetType,
          status: created.status,
          source: created.source,
        },
        created: true,
        published: created.status === 'published',
      });
      if (warning && process.env.NODE_ENV === 'development') {
        console.warn('[bob instances route] create aftermath warning', {
          publicId,
          detail: warning.error.detail || warning.error.reasonKey,
        });
      }
    } catch (error) {
      console.error('[bob instances route] create aftermath failed', {
        publicId,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return withSessionAndCors(
    request,
    NextResponse.json(
      {
        publicId: created.publicId,
        widgetType: created.widgetType,
        displayName: created.displayName || 'Untitled widget',
        status: created.status,
        source: created.source,
        aftermath: null,
      },
      { status: 200, headers: resolveCorsHeaders(request, 'POST,OPTIONS') },
    ),
    session.setCookies,
    resolveCorsHeaders(request, 'POST,OPTIONS'),
  );
}
