import { NextRequest, NextResponse } from 'next/server';
import { resolvePolicy } from '@clickeen/ck-policy';
import {
  generateAccountInstanceTranslations,
  type TranslationAgentActivityEvent,
} from '@roma/lib/account-instance-translations';
import { enforceActiveLocaleEntitlement } from '@roma/lib/account-locale-entitlements';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };
function sendEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, payload: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
}

function streamGenerateTranslations(args: {
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

      const activity = (event: TranslationAgentActivityEvent) => sendEvent(controller, 'activity', event);
      const result = (status: number, payload: unknown) => {
        if (settled) return;
        settled = true;
        sendEvent(controller, 'result', { status, payload });
        controller.close();
      };

      try {
        if (!args.activeLocales.length) {
          result(200, {
            ok: true,
            translation: {
              ok: true,
              accepted: false,
              baseLocale: args.baseLocale,
              activeLocales: [],
              skippedLocales: [],
            },
          });
          return;
        }

        const generated = await generateAccountInstanceTranslations({
          accountId: args.accountId,
          instanceId: args.instanceId,
          baseLocale: args.baseLocale,
          activeLocales: args.activeLocales,
          authz: args.authz,
          accountCapsule: args.accountCapsule,
          requestId: args.requestId,
          onActivity: activity,
        });

        if (!generated.ok) {
          result(generated.status, {
            error: generated.error,
          });
          return;
        }

        if (!generated.value.translation.accepted) {
          result(200, generated.value);
          return;
        }

        result(200, generated.value);
      } catch (error) {
        result(500, {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.translation.failed',
            detail: error instanceof Error ? error.message : String(error),
          },
        });
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const instanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }

  const accountLocales = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId: current.value.authzPayload.accountId,
    requestId: current.value.requestId,
  });
  if (!accountLocales.ok) {
    return withSession(
      request,
      NextResponse.json(
        accountLocales.payload ?? {
          error: {
            kind: accountLocales.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
            reasonKey:
              accountLocales.status === 401
                ? 'coreui.errors.auth.required'
                : 'coreui.errors.auth.contextUnavailable',
            detail: accountLocales.detail,
          },
        },
        { status: accountLocales.status },
      ),
      current.value.setCookies,
    );
  }
  const baseLocale = accountLocales.localePolicy.baseLocale;
  const activeLocalesToGenerate = accountLocales.activeLocales.filter(
    (locale) => locale !== baseLocale,
  );
  const policy = resolvePolicy({
    profile: current.value.authzPayload.profile,
    role: current.value.authzPayload.role,
  });
  const entitlementGate = enforceActiveLocaleEntitlement(policy, activeLocalesToGenerate);
  if (entitlementGate) return withSession(request, entitlementGate, current.value.setCookies);

  if (request.headers.get('accept')?.includes('text/event-stream')) {
    return withSession(
      request,
      streamGenerateTranslations({
        accountId,
        instanceId,
        baseLocale,
        activeLocales: activeLocalesToGenerate,
        authz: current.value.authzPayload,
        accountCapsule: current.value.authzToken,
        requestId: current.value.requestId,
      }),
      current.value.setCookies,
    );
  }

  const generated = await generateAccountInstanceTranslations({
    accountId,
    instanceId,
    baseLocale,
    activeLocales: activeLocalesToGenerate,
    authz: current.value.authzPayload,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!generated.ok) {
    return withSession(
      request,
      NextResponse.json({ error: generated.error }, { status: generated.status }),
      current.value.setCookies,
    );
  }

  return withSession(request, NextResponse.json(generated.value, { status: generated.status }), current.value.setCookies);
}
