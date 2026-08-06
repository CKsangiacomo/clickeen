import { isRecord } from '@clickeen/ck-contracts';
import { parseCatalogPresentation } from '@clickeen/ck-contracts/catalog';
import { isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { NextRequest, NextResponse } from 'next/server';
import { parseAccountPageSource } from '@roma/lib/account-page-contract';
import { resolvePageProductPolicy, type PageProductAction } from '@roma/lib/account-page-policy';
import {
  deleteAccountPage,
  readAccountPage,
  saveAccountPage,
  type PageGeneratedFiles,
  type PageServingOverlays,
} from '@roma/lib/account-pages';
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

function parseGeneratedFiles(raw: unknown): PageGeneratedFiles | null {
  if (!isRecord(raw)) return null;
  return typeof raw.indexHtml === 'string' &&
    typeof raw.stylesCss === 'string' &&
    typeof raw.runtimeJs === 'string'
    ? { indexHtml: raw.indexHtml, stylesCss: raw.stylesCss, runtimeJs: raw.runtimeJs }
    : null;
}

function pageAccess(
  request: NextRequest,
  current: Awaited<ReturnType<typeof resolveCurrentAccountRouteContext>> & { ok: true },
  action: PageProductAction,
) {
  const access = resolvePageProductPolicy(current.value.authzPayload, action);
  return access.ok
    ? null
    : withSession(request, NextResponse.json(access.payload, { status: access.status }), current.value.setCookies);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;
  const denied = pageAccess(request, current, 'open_page');
  if (denied) return denied;
  const pageId = await pageIdFrom(context);
  if (!pageId) return invalidPageId(request, current.value.setCookies);
  const result = await readAccountPage({ accountId: current.value.authzPayload.accountPublicId, pageId, accountCapsule: current.value.authzToken, requestId: current.value.requestId });
  return withSession(request, result.ok ? NextResponse.json(result.value) : NextResponse.json({ error: result.error }, { status: result.status }), current.value.setCookies);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  if (current.value.authzPayload.accountPublicId !== 'CLICKEEN') {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.accountForbidden' } },
        { status: 403 },
      ),
      current.value.setCookies,
    );
  }
  const denied = pageAccess(request, current, 'save_page');
  if (denied) return denied;
  const pageId = await pageIdFrom(context);
  if (!pageId) return invalidPageId(request, current.value.setCookies);
  const body = await readJsonPayloadOrValidation<unknown>(request);
  if (!body.ok) {
    return withSession(
      request,
      NextResponse.json({ error: body.error }, { status: body.status }),
      current.value.setCookies,
    );
  }
  const catalogPresentation = isRecord(body.payload) && Object.keys(body.payload).length === 1
    ? parseCatalogPresentation(body.payload.catalogPresentation)
    : null;
  if (!catalogPresentation) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const existing = await readAccountPage({
    accountId: 'CLICKEEN',
    pageId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!existing.ok) {
    return withSession(
      request,
      NextResponse.json({ error: existing.error }, { status: existing.status }),
      current.value.setCookies,
    );
  }
  if (!existing.value.source.isTemplate) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.sourceInvalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const saved = await saveAccountPage({
    accountId: 'CLICKEEN',
    pageId,
    source: { ...existing.value.source, catalogPresentation },
    files: existing.value.files,
    operation: 'save',
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  return withSession(
    request,
    saved.ok
      ? NextResponse.json({ ok: true, templateId: pageId, catalogPresentation })
      : NextResponse.json({ error: saved.error }, { status: saved.status }),
    current.value.setCookies,
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const denied = pageAccess(request, current, 'save_page');
  if (denied) return denied;
  const pageId = await pageIdFrom(context);
  if (!pageId) return invalidPageId(request, current.value.setCookies);
  const bodyResult = await readJsonPayloadOrValidation<{
    source?: unknown;
    files?: unknown;
    overlaysJson?: unknown;
    operation?: unknown;
  } | null>(request);
  if (!bodyResult.ok) return withSession(request, NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }), current.value.setCookies);
  const submitted = parseAccountPageSource(bodyResult.payload?.source, pageId);
  const files = parseGeneratedFiles(bodyResult.payload?.files);
  const overlaysJson = bodyResult.payload?.overlaysJson;
  const operation = bodyResult.payload?.operation;
  if (
    !submitted ||
    !files ||
    (!submitted.isTemplate && !isRecord(overlaysJson)) ||
    (operation !== 'save' && operation !== 'update')
  ) return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.sourceInvalid' } }, { status: 422 }), current.value.setCookies);

  if (submitted.isTemplate && current.value.authzPayload.accountPublicId === 'CLICKEEN' && !submitted.catalogPresentation) {
    return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.sourceInvalid' } }, { status: 422 }), current.value.setCookies);
  }

  if (!submitted.isTemplate) {
    const locales = await loadCurrentAccountLocalesState({
      accessToken: current.value.accessToken,
      accountId: current.value.authzPayload.accountId,
      requestId: current.value.requestId,
    });
    if (!locales.ok) return withSession(request, NextResponse.json(locales.payload ?? { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.auth.contextUnavailable', detail: locales.detail } }, { status: locales.status }), current.value.setCookies);
    if (submitted.baseLocale !== locales.localePolicy.baseLocale) {
      return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.sourceInvalid' } }, { status: 422 }), current.value.setCookies);
    }
  }
  const result = await saveAccountPage({
    accountId: current.value.authzPayload.accountPublicId,
    pageId,
    source: submitted,
    files,
    ...(!submitted.isTemplate ? { overlaysJson: overlaysJson as PageServingOverlays } : {}),
    operation,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  return withSession(request, result.ok ? NextResponse.json(result.value) : NextResponse.json({ error: result.error }, { status: result.status }), current.value.setCookies);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const denied = pageAccess(request, current, 'delete_page');
  if (denied) return denied;
  const pageId = await pageIdFrom(context);
  if (!pageId) return invalidPageId(request, current.value.setCookies);
  const result = await deleteAccountPage({ accountId: current.value.authzPayload.accountPublicId, pageId, accountCapsule: current.value.authzToken, requestId: current.value.requestId });
  return withSession(request, result.ok ? NextResponse.json({ ok: true, pageId }) : NextResponse.json({ error: result.error }, { status: result.status }), current.value.setCookies);
}
