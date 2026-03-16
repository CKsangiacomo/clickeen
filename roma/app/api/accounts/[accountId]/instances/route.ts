import { after, NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '@roma/lib/account-authz-capsule';
import {
  applySessionCookies,
  resolveSessionBearer,
  type SessionCookieSpec,
} from '@roma/lib/auth/session';
import { createAccountInstance } from '@roma/lib/account-instance-create';
import { runAccountSaveAftermath } from '@roma/lib/account-save-aftermath';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string }> };

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

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
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

  let body: Record<string, unknown> | null = null;
  try {
    const parsed = (await request.json()) as unknown;
    body = isRecord(parsed) ? parsed : null;
  } catch {
    body = null;
  }
  if (!body) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const publicId = asTrimmedString(body.publicId);
  const widgetType = asTrimmedString(body.widgetType);
  if (!publicId || !widgetType || !isRecord(body.config)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const status = asTrimmedString(body.status);
  if (status && status !== 'unpublished') {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.payload.invalid',
            detail: 'published_create_not_supported',
          },
        },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const created = await createAccountInstance({
    accountId,
    publicId,
    widgetType,
    config: body.config,
    accessToken: session.accessToken,
    authz: authz.payload,
  });
  if (!created.ok) {
    return withSession(
      request,
      NextResponse.json({ error: created.error }, { status: created.status }),
      session.setCookies,
    );
  }

  after(async () => {
    try {
      await runAccountSaveAftermath({
        accessToken: session.accessToken,
        accountId,
        publicId: created.value.publicId,
        previousConfig: null,
      });
    } catch (error) {
      console.error('[roma instances create route] create aftermath failed', {
        publicId: created.value.publicId,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return withSession(
    request,
    NextResponse.json(
      {
        accountId,
        publicId: created.value.publicId,
        widgetType: created.value.widgetType,
        status: created.value.status,
        source: created.value.source,
      },
      { status: 201 },
    ),
    session.setCookies,
  );
}
