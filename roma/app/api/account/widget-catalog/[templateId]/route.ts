import { isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { NextRequest, NextResponse } from 'next/server';
import { readWidgetCatalogTemplate } from '@roma/lib/account-catalog';
import { resolveCurrentAccountRouteContext, withSession } from '../../_lib/current-account-route';

export const runtime = 'edge';

export async function GET(request: NextRequest, context: { params: Promise<{ templateId: string }> }) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;
  const { templateId } = await context.params;
  if (!isCompactInstanceId(templateId)) return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.invalidPayload' } }, { status: 422 }), current.value.setCookies);
  const result = await readWidgetCatalogTemplate({ accountId: current.value.authzPayload.accountPublicId, accountCapsule: current.value.authzToken, requestId: current.value.requestId, templateId });
  return withSession(request, result.ok ? NextResponse.json(result.value) : NextResponse.json({ error: result.error }, { status: result.status }), current.value.setCookies);
}
