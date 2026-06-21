import { NextRequest, NextResponse } from 'next/server';
import {
  forwardCopilotOutcome,
  hashCopilotAccountId,
  isValidCopilotOutcomePayload,
} from '@roma/lib/ai/account-copilot';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

function isPaidLearningProfile(profile: unknown): boolean {
  return String(profile || '').trim() !== 'free';
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const instanceId = await requireInstanceIdParam(context);
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ ok: false, message: 'Invalid instanceId' }, { status: 200, headers: { 'cache-control': 'no-store' } }),
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

    if (!isPaidLearningProfile(current.value.authzPayload.profile)) {
      return withSession(
        request,
        NextResponse.json({ ok: true, data: { skipped: 'free_learning_cohort' } }, { status: 200, headers: { 'cache-control': 'no-store' } }),
        current.value.setCookies,
      );
    }

    const forwarded = await forwardCopilotOutcome({
      ...body,
      outcomeId: `${body.requestId}:${body.event}`,
      surfaceId: 'roma.builder',
      artifactId: instanceId,
      accountIdHash: await hashCopilotAccountId(current.value.authzPayload.accountId),
    });
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
