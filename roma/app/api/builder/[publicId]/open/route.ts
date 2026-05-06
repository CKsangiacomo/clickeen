import { NextRequest, NextResponse } from 'next/server';
import { loadBuilderOpenEnvelope } from '@roma/lib/builder-open';
import { resolveAccountCopilotRuntimeUi } from '@roma/lib/ai/account-copilot';
import { resolveCurrentAccountRouteContext, withSession } from '@roma/lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const { publicId: publicIdRaw } = await context.params;
  const publicId = String(publicIdRaw || '').trim();
  if (!publicId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const result = await loadBuilderOpenEnvelope({
    accountId: current.value.authzPayload.accountId,
    publicId,
    accountCapsule: current.value.authzToken,
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
