import { NextRequest, NextResponse } from 'next/server';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { resolveAccountCopilotRuntimeUi } from '@roma/lib/ai/account-copilot';
import { loadNewBuilderOpenEnvelope } from '@roma/lib/builder-open';
import { resolveCurrentAccountRouteContext, withSession } from '@roma/lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ widgetType: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const { widgetType: rawWidgetType } = await context.params;
  const widgetType = String(rawWidgetType || '').trim();
  const accountLocales = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId: current.value.authzPayload.accountId,
    requestId: current.value.requestId,
  });
  if (!accountLocales.ok) {
    return withSession(
      request,
      NextResponse.json(accountLocales.payload, { status: accountLocales.status }),
      current.value.setCookies,
    );
  }

  const result = await loadNewBuilderOpenEnvelope({
    accountId: current.value.authzPayload.accountPublicId,
    widgetType,
    baseLocale: accountLocales.localePolicy.baseLocale,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      ...result.value,
      copilot: resolveAccountCopilotRuntimeUi({ authz: current.value.authzPayload }),
    }),
    current.value.setCookies,
  );
}
