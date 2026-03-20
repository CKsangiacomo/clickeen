import { NextRequest, NextResponse } from 'next/server';
import { WIDGET_COPILOT_AGENT_ALIAS, WIDGET_COPILOT_AGENT_IDS } from '@clickeen/ck-policy';
import {
  executeCopilotOnSanFrancisco,
  issueAccountCopilotGrant,
} from '@roma/lib/ai/account-copilot';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

const ALLOWED_WIDGET_COPILOT_AGENT_IDS = new Set<string>([
  WIDGET_COPILOT_AGENT_ALIAS,
  WIDGET_COPILOT_AGENT_IDS.sdr,
  WIDGET_COPILOT_AGENT_IDS.cs,
] as const);

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
    const widgetType = asTrimmedString(payload?.widgetType);
    const sessionId = asTrimmedString(payload?.sessionId);
    const requestedAgentId = asTrimmedString(payload?.agentId) || WIDGET_COPILOT_AGENT_ALIAS;
    const subject = asTrimmedString(payload?.subject);
    const provider = asTrimmedString(payload?.provider) || undefined;
    const model = asTrimmedString(payload?.model) || undefined;
    const currentConfig = payload?.currentConfig;
    const controls = payload?.controls;

    const issues: Array<{ path: string; message: string }> = [];
    if (!prompt) issues.push({ path: 'prompt', message: 'prompt is required' });
    if (!widgetType) issues.push({ path: 'widgetType', message: 'widgetType is required' });
    if (!sessionId) issues.push({ path: 'sessionId', message: 'sessionId is required' });
    if (!isRecord(currentConfig)) issues.push({ path: 'currentConfig', message: 'currentConfig must be an object' });
    if (!Array.isArray(controls)) issues.push({ path: 'controls', message: 'controls must be an array' });
    if (subject && subject !== 'account') issues.push({ path: 'subject', message: 'subject must be account' });
    if (!ALLOWED_WIDGET_COPILOT_AGENT_IDS.has(requestedAgentId)) {
      issues.push({ path: 'agentId', message: 'agentId must be widget.copilot.v1, sdr.widget.copilot.v1, or cs.widget.copilot.v1' });
    }
    if (issues.length) {
      return withSession(request, NextResponse.json({ error: 'VALIDATION', issues }, { status: 422 }), current.value.setCookies);
    }

    const issued = await issueAccountCopilotGrant({
      authz: current.value.authzPayload,
      accountCapsule: current.value.authzToken,
      agentId: requestedAgentId,
      mode: 'ops',
      requestedProvider: provider,
      requestedModel: model,
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
