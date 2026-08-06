import type { TranslationTarget } from '@clickeen/ck-contracts/translations';
import { isCompactInstanceId, isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { resolvePolicy } from '@clickeen/ck-policy';
import { NextRequest, NextResponse } from 'next/server';
import { generateAccountTranslations, type TranslationAgentActivityEvent } from '@roma/lib/account-instance-translations';
import { enforceActiveLocaleEntitlement } from '@roma/lib/account-locale-entitlements';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../_lib/current-account-route';

export const runtime = 'edge';

function parseTarget(raw: unknown): TranslationTarget | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || typeof value.id !== 'string') return null;
  if (value.kind === 'instance' && isCompactInstanceId(value.id)) return { kind: 'instance', id: value.id };
  if (value.kind === 'page' && isCompactPageId(value.id)) return { kind: 'page', id: value.id };
  return null;
}

function sendEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, payload: unknown) {
  try {
    controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
  } catch {
    // Activity transport is not translation truth.
  }
}

function streamTranslations(args: {
  accountId: string;
  target: TranslationTarget;
  baseLocale: string;
  activeLocales: string[];
  authz: Parameters<typeof generateAccountTranslations>[0]['authz'];
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
        const generated = await generateAccountTranslations({
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

export async function POST(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const body = await readJsonPayloadOrValidation<{ target?: unknown } | null>(request);
  if (!body.ok) return withSession(request, NextResponse.json({ error: body.error }, { status: body.status }), current.value.setCookies);
  const target = parseTarget(body.payload?.target);
  if (!target) return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } }, { status: 422 }), current.value.setCookies);

  const locales = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId: current.value.authzPayload.accountId,
    requestId: current.value.requestId,
  });
  if (!locales.ok) return withSession(request, NextResponse.json(locales.payload ?? { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'coreui.errors.auth.contextUnavailable', detail: locales.detail } }, { status: locales.status }), current.value.setCookies);
  const baseLocale = locales.localePolicy.baseLocale;
  const activeLocales = locales.activeLocales.filter((locale) => locale !== baseLocale);
  const entitlement = enforceActiveLocaleEntitlement(resolvePolicy({ profile: current.value.authzPayload.profile, role: current.value.authzPayload.role }), activeLocales);
  if (entitlement) return withSession(request, entitlement, current.value.setCookies);

  const args = {
    accountId: current.value.authzPayload.accountPublicId,
    target,
    baseLocale,
    activeLocales,
    authz: current.value.authzPayload,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  };
  if (request.headers.get('accept')?.includes('text/event-stream')) return withSession(request, streamTranslations(args), current.value.setCookies);
  const generated = await generateAccountTranslations(args);
  return withSession(request, generated.ok ? NextResponse.json(generated.value, { status: generated.status }) : NextResponse.json({ error: generated.error }, { status: generated.status }), current.value.setCookies);
}
