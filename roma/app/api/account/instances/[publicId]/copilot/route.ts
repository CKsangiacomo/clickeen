import { NextRequest, NextResponse } from 'next/server';
import {
  executeCopilotOnSanFrancisco,
  issueAccountCopilotGrant,
} from '@roma/lib/ai/account-copilot';
import { loadTokyoAccountInstanceDocument } from '@roma/lib/account-instance-direct';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
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

  try {
    const body = (await request.json().catch(() => null)) as unknown;
    const payload = isRecord(body) ? body : null;

    const prompt = asTrimmedString(payload?.prompt);
    const sessionId = asTrimmedString(payload?.sessionId);
    const currentConfig = payload?.currentConfig;
    const controls = payload?.controls;

    const issues: Array<{ path: string; message: string }> = [];
    if (!prompt) issues.push({ path: 'prompt', message: 'prompt is required' });
    if (!sessionId) issues.push({ path: 'sessionId', message: 'sessionId is required' });
    if (!isRecord(currentConfig)) issues.push({ path: 'currentConfig', message: 'currentConfig must be an object' });
    if (!Array.isArray(controls)) issues.push({ path: 'controls', message: 'controls must be an array' });
    if (issues.length) {
      return withSession(request, NextResponse.json({ error: 'VALIDATION', issues }, { status: 422 }), current.value.setCookies);
    }

    const currentInstance = await loadTokyoAccountInstanceDocument({
      accountId: current.value.authzPayload.accountId,
      publicId,
      accountCapsule: current.value.authzToken,
    });
    if (!currentInstance.ok) {
      return withSession(
        request,
        NextResponse.json({ error: currentInstance.error }, { status: currentInstance.status }),
        current.value.setCookies,
      );
    }
    const widgetType = currentInstance.value.row.widgetType;

    const issued = await issueAccountCopilotGrant({
      authz: current.value.authzPayload,
      accountCapsule: current.value.authzToken,
      mode: 'ops',
      trace: { sessionId, instancePublicId: publicId },
      budgets: { maxTokens: 650, timeoutMs: 45_000, maxRequests: 2 },
      usageKv: current.value.usageKv,
    });
    if (!issued.ok) {
      if (issued.status === 403) {
        return withSession(
          request,
          NextResponse.json(
            {
              message: 'Copilot limit reached. Upgrade to continue.',
              cta: { text: 'Upgrade to continue', action: 'upgrade' },
              reasonKey: issued.reasonKey,
              detail: issued.detail,
            },
            { status: 200 },
          ),
          current.value.setCookies,
        );
      }
      return withSession(
        request,
        NextResponse.json({ message: issued.reasonKey }, { status: issued.status }),
        current.value.setCookies,
      );
    }

    const executed = await executeCopilotOnSanFrancisco({
      grant: issued.grant,
      agentId: issued.agentId,
      traceClient: 'roma',
      input: {
        prompt,
        widgetType,
        currentConfig,
        controls,
        sessionId,
      },
    });
    if (!executed.ok) {
      return withSession(
        request,
        NextResponse.json(
          { message: executed.message || 'Copilot is temporarily unavailable. Please try again.' },
          { status: 200 },
        ),
        current.value.setCookies,
      );
    }

    const result = executed.result ?? null;
    if (executed.requestId && isRecord(result)) {
      const baseMeta = isRecord(result.meta) ? (result.meta as Record<string, unknown>) : {};
      return withSession(
        request,
        NextResponse.json({ ...result, meta: { ...baseMeta, requestId: executed.requestId } }),
        current.value.setCookies,
      );
    }

    return withSession(request, NextResponse.json(result), current.value.setCookies);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json({ message: detail || 'Copilot failed unexpectedly. Please try again.' }, { status: 200 }),
      current.value.setCookies,
    );
  }
}
