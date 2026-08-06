import type { AccountPageSource } from '@clickeen/ck-contracts/pages';
import { isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { NextRequest, NextResponse } from 'next/server';
import { parseAccountPageSource } from '@roma/lib/account-page-contract';
import { deleteAccountPage, readAccountPage, saveAccountPage } from '@roma/lib/account-pages';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../_lib/current-account-route';

export const runtime = 'edge';
type RouteContext = { params: Promise<{ pageId: string }> };

async function pageIdFrom(context: RouteContext): Promise<string | null> {
  const { pageId } = await context.params;
  return isCompactPageId(pageId) ? pageId : null;
}

function invalidPageId(request: NextRequest, setCookies?: Parameters<typeof withSession>[2]) {
  return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.invalidPageId' } }, { status: 422 }), setCookies);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;
  const pageId = await pageIdFrom(context);
  if (!pageId) return invalidPageId(request, current.value.setCookies);
  const result = await readAccountPage({ accountId: current.value.authzPayload.accountPublicId, pageId, accountCapsule: current.value.authzToken, requestId: current.value.requestId });
  return withSession(request, result.ok ? NextResponse.json({ source: result.value.source }) : NextResponse.json({ error: result.error }, { status: result.status }), current.value.setCookies);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const pageId = await pageIdFrom(context);
  if (!pageId) return invalidPageId(request, current.value.setCookies);
  const bodyResult = await readJsonPayloadOrValidation<{ source?: unknown } | null>(request);
  if (!bodyResult.ok) return withSession(request, NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }), current.value.setCookies);
  const submitted = parseAccountPageSource(bodyResult.payload?.source, pageId);
  if (!submitted) return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.sourceInvalid' } }, { status: 422 }), current.value.setCookies);

  let source: AccountPageSource = submitted;
  if (!submitted.isTemplate) {
    const locales = await loadCurrentAccountLocalesState({
      accessToken: current.value.accessToken,
      accountId: current.value.authzPayload.accountId,
      requestId: current.value.requestId,
    });
    if (!locales.ok) return withSession(request, NextResponse.json(locales.payload ?? { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.auth.contextUnavailable', detail: locales.detail } }, { status: locales.status }), current.value.setCookies);
    source = { ...submitted, baseLocale: locales.localePolicy.baseLocale };
  }
  const result = await saveAccountPage({ accountId: current.value.authzPayload.accountPublicId, pageId, source, accountCapsule: current.value.authzToken, requestId: current.value.requestId });
  return withSession(request, result.ok ? NextResponse.json({ source: result.value.source }) : NextResponse.json({ error: result.error }, { status: result.status }), current.value.setCookies);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const pageId = await pageIdFrom(context);
  if (!pageId) return invalidPageId(request, current.value.setCookies);
  const result = await deleteAccountPage({ accountId: current.value.authzPayload.accountPublicId, pageId, accountCapsule: current.value.authzToken, requestId: current.value.requestId });
  return withSession(request, result.ok ? NextResponse.json({ ok: true, pageId }) : NextResponse.json({ error: result.error }, { status: result.status }), current.value.setCookies);
}
