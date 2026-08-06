import { isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { NextRequest, NextResponse } from 'next/server';
import { publishAccountPage, readAccountPage } from '@roma/lib/account-pages';
import { resolvePageProductPolicy } from '@roma/lib/account-page-policy';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';
type RouteContext = { params: Promise<{ pageId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const access = resolvePageProductPolicy(current.value.authzPayload, 'publish_page');
  if (!access.ok) {
    return withSession(request, NextResponse.json(access.payload, { status: access.status }), current.value.setCookies);
  }
  const { pageId } = await context.params;
  if (!isCompactPageId(pageId)) {
    return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.invalidPageId' } }, { status: 422 }), current.value.setCookies);
  }
  const accountId = current.value.authzPayload.accountPublicId;
  const [page, locales] = await Promise.all([
    readAccountPage({
      accountId,
      pageId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    }),
    loadCurrentAccountLocalesState({
      accessToken: current.value.accessToken,
      accountId: current.value.authzPayload.accountId,
      requestId: current.value.requestId,
    }),
  ]);
  if (!page.ok) {
    return withSession(
      request,
      NextResponse.json({ error: page.error }, { status: page.status }),
      current.value.setCookies,
    );
  }
  if (!('overlaysJson' in page.value)) {
    return withSession(
      request,
      NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.publishInvalid' } }, { status: 422 }),
      current.value.setCookies,
    );
  }
  if (!locales.ok) {
    return withSession(
      request,
      NextResponse.json(locales.payload ?? {
        error: {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'coreui.errors.auth.contextUnavailable',
          detail: locales.detail,
        },
      }, { status: locales.status }),
      current.value.setCookies,
    );
  }
  const savedLocales = new Set([
    page.value.source.baseLocale,
    ...Object.keys(page.value.overlaysJson),
  ]);
  const requiredLocales = Array.from(new Set([
    locales.localePolicy.baseLocale,
    ...locales.activeLocales,
  ]));
  const missingLocales = requiredLocales.filter((locale) => !savedLocales.has(locale));
  if (missingLocales.length > 0) {
    return withSession(
      request,
      NextResponse.json({
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.page.localesIncomplete',
          paths: missingLocales.map((locale) => `locales.${locale}`),
        },
      }, { status: 422 }),
      current.value.setCookies,
    );
  }
  const result = await publishAccountPage({
    accountId,
    pageId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  return withSession(
    request,
    result.ok ? NextResponse.json({ ok: true, ...result.value }) : NextResponse.json({ error: result.error }, { status: result.status }),
    current.value.setCookies,
  );
}
