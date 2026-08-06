import { isRecord } from '@clickeen/ck-contracts';
import type { PageLocaleOverlay } from '@clickeen/ck-contracts/pages';
import { isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { NextRequest, NextResponse } from 'next/server';
import { resolvePageProductPolicy } from '@roma/lib/account-page-policy';
import {
  readAccountPageLocaleOverlay,
  writeAccountPageLocaleOverlay,
} from '@roma/lib/account-pages';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ pageId: string; locale: string }> };

async function coordinates(context: RouteContext): Promise<{ pageId: string; locale: string } | null> {
  const { pageId, locale } = await context.params;
  return isCompactPageId(pageId) && Boolean(locale) && locale === locale.trim()
    ? { pageId, locale }
    : null;
}

function validationResponse(request: NextRequest, setCookies: Parameters<typeof withSession>[2]) {
  return withSession(
    request,
    NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.overlayInvalid' } },
      { status: 422 },
    ),
    setCookies,
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;
  const access = resolvePageProductPolicy(current.value.authzPayload, 'open_page');
  if (!access.ok) {
    return withSession(
      request,
      NextResponse.json(access.payload, { status: access.status }),
      current.value.setCookies,
    );
  }
  const coordinate = await coordinates(context);
  if (!coordinate) return validationResponse(request, current.value.setCookies);
  const result = await readAccountPageLocaleOverlay({
    accountId: current.value.authzPayload.accountPublicId,
    pageId: coordinate.pageId,
    locale: coordinate.locale,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  return withSession(
    request,
    result.ok
      ? NextResponse.json(result.value)
      : NextResponse.json({ error: result.error }, { status: result.status }),
    current.value.setCookies,
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const access = resolvePageProductPolicy(current.value.authzPayload, 'save_page');
  if (!access.ok) {
    return withSession(
      request,
      NextResponse.json(access.payload, { status: access.status }),
      current.value.setCookies,
    );
  }
  const coordinate = await coordinates(context);
  if (!coordinate) return validationResponse(request, current.value.setCookies);
  const body = await readJsonPayloadOrValidation<unknown>(request);
  if (!body.ok) {
    return withSession(
      request,
      NextResponse.json({ error: body.error }, { status: body.status }),
      current.value.setCookies,
    );
  }
  if (
    !isRecord(body.payload) ||
    Object.keys(body.payload).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(body.payload, 'values') ||
    !isRecord(body.payload.values)
  ) return validationResponse(request, current.value.setCookies);
  const result = await writeAccountPageLocaleOverlay({
    accountId: current.value.authzPayload.accountPublicId,
    pageId: coordinate.pageId,
    locale: coordinate.locale,
    overlay: body.payload as PageLocaleOverlay,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  return withSession(
    request,
    result.ok
      ? NextResponse.json(result.value)
      : NextResponse.json({ error: result.error }, { status: result.status }),
    current.value.setCookies,
  );
}
