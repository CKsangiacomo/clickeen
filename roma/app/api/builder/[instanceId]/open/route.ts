import { NextRequest, NextResponse } from 'next/server';
import { loadBuilderOpenEnvelope } from '@roma/lib/builder-open';
import { resolveAccountCopilotRuntimeUi } from '@roma/lib/ai/account-copilot';
import { resolveCurrentAccountRouteContext, withSession } from '@roma/lib/current-account-route';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const instanceId = await requireInstanceIdParam(context);
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json(
        { error: instanceId.error },
        { status: instanceId.status },
      ),
      current.value.setCookies,
    );
  }

  const result = await loadBuilderOpenEnvelope({
    accountId: current.value.authzPayload.accountId,
    instanceId,
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
