import { NextRequest, NextResponse } from 'next/server';
import {
  forwardCopilotOutcome,
  isValidCopilotOutcomePayload,
} from '@roma/lib/ai/account-copilot';
import { resolveCurrentAccountRouteContext, withSession } from '../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const { publicId: publicIdRaw } = await context.params;
  const publicId = String(publicIdRaw || '').trim();
  if (!publicId) {
    return withSession(
      request,
      NextResponse.json({ ok: false, message: 'Invalid publicId' }, { status: 200, headers: { 'cache-control': 'no-store' } }),
      current.value.setCookies,
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!isValidCopilotOutcomePayload(body)) {
      return withSession(
        request,
        NextResponse.json({ ok: false, message: 'Invalid outcome payload' }, { status: 200, headers: { 'cache-control': 'no-store' } }),
        current.value.setCookies,
      );
    }

    const forwarded = await forwardCopilotOutcome(body);
    if (!forwarded.ok) {
      return withSession(
        request,
        NextResponse.json({ ok: false, message: forwarded.message }, { status: 200, headers: { 'cache-control': 'no-store' } }),
        current.value.setCookies,
      );
    }

    return withSession(
      request,
      NextResponse.json({ ok: true, data: forwarded.upstream }, { status: 200, headers: { 'cache-control': 'no-store' } }),
      current.value.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json({ ok: false, message: detail || 'Outcome attach failed' }, { status: 200, headers: { 'cache-control': 'no-store' } }),
      current.value.setCookies,
    );
  }
}
