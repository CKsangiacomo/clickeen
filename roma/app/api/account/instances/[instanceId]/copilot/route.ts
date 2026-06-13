import { NextRequest, NextResponse } from 'next/server';
import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import {
  executeCopilotOnSanFrancisco,
  issueAccountCopilotGrant,
} from '@roma/lib/ai/account-copilot';
import { loadTokyoAccountInstanceDocument } from '@roma/lib/account-instance-direct';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';
import type { AiModelRef, AiProvider } from '@clickeen/ck-contracts/ai';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

const AI_PROVIDERS: ReadonlySet<AiProvider> = new Set(['deepseek', 'openai']);
const CONTROL_KINDS: ReadonlySet<string> = new Set(['string', 'number', 'boolean', 'enum', 'color', 'json', 'array', 'object']);

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

function isExactNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isControlPath(value: unknown): value is string {
  return isExactNonEmptyString(value) &&
    !value.split('.').some((segment) => !segment || segment === '__proto__' || segment === 'prototype' || segment === 'constructor');
}

function controlIssue(index: number, field: string, message: string): { path: string; message: string } {
  return { path: `controls[${index}].${field}`, message };
}

function controlEnumValues(control: Record<string, unknown>): string[] {
  if (Array.isArray(control.enumValues)) return control.enumValues.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  if (Array.isArray(control.options)) {
    return control.options
      .filter((option): option is { value: string } => isRecord(option) && typeof option.value === 'string' && option.value.length > 0)
      .map((option) => option.value);
  }
  return [];
}

function validateControlCatalog(controls: unknown): Array<{ path: string; message: string }> {
  if (!Array.isArray(controls)) return [];
  const issues: Array<{ path: string; message: string }> = [];
  controls.forEach((control, index) => {
    if (!isRecord(control)) {
      issues.push({ path: `controls[${index}]`, message: 'control must be an object' });
      return;
    }
    if (!isControlPath(control.path)) {
      issues.push(controlIssue(index, 'path', 'path must be an exact dot path without empty or prohibited segments'));
    }
    for (const field of ['panelId', 'groupId', 'groupLabel', 'type', 'kind', 'label', 'itemIdPath']) {
      if (control[field] !== undefined && typeof control[field] !== 'string') {
        issues.push(controlIssue(index, field, `${field} must be a string`));
      }
    }
    if (
      control.options !== undefined &&
      (!Array.isArray(control.options) ||
        !control.options.every((option) => isRecord(option) && typeof option.label === 'string' && typeof option.value === 'string'))
    ) {
      issues.push(controlIssue(index, 'options', 'options must be label/value string objects'));
    }
    if (control.enumValues !== undefined && (!Array.isArray(control.enumValues) || !control.enumValues.every((entry) => typeof entry === 'string'))) {
      issues.push(controlIssue(index, 'enumValues', 'enumValues must be strings'));
    }
    if (control.min !== undefined && (typeof control.min !== 'number' || !Number.isFinite(control.min))) {
      issues.push(controlIssue(index, 'min', 'min must be a finite number'));
    }
    if (control.max !== undefined && (typeof control.max !== 'number' || !Number.isFinite(control.max))) {
      issues.push(controlIssue(index, 'max', 'max must be a finite number'));
    }
    if (!CONTROL_KINDS.has(String(control.kind || ''))) {
      issues.push(controlIssue(index, 'kind', 'kind must be a supported control kind'));
    }
    if (control.kind === 'enum' && controlEnumValues(control).length === 0) {
      issues.push(controlIssue(index, 'enumValues', 'enum controls must declare values'));
    }
  });
  return issues;
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

    const prompt = asTrimmedString(payload?.prompt) ?? '';
    const sessionId = asTrimmedString(payload?.sessionId) ?? '';
    const currentConfig = payload?.currentConfig;
    const controls = payload?.controls;
    const widgetPackage = payload?.widgetPackage;
    const selectedModelResult = parseSelectedModel(payload?.selectedModel);

    const issues: Array<{ path: string; message: string }> = [];
    if (!prompt) issues.push({ path: 'prompt', message: 'prompt is required' });
    if (!sessionId) issues.push({ path: 'sessionId', message: 'sessionId is required' });
    if (!isRecord(currentConfig)) issues.push({ path: 'currentConfig', message: 'currentConfig must be an object' });
    if (!Array.isArray(controls)) issues.push({ path: 'controls', message: 'controls must be an array' });
    if (!isRecord(widgetPackage)) issues.push({ path: 'widgetPackage', message: 'widgetPackage must be an object' });
    if (!selectedModelResult.ok) issues.push({ path: 'selectedModel', message: selectedModelResult.message });
    issues.push(...validateControlCatalog(controls));
    if (issues.length) {
      return withSession(request, NextResponse.json({ error: 'VALIDATION', issues }, { status: 422 }), current.value.setCookies);
    }
    const selectedModel = selectedModelResult.ok ? selectedModelResult.value : null;

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

    const issued = await issueAccountCopilotGrant({
      authz: current.value.authzPayload,
      ...(selectedModel ? { selectedModel } : {}),
      trace: { sessionId, instanceId },
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
      requestId: current.value.requestId,
      input: {
        prompt,
        widgetType,
        currentConfig,
        controls,
        widgetPackage,
        sessionId,
      },
    });
    if (!executed.ok) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey: 'coreui.errors.copilot.failed',
              detail: executed.message,
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
