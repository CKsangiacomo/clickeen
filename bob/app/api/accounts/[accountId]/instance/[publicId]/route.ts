import { isUuid } from '@clickeen/ck-contracts';
import { after, NextRequest, NextResponse } from 'next/server';
import {
  loadTokyoPreferredAccountInstance,
  runParisSaveAftermath,
  saveAccountInstanceDirect,
  validatePersistableConfig,
} from '../../../../../../lib/account-instance-direct';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../../lib/account-authz-capsule';
import { resolveCorsHeaders } from '../../../../../../lib/api/cors';
import {
  resolveParisSession,
  withSessionAndCors,
} from '../../../../../../lib/api/paris/proxy-helpers';
import { resolveParisBaseUrl } from '../../../../../../lib/env/paris';
import { resolveTokyoBaseUrl } from '../../../../../../lib/env/tokyo';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string }> };

function validateParams(
  request: NextRequest,
  accountIdRaw: string,
  publicIdRaw: string,
): { ok: true; accountId: string; publicId: string } | { ok: false; response: NextResponse } {
  const corsHeaders = resolveCorsHeaders(request, 'GET,PUT,OPTIONS');
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
  const publicId = String(publicIdRaw || '').trim();
  if (!publicId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
        { status: 422, headers: corsHeaders },
      ),
    };
  }
  return { ok: true, accountId, publicId };
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { accountId: accountIdRaw, publicId: publicIdRaw } = await context.params;
  const validated = validateParams(request, accountIdRaw, publicIdRaw);
  if (!validated.ok) return validated.response;

  const session = await resolveParisSession(request);
  if (!session.ok) {
    return withSessionAndCors(
      request,
      session.response,
      undefined,
      resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
    );
  }

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId: validated.accountId,
    minRole: 'viewer',
  });
  if (!authz.ok) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: authz.error },
        { status: authz.status, headers: resolveCorsHeaders(request, 'GET,PUT,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
    );
  }

  const tokyoAccessToken = session.accessToken;
  const result = await loadTokyoPreferredAccountInstance({
    accountId: validated.accountId,
    publicId: validated.publicId,
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    tokyoAccessToken,
  });

  if (!result.ok) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        {
          error: result.error,
        },
        { status: result.status, headers: resolveCorsHeaders(request, 'GET,PUT,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
    );
  }

  return withSessionAndCors(
    request,
    NextResponse.json(
      {
        publicId: result.value.row.publicId,
        displayName: result.value.row.displayName || 'Untitled widget',
        ownerAccountId: result.value.row.accountId,
        widgetType: result.value.row.widgetType,
        status: result.value.row.status,
        meta: result.value.row.meta,
        config: result.value.config,
      },
      { status: 200, headers: resolveCorsHeaders(request, 'GET,PUT,OPTIONS') },
    ),
    session.setCookies,
    resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { accountId: accountIdRaw, publicId: publicIdRaw } = await context.params;
  const validated = validateParams(request, accountIdRaw, publicIdRaw);
  if (!validated.ok) return validated.response;

  const session = await resolveParisSession(request);
  if (!session.ok) {
    return withSessionAndCors(
      request,
      session.response,
      undefined,
      resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
    );
  }

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId: validated.accountId,
    minRole: 'editor',
  });
  if (!authz.ok) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: authz.error },
        { status: authz.status, headers: resolveCorsHeaders(request, 'GET,PUT,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
    );
  }

  let body: { config?: unknown } | null = null;
  try {
    body = (await request.json()) as { config?: unknown } | null;
  } catch {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
        { status: 422, headers: resolveCorsHeaders(request, 'GET,PUT,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
    );
  }

  const validatedConfig = validatePersistableConfig(body?.config, validated.accountId);
  if (!validatedConfig.ok) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: validatedConfig.error },
        { status: validatedConfig.status, headers: resolveCorsHeaders(request, 'GET,PUT,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
    );
  }

  const tokyoAccessToken = session.accessToken;
  const result = await saveAccountInstanceDirect({
    accountId: validated.accountId,
    publicId: validated.publicId,
    config: validatedConfig.value.config,
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    tokyoAccessToken,
  });

  if (!result.ok) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: result.error },
        { status: result.status, headers: resolveCorsHeaders(request, 'GET,PUT,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
    );
  }

  if (result.value.changed) {
    after(async () => {
      try {
        const warning = await runParisSaveAftermath({
          parisBaseUrl: resolveParisBaseUrl(),
          parisAccessToken: session.accessToken,
          authzCapsule: request.headers.get('x-ck-authz-capsule'),
          accountId: validated.accountId,
          publicId: validated.publicId,
          previousConfig: result.value.previousConfig,
          instance: result.value.instance,
          published: result.value.published,
        });
        if (warning && process.env.NODE_ENV === 'development') {
          console.warn('[bob account instance route] save aftermath warning', {
            publicId: validated.publicId,
            detail: warning.error.detail || warning.error.reasonKey,
          });
        }
      } catch (error) {
        console.error('[bob account instance route] save aftermath failed', {
          publicId: validated.publicId,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  return withSessionAndCors(
    request,
    NextResponse.json(
      { config: result.value.config, aftermath: null },
      { status: 200, headers: resolveCorsHeaders(request, 'GET,PUT,OPTIONS') },
    ),
    session.setCookies,
    resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
  );
}
