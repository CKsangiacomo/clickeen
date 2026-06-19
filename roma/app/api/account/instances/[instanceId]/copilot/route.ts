import { NextRequest, NextResponse } from 'next/server';
import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import {
  executeCopilotOnSanFrancisco,
  issueAccountCopilotGrant,
} from '@roma/lib/ai/account-copilot';
import { loadTokyoAccountInstanceDocument } from '@roma/lib/account-instance-direct';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';
import {
  resolveAiModelCapability,
  type AiModelRef,
  type AiProvider,
  type BuilderCopilotRequestEnvelope,
  type BuilderCopilotTurnClass,
} from '@clickeen/ck-contracts/ai';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

const CONTROL_KINDS: ReadonlySet<string> = new Set(['string', 'number', 'boolean', 'enum', 'color', 'json', 'array', 'object']);
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
  if (!capability.pickerEligibility.eligible) {
    return { ok: false, message: `selectedModel is not available for this AI surface: ${provider}:${model}` };
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

function controlEnumValues(control: Record<string, unknown>): string[] {
  if (Array.isArray(control.enumValues)) return control.enumValues.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  if (Array.isArray(control.options)) {
    return control.options
      .filter((option): option is { value: string } => isRecord(option) && typeof option.value === 'string' && option.value.length > 0)
      .map((option) => option.value);
  }
  return [];
}

function validateControlCatalog(controls: unknown, pathPrefix = 'snapshot.controls'): Array<{ path: string; message: string }> {
  if (!Array.isArray(controls)) return [];
  const issues: Array<{ path: string; message: string }> = [];
  controls.forEach((control, index) => {
    if (!isRecord(control)) {
      issues.push({ path: `${pathPrefix}[${index}]`, message: 'control must be an object' });
      return;
    }
    if (!isControlPath(control.path)) {
      issues.push({ path: `${pathPrefix}[${index}].path`, message: 'path must be an exact dot path without empty or prohibited segments' });
    }
    for (const field of ['panelId', 'groupId', 'groupLabel', 'type', 'kind', 'label', 'itemIdPath']) {
      if (control[field] !== undefined && typeof control[field] !== 'string') {
        issues.push({ path: `${pathPrefix}[${index}].${field}`, message: `${field} must be a string` });
      }
    }
    if (
      control.options !== undefined &&
      (!Array.isArray(control.options) ||
        !control.options.every(
          (option) =>
            isRecord(option) &&
            typeof option.label === 'string' &&
            ['string', 'number', 'boolean'].includes(typeof option.value),
        ))
    ) {
      issues.push({ path: `${pathPrefix}[${index}].options`, message: 'options must be label/value objects' });
    }
    if (control.enumValues !== undefined && (!Array.isArray(control.enumValues) || !control.enumValues.every((entry) => typeof entry === 'string'))) {
      issues.push({ path: `${pathPrefix}[${index}].enumValues`, message: 'enumValues must be strings' });
    }
    if (control.min !== undefined && (typeof control.min !== 'number' || !Number.isFinite(control.min))) {
      issues.push({ path: `${pathPrefix}[${index}].min`, message: 'min must be a finite number' });
    }
    if (control.max !== undefined && (typeof control.max !== 'number' || !Number.isFinite(control.max))) {
      issues.push({ path: `${pathPrefix}[${index}].max`, message: 'max must be a finite number' });
    }
    if (!CONTROL_KINDS.has(String(control.kind || ''))) {
      issues.push({ path: `${pathPrefix}[${index}].kind`, message: 'kind must be a supported control kind' });
    }
    if (control.kind === 'enum' && controlEnumValues(control).length === 0) {
      issues.push({ path: `${pathPrefix}[${index}].enumValues`, message: 'enum controls must declare values' });
    }
    if (control.aliases !== undefined && (!Array.isArray(control.aliases) || !control.aliases.every((entry) => typeof entry === 'string'))) {
      issues.push({ path: `${pathPrefix}[${index}].aliases`, message: 'aliases must be strings' });
    }
  });
  return issues;
}

function isTurnClass(value: unknown): value is BuilderCopilotTurnClass {
  return value === 'resolved_edit' || value === 'multi_op_plan';
}

function validateCopilotEnvelope(payload: Record<string, unknown>, routeInstanceId: string): { envelope: BuilderCopilotRequestEnvelope | null; issues: Array<{ path: string; message: string }> } {
  const issues: Array<{ path: string; message: string }> = [];
  const snapshot = isRecord(payload.snapshot) ? payload.snapshot : null;
  const resolvedTarget = isRecord(payload.resolvedTarget) ? payload.resolvedTarget : null;

  for (const field of ['instanceId', 'widgetType', 'activeLocale', 'snapshotHash', 'userMessage', 'sessionId']) {
    if (!isExactNonEmptyString(payload[field])) issues.push({ path: field, message: `${field} is required` });
  }
  if (payload.instanceId && payload.instanceId !== routeInstanceId) {
    issues.push({ path: 'instanceId', message: 'instanceId must match the route instance' });
  }
  if (!isTurnClass(payload.turnClass)) issues.push({ path: 'turnClass', message: 'turnClass must be resolved_edit or multi_op_plan' });
  if (!snapshot) {
    issues.push({ path: 'snapshot', message: 'snapshot must be an object' });
  } else {
    if (!isExactNonEmptyString(snapshot.widgetType)) issues.push({ path: 'snapshot.widgetType', message: 'snapshot.widgetType is required' });
    if (!isExactNonEmptyString(snapshot.displayName)) issues.push({ path: 'snapshot.displayName', message: 'snapshot.displayName is required' });
    if (!Array.isArray(snapshot.controls) || snapshot.controls.length === 0) {
      issues.push({ path: 'snapshot.controls', message: 'snapshot.controls must be a non-empty array' });
    }
    issues.push(...validateControlCatalog(snapshot.controls, 'snapshot.controls'));
  }
  if (payload.turnClass === 'resolved_edit') {
    if (!resolvedTarget) {
      issues.push({ path: 'resolvedTarget', message: 'resolvedTarget is required for resolved_edit' });
    } else {
      if (!isControlPath(resolvedTarget.path)) issues.push({ path: 'resolvedTarget.path', message: 'resolvedTarget.path is required' });
      if (!isExactNonEmptyString(resolvedTarget.valueType)) issues.push({ path: 'resolvedTarget.valueType', message: 'resolvedTarget.valueType is required' });
    }
  }
  if (issues.length || !snapshot) return { envelope: null, issues };
  return { envelope: payload as BuilderCopilotRequestEnvelope, issues: [] };
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
    if (envelope.widgetType !== widgetType || envelope.snapshot.widgetType !== widgetType) {
      return withSession(
        request,
        NextResponse.json(
          { error: 'VALIDATION', issues: [{ path: 'widgetType', message: 'widgetType must match the instance widget type' }] },
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

    const executed = await executeCopilotOnSanFrancisco({
      grant: issued.grant,
      agentId: issued.agentId,
      traceClient: 'roma',
      requestId: current.value.requestId,
      input: envelope,
    });
    if (!executed.ok) {
      const invalidEdit = executed.message.includes(COPILOT_INVALID_EDIT_MESSAGE);
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey: invalidEdit ? 'coreui.errors.copilot.invalidEdit' : 'coreui.errors.copilot.failed',
              detail: invalidEdit ? COPILOT_INVALID_EDIT_MESSAGE : executed.message,
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
