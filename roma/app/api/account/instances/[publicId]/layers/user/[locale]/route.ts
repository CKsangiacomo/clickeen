import { NextRequest, NextResponse } from 'next/server';
import type { LocalizationOp } from '@clickeen/ck-contracts';
import {
  deleteAccountUserLayer,
  upsertAccountUserLayer,
} from '@roma/lib/account-localization-control';
import { resolveCurrentAccountRouteContext, withSession } from '../../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string; locale: string }> };

async function resolveRouteContext(
  request: NextRequest,
  context: RouteContext,
  minRole: 'editor' | 'viewer',
) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole });
  if (!current.ok) return { ok: false as const, response: current.response };

  const { publicId: publicIdRaw, locale: localeRaw } = await context.params;
  const publicId = String(publicIdRaw || '').trim();
  const locale = String(localeRaw || '').trim().toLowerCase();
  if (!publicId || !locale) {
    return {
      ok: false as const,
      response: withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
          { status: 422 },
        ),
        current.value.setCookies,
      ),
    };
  }

  return {
    ok: true as const,
    current,
    accountId: current.value.authzPayload.accountId,
    publicId,
    locale,
  };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const resolved = await resolveRouteContext(request, context, 'editor');
  if (!resolved.ok) return resolved.response;

  let body: { ops?: unknown } | null = null;
  try {
    body = (await request.json()) as { ops?: unknown } | null;
  } catch {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
        { status: 422 },
      ),
      resolved.current.value.setCookies,
    );
  }

  try {
    if (!Array.isArray(body?.ops)) {
      return withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
          { status: 422 },
        ),
        resolved.current.value.setCookies,
      );
    }

    const payload = await upsertAccountUserLayer({
      accessToken: resolved.current.value.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      locale: resolved.locale,
      ops: body.ops as LocalizationOp[],
      accountCapsule: resolved.current.value.authzToken,
    });

    return withSession(
      request,
      NextResponse.json(payload),
      resolved.current.value.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail,
          },
        },
        { status: 502 },
      ),
      resolved.current.value.setCookies,
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const resolved = await resolveRouteContext(request, context, 'editor');
  if (!resolved.ok) return resolved.response;

  try {
    const payload = await deleteAccountUserLayer({
      accessToken: resolved.current.value.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      locale: resolved.locale,
      accountCapsule: resolved.current.value.authzToken,
    });

    return withSession(
      request,
      NextResponse.json(payload),
      resolved.current.value.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail,
          },
        },
        { status: 502 },
      ),
      resolved.current.value.setCookies,
    );
  }
}
