import { NextRequest, NextResponse } from 'next/server';
import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import {
  executeCopilotOnProductCopilot,
  issueAccountCopilotGrant,
} from '@roma/lib/ai/account-copilot';
import { loadTokyoAccountInstanceDocument } from '@roma/lib/account-instance-direct';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';
import {
  resolveAiModelCapability,
  type AiModelRef,
  type AiProvider,
  type ProductCopilotRequestEnvelope,
} from '@clickeen/ck-contracts/ai';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

const COPILOT_INVALID_EDIT_MESSAGE = "Copilot couldn't produce a valid edit for this widget. Nothing was changed.";

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
  const capability = resolveAiModelCapability(provider as AiProvider, model);
  if (!capability) {
    return { ok: false, message: `selectedModel is not configured for this AI surface: ${provider}:${model}` };
  }
  return { ok: true, value: { provider: capability.provider, model: capability.model } };
}

function isExactNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isControlPath(value: unknown): value is string {
  return isExactNonEmptyString(value) &&
    !value.split('.').some((segment) => !segment || segment === '__proto__' || segment === 'prototype' || segment === 'constructor');
}

function validateConversationHistory(value: unknown): Array<{ path: string; message: string }> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [{ path: 'conversationHistory', message: 'conversationHistory must be an array' }];
  if (value.length > 8) return [{ path: 'conversationHistory', message: 'conversationHistory must contain at most 8 messages' }];
  const issues: Array<{ path: string; message: string }> = [];
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      issues.push({ path: `conversationHistory[${index}]`, message: 'message must be an object' });
      return;
    }
    if (entry.role !== 'user' && entry.role !== 'assistant') issues.push({ path: `conversationHistory[${index}].role`, message: 'role must be user or assistant' });
    const text = asTrimmedString(entry.text);
    if (!text) issues.push({ path: `conversationHistory[${index}].text`, message: 'text is required' });
    if (text && text.length > 2000) issues.push({ path: `conversationHistory[${index}].text`, message: 'text must be at most 2000 characters' });
  });
  return issues;
}

function validateCopilotEnvelope(payload: Record<string, unknown>, routeInstanceId: string): { envelope: ProductCopilotRequestEnvelope | null; issues: Array<{ path: string; message: string }> } {
  const issues: Array<{ path: string; message: string }> = [];
  const context = isRecord(payload.context) ? payload.context : null;

  for (const field of ['instanceId', 'userMessage', 'sessionId']) {
    if (!isExactNonEmptyString(payload[field])) issues.push({ path: field, message: `${field} is required` });
  }
  if (payload.instanceId && payload.instanceId !== routeInstanceId) {
    issues.push({ path: 'instanceId', message: 'instanceId must match the route instance' });
  }
  if (!context) {
    issues.push({ path: 'context', message: 'context must be an object' });
  } else {
    if (context.version !== 'product-copilot.context.v1') issues.push({ path: 'context.version', message: 'unsupported context version' });
    for (const field of ['instanceId', 'widgetType', 'displayName', 'activeLocale', 'draftSignature', 'traceRequestId']) {
      if (!isExactNonEmptyString(context[field])) issues.push({ path: `context.${field}`, message: `${field} is required` });
    }
    if (context.instanceId && context.instanceId !== routeInstanceId) {
      issues.push({ path: 'context.instanceId', message: 'context instance must match the route instance' });
    }
    if (context.controls !== undefined && !Array.isArray(context.controls)) {
      issues.push({ path: 'context.controls', message: 'context.controls must be an array when present' });
    }
    if (!Array.isArray(context.availableActions)) {
      issues.push({ path: 'context.availableActions', message: 'availableActions must be an array' });
    } else if (context.availableActions.some((entry) => entry !== 'draft_edit')) {
      issues.push({ path: 'context.availableActions', message: 'availableActions contains an unsupported action' });
    }
    if (!Array.isArray(context.unavailableCapabilities) || !context.unavailableCapabilities.every((entry) => typeof entry === 'string')) {
      issues.push({ path: 'context.unavailableCapabilities', message: 'unavailableCapabilities must be a string array' });
    }
    if (context.selectedControlPath !== undefined && !isControlPath(context.selectedControlPath)) {
      issues.push({ path: 'context.selectedControlPath', message: 'selectedControlPath must be an exact path when present' });
    }
  }
  issues.push(...validateConversationHistory(payload.conversationHistory));
  if (issues.length || !context) return { envelope: null, issues };
  return { envelope: payload as ProductCopilotRequestEnvelope, issues: [] };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const instanceId = await requireInstanceIdParam(context);
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as unknown;
    const payload = isRecord(body) ? body : null;

    const selectedModelResult = parseSelectedModel(payload?.selectedModel);
    const envelopeResult = payload ? validateCopilotEnvelope(payload, instanceId) : { envelope: null, issues: [{ path: 'body', message: 'body must be an object' }] };

    const issues: Array<{ path: string; message: string }> = [];
    if (!selectedModelResult.ok) issues.push({ path: 'selectedModel', message: selectedModelResult.message });
    issues.push(...envelopeResult.issues);
    if (issues.length) {
      return withSession(request, NextResponse.json({ error: 'VALIDATION', issues }, { status: 422 }), current.value.setCookies);
    }
    const selectedModel = selectedModelResult.ok ? selectedModelResult.value : null;
    const envelope = envelopeResult.envelope!;

    const currentInstance = await loadTokyoAccountInstanceDocument({
      accountId: current.value.authzPayload.accountPublicId,
      instanceId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    });
    if (!currentInstance.ok) {
      return withSession(
        request,
        NextResponse.json({ error: currentInstance.error }, { status: currentInstance.status }),
        current.value.setCookies,
      );
    }
    const widgetType = currentInstance.value.row.widgetType;
    if (envelope.context.widgetType !== widgetType) {
      return withSession(
        request,
        NextResponse.json(
          { error: 'VALIDATION', issues: [{ path: 'context.widgetType', message: 'widgetType must match the instance widget type' }] },
          { status: 422 },
        ),
        current.value.setCookies,
      );
    }

    const issued = await issueAccountCopilotGrant({
      authz: current.value.authzPayload,
      ...(selectedModel ? { selectedModel } : {}),
      trace: { sessionId: envelope.sessionId, instanceId },
      usageKv: current.value.usageKv,
    });
    if (!issued.ok) {
      if (issued.status === 403) {
        return withSession(
          request,
          NextResponse.json(
            {
              error: {
                kind: 'DENY',
                reasonKey: issued.reasonKey,
                detail: issued.detail,
              },
            },
            { status: 403 },
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

    const executed = await executeCopilotOnProductCopilot({
      grant: issued.grant,
      agentId: issued.agentId,
      traceClient: 'roma',
      requestId: current.value.requestId,
      input: envelope,
    });
    if (!executed.ok) {
      const invalidEdit = executed.message.includes(COPILOT_INVALID_EDIT_MESSAGE);
      const reasonKey =
        invalidEdit
          ? 'coreui.errors.copilot.invalidEdit'
          : executed.reasonKey === 'coreui.errors.copilot.invalidContext' ||
              executed.reasonKey === 'coreui.errors.copilot.invalidRequest'
            ? executed.reasonKey
            : 'coreui.errors.copilot.failed';
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey,
              detail: invalidEdit ? COPILOT_INVALID_EDIT_MESSAGE : executed.message,
              ...(executed.issues?.length ? { issues: executed.issues } : {}),
            },
          },
          { status: executed.status },
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
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.copilot.failed',
            detail,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }
}
