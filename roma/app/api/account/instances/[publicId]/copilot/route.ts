import { NextRequest, NextResponse } from 'next/server';
import {
  executeCopilotOnSanFrancisco,
  issueAccountCopilotGrant,
} from '@roma/lib/ai/account-copilot';
import { loadTokyoAccountInstanceDocument } from '@roma/lib/account-instance-direct';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';
import type { AiModelRef, AiProvider } from '@clickeen/ck-contracts/ai';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const AI_PROVIDERS: ReadonlySet<AiProvider> = new Set(['deepseek', 'openai', 'anthropic', 'groq', 'amazon']);

function isAiProvider(value: string): value is AiProvider {
  return AI_PROVIDERS.has(value as AiProvider);
}

type SelectedModelParseResult =
  | { ok: true; value: AiModelRef | null }
  | { ok: false; message: string };

function parseSelectedModel(value: unknown): SelectedModelParseResult {
  if (value == null) return { ok: true, value: null };
  if (!isRecord(value)) {
    return { ok: false, message: 'selectedModel must be an object with provider and model' };
  }
  const provider = asTrimmedString(value.provider);
  const model = asTrimmedString(value.model);
  if (!provider || !model) {
    return { ok: false, message: 'selectedModel.provider and selectedModel.model are required' };
  }
  if (!isAiProvider(provider)) {
    return { ok: false, message: `selectedModel.provider is not supported: ${provider}` };
  }
  return { ok: true, value: { provider, model } };
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
    const selectedModelResult = parseSelectedModel(payload?.selectedModel);

    const issues: Array<{ path: string; message: string }> = [];
    if (!prompt) issues.push({ path: 'prompt', message: 'prompt is required' });
    if (!sessionId) issues.push({ path: 'sessionId', message: 'sessionId is required' });
    if (!isRecord(currentConfig)) issues.push({ path: 'currentConfig', message: 'currentConfig must be an object' });
    if (!Array.isArray(controls)) issues.push({ path: 'controls', message: 'controls must be an array' });
    if (!selectedModelResult.ok) issues.push({ path: 'selectedModel', message: selectedModelResult.message });
    if (issues.length) {
      return withSession(request, NextResponse.json({ error: 'VALIDATION', issues }, { status: 422 }), current.value.setCookies);
    }
    const selectedModel = selectedModelResult.ok ? selectedModelResult.value : null;

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
      ...(selectedModel ? { selectedModel } : {}),
      trace: { sessionId, instancePublicId: publicId },
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
