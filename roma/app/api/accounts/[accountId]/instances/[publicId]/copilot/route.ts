import { NextRequest, NextResponse } from 'next/server';
import { WIDGET_COPILOT_AGENT_ALIAS, WIDGET_COPILOT_AGENT_IDS } from '@clickeen/ck-policy';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../../../lib/account-authz-capsule';
import {
  applySessionCookies,
  resolveSessionBearer,
  type SessionCookieSpec,
} from '../../../../../../../lib/auth/session';
import {
  executeCopilotOnSanFrancisco,
  issueAccountCopilotGrant,
} from '../../../../../../../lib/ai/account-copilot';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string }> };

const ALLOWED_WIDGET_COPILOT_AGENT_IDS = new Set<string>([
  WIDGET_COPILOT_AGENT_ALIAS,
  WIDGET_COPILOT_AGENT_IDS.sdr,
  WIDGET_COPILOT_AGENT_IDS.cs,
] as const);

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  return withNoStore(applySessionCookies(response, request, setCookies));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw, publicId: publicIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  const publicId = String(publicIdRaw || '').trim();
  if (!isUuid(accountId)) {
    return withSession(
      request,
      NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }, { status: 422 }),
      session.setCookies,
    );
  }
  if (!publicId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId,
    minRole: 'editor',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
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
      return withSession(request, NextResponse.json({ error: 'VALIDATION', issues }, { status: 422 }), session.setCookies);
    }

    const issued = await issueAccountCopilotGrant({
      authz: authz.payload,
      agentId: requestedAgentId,
      mode: 'ops',
      requestedProvider: provider,
      requestedModel: model,
      trace: { sessionId, instancePublicId: publicId },
      budgets: { maxTokens: 650, timeoutMs: 45_000, maxRequests: 2 },
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
          session.setCookies,
        );
      }
      return withSession(
        request,
        NextResponse.json({ message: issued.reasonKey }, { status: issued.status }),
        session.setCookies,
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
        session.setCookies,
      );
    }

    const result = executed.result ?? null;
    if (executed.requestId && isRecord(result)) {
      const baseMeta = isRecord(result.meta) ? (result.meta as Record<string, unknown>) : {};
      return withSession(
        request,
        NextResponse.json({ ...result, meta: { ...baseMeta, requestId: executed.requestId } }),
        session.setCookies,
      );
    }

    return withSession(request, NextResponse.json(result), session.setCookies);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json({ message: detail || 'Copilot failed unexpectedly. Please try again.' }, { status: 200 }),
      session.setCookies,
    );
  }
}
