import { resolvePolicy } from '@clickeen/ck-policy';
import { NextRequest, NextResponse } from 'next/server';
import { enforceActiveLocaleEntitlement } from '@roma/lib/account-locale-entitlements';
import {
  generateAccountInstanceTranslations,
  type TranslationAgentActivityEvent,
} from '@roma/lib/account-instance-translations';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

function sendEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, payload: unknown) {
  try {
    controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
  } catch {
    // Activity transport is not translation truth.
  }
}

function streamTranslations(args: {
  accountId: string;
  instanceId: string;
  baseLocale: string;
  activeLocales: string[];
  authz: Parameters<typeof generateAccountInstanceTranslations>[0]['authz'];
  accountCapsule: string;
  requestId: string;
}) {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let settled = false;
      const finish = (status: number, payload: unknown) => {
        if (settled) return;
        settled = true;
        sendEvent(controller, 'result', { status, payload });
        try { controller.close(); } catch { /* client closed */ }
      };
      try {
        const generated = await generateAccountInstanceTranslations({
          ...args,
          onActivity: (event: TranslationAgentActivityEvent) => sendEvent(controller, 'activity', event),
        });
        finish(generated.status, generated.ok ? generated.value : { error: generated.error });
      } catch (error) {
        finish(500, { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.translation.failed', detail: error instanceof Error ? error.message : String(error) } });
      }
    },
  });
  return new NextResponse(stream, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const instanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof instanceId !== 'string') {
    return withSession(request, NextResponse.json({ error: instanceId.error }, { status: instanceId.status }), current.value.setCookies);
  }

  const locales = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId: current.value.authzPayload.accountId,
    requestId: current.value.requestId,
  });
  if (!locales.ok) {
    return withSession(request, NextResponse.json(locales.payload ?? { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.auth.contextUnavailable', detail: locales.detail } }, { status: locales.status }), current.value.setCookies);
  }
  const baseLocale = locales.localePolicy.baseLocale;
  const activeLocales = locales.activeLocales.filter((locale) => locale !== baseLocale);
  const entitlement = enforceActiveLocaleEntitlement(resolvePolicy({ profile: current.value.authzPayload.profile, role: current.value.authzPayload.role }), activeLocales);
  if (entitlement) return withSession(request, entitlement, current.value.setCookies);

  const args = {
    accountId: current.value.authzPayload.accountPublicId,
    instanceId,
    baseLocale,
    activeLocales,
    authz: current.value.authzPayload,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  };
  if (request.headers.get('accept')?.includes('text/event-stream')) {
    return withSession(request, streamTranslations(args), current.value.setCookies);
  }
  const generated = await generateAccountInstanceTranslations(args);
  return withSession(request, generated.ok
    ? NextResponse.json(generated.value, { status: generated.status })
    : NextResponse.json({ error: generated.error }, { status: generated.status }), current.value.setCookies);
}
