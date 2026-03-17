import { after, NextRequest, NextResponse } from 'next/server';
import {
  loadTokyoPreferredAccountInstance,
  saveAccountInstanceDirect,
  validatePersistableConfig,
} from '@roma/lib/account-instance-direct';
import { authorizeRequestAccountRoleFromCapsule } from '@roma/lib/account-authz-capsule';
import { runAccountSaveAftermath } from '@roma/lib/account-save-aftermath';
import {
  applySessionCookies,
  resolveSessionBearer,
  type SessionCookieSpec,
} from '@roma/lib/auth/session';
import { resolveTokyoBaseUrl } from '@roma/lib/env/tokyo';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string }> };

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  return withNoStore(applySessionCookies(response, request, setCookies));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw, publicId: publicIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  const publicId = String(publicIdRaw || '').trim();
  if (!isUuid(accountId)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }
  if (!publicId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId,
    minRole: 'viewer',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  const result = await loadTokyoPreferredAccountInstance({
    accountId,
    publicId,
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    tokyoAccessToken: session.accessToken,
    accountCapsule: authz.token,
  });

  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      session.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      publicId: result.value.row.publicId,
      displayName: result.value.row.displayName || 'Untitled widget',
      ownerAccountId: result.value.row.accountId,
      widgetType: result.value.row.widgetType,
      status: result.value.row.status,
      config: result.value.config,
    }),
    session.setCookies,
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw, publicId: publicIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  const publicId = String(publicIdRaw || '').trim();
  if (!isUuid(accountId)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }
  if (!publicId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId,
    minRole: 'editor',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  let body: { config?: unknown } | null = null;
  try {
    body = (await request.json()) as { config?: unknown } | null;
  } catch {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const validatedConfig = validatePersistableConfig(body?.config, accountId);
  if (!validatedConfig.ok) {
    return withSession(
      request,
      NextResponse.json({ error: validatedConfig.error }, { status: validatedConfig.status }),
      session.setCookies,
    );
  }

  const result = await saveAccountInstanceDirect({
    accountId,
    publicId,
    config: validatedConfig.value.config,
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    tokyoAccessToken: session.accessToken,
    accountCapsule: authz.token,
  });

  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      session.setCookies,
    );
  }

  if (result.value.changed) {
    after(async () => {
      try {
        await runAccountSaveAftermath({
          accessToken: session.accessToken,
          accountId,
          publicId,
          policyProfile: authz.payload.profile,
          accountCapsule: authz.token,
          previousConfig: result.value.previousConfig,
        });
      } catch (error) {
        console.error('[roma account instance route] save aftermath failed', {
          publicId,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  return withSession(
    request,
    NextResponse.json({ config: result.value.config, aftermath: null }),
    session.setCookies,
  );
}
