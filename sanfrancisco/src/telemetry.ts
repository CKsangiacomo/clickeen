import { HttpError, asTrimmedString, isRecord } from './http';
import { verifyBodySignature } from './signatures';
import type { CopilotLearningMetadata, Env, InteractionEvent, OutcomeAttachRequest } from './types';

const OUTCOME_EVENTS = new Set([
  'edit_applied',
  'edit_rejected',
  'edit_undone',
  'clarification_needed',
  'invalid_output',
]);

function toIsoDay(ms: number): string {
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function promptHasUrl(input: unknown): boolean {
  const prompt = resolveCopilotPrompt(input);
  if (!prompt) return false;
  return /\bhttps?:\/\/[^\s<>"')]+/i.test(prompt) || /\b([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s<>"')]+)?\b/i.test(prompt);
}

function resolveCopilotPrompt(input: unknown): string | null {
  if (!isRecord(input)) return null;
  return asTrimmedString((input as any).userMessage) ?? asTrimmedString((input as any).prompt);
}

function resolveCopilotControls(input: unknown): unknown[] {
  if (!isRecord(input)) return [];
  const context = isRecord((input as any).context) ? (input as any).context : null;
  if (Array.isArray((context as any)?.controls)) return (context as any).controls;
  if (Array.isArray((input as any).controls)) return (input as any).controls;
  const snapshot = isRecord((input as any).snapshot) ? (input as any).snapshot : null;
  return Array.isArray((snapshot as any)?.controls) ? (snapshot as any).controls : [];
}

function resolveCopilotWidgetType(input: unknown): string | null {
  if (!isRecord(input)) return null;
  const context = isRecord((input as any).context) ? (input as any).context : null;
  const snapshot = isRecord((input as any).snapshot) ? (input as any).snapshot : null;
  return asTrimmedString((context as any)?.widgetType) ?? asTrimmedString((input as any).widgetType) ?? asTrimmedString((snapshot as any)?.widgetType);
}

export function isOutcomeAttachRequest(value: unknown): value is OutcomeAttachRequest {
  if (!isRecord(value)) return false;
  const requestId = asTrimmedString((value as any).requestId);
  const outcomeId = asTrimmedString((value as any).outcomeId);
  const surfaceId = asTrimmedString((value as any).surfaceId);
  const artifactId = asTrimmedString((value as any).artifactId);
  const sessionId = asTrimmedString((value as any).sessionId);
  const event = asTrimmedString((value as any).event);
  const occurredAtMs = (value as any).occurredAtMs;
  const timeToDecisionMs = (value as any).timeToDecisionMs;
  const accountIdHash = (value as any).accountIdHash;

  if (!requestId) return false;
  if ((value as any).outcomeId !== undefined && !outcomeId) return false;
  if ((value as any).surfaceId !== undefined && !surfaceId) return false;
  if ((value as any).artifactId !== undefined && !artifactId) return false;
  if (!sessionId) return false;
  if (!event || !OUTCOME_EVENTS.has(event)) return false;
  if (typeof occurredAtMs !== 'number' || !Number.isFinite(occurredAtMs)) return false;

  if (timeToDecisionMs !== undefined && (typeof timeToDecisionMs !== 'number' || !Number.isFinite(timeToDecisionMs) || timeToDecisionMs < 0)) {
    return false;
  }
  if (accountIdHash !== undefined && (typeof accountIdHash !== 'string' || !accountIdHash.trim())) return false;

  const metadata = (value as any).metadata;
  if (metadata !== undefined && !isCopilotLearningMetadata(metadata)) return false;

  return true;
}

function isCopilotLearningMetadata(value: unknown): value is CopilotLearningMetadata {
  if (!isRecord(value)) return false;
  if ((value as any).intent !== undefined && typeof (value as any).intent !== 'string') return false;
  if ((value as any).invalidReason !== undefined && typeof (value as any).invalidReason !== 'string') return false;
  if ((value as any).validationResult !== undefined) {
    const validationResult = (value as any).validationResult;
    if (validationResult !== 'valid' && validationResult !== 'invalid' && validationResult !== 'not_applicable') return false;
  }
  if ((value as any).opsCount !== undefined && !isFiniteNonNegativeNumber((value as any).opsCount)) return false;
  if ((value as any).uniquePathsTouched !== undefined && !isFiniteNonNegativeNumber((value as any).uniquePathsTouched)) return false;
  if ((value as any).touchedPaths !== undefined && !isStringArray((value as any).touchedPaths)) return false;
  if ((value as any).touchedScopes !== undefined && !isStringArray((value as any).touchedScopes)) return false;
  if ((value as any).touchedControls !== undefined && !isTouchedControls((value as any).touchedControls)) return false;
  if ((value as any).touchedGroups !== undefined && !isTouchedGroups((value as any).touchedGroups)) return false;
  return true;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isTouchedControls(value: unknown): value is NonNullable<CopilotLearningMetadata['touchedControls']> {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!isRecord(entry)) return false;
      if (typeof entry.path !== 'string' || !entry.path.trim()) return false;
      if (entry.label !== undefined && typeof entry.label !== 'string') return false;
      if (entry.groupId !== undefined && typeof entry.groupId !== 'string') return false;
      if (entry.groupLabel !== undefined && typeof entry.groupLabel !== 'string') return false;
      return true;
    })
  );
}

function isTouchedGroups(value: unknown): value is NonNullable<CopilotLearningMetadata['touchedGroups']> {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!isRecord(entry)) return false;
      return typeof entry.key === 'string' && Boolean(entry.key.trim()) && typeof entry.label === 'string' && Boolean(entry.label.trim());
    })
  );
}

export async function verifyOutcomeSignature(args: { request: Request; env: Env; bodyText: string }): Promise<void> {
  await verifyBodySignature({
    signature: args.request.headers.get('x-clickeen-signature'),
    secret: args.env.AI_GRANT_HMAC_SECRET,
    message: `outcome.v1.${args.bodyText}`,
    missingSecretMessage: 'Missing AI_GRANT_HMAC_SECRET',
  });
}

function fnv1aHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableHashHex(input: string): string {
  return fnv1aHash(input).toString(16).padStart(8, '0');
}

function deterministicPercent(input: string): number {
  return fnv1aHash(input) % 100;
}

function resolveSubjectHash(e: InteractionEvent): string | null {
  if (e.subject.kind === 'user') return `acct_${stableHashHex(e.subject.accountId)}_user_${stableHashHex(e.subject.userId)}`;
  if (e.subject.kind === 'service') return `svc_${stableHashHex(e.subject.serviceId)}`;
  return null;
}

function getResultMeta(e: InteractionEvent): Record<string, unknown> | null {
  if (!isRecord(e.result)) return null;
  return isRecord((e.result as any).meta) ? ((e.result as any).meta as Record<string, unknown>) : null;
}

function readJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())).map((entry) => entry.trim());
}

function readTouchedControls(value: unknown): NonNullable<CopilotLearningMetadata['touchedControls']> {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((entry) => ({
      path: asTrimmedString((entry as any).path) ?? '',
      ...(asTrimmedString((entry as any).label) ? { label: asTrimmedString((entry as any).label) as string } : {}),
      ...(asTrimmedString((entry as any).groupId) ? { groupId: asTrimmedString((entry as any).groupId) as string } : {}),
      ...(asTrimmedString((entry as any).groupLabel) ? { groupLabel: asTrimmedString((entry as any).groupLabel) as string } : {}),
    }))
    .filter((entry) => Boolean(entry.path));
}

function hasPaidLearningEntitlement(e: InteractionEvent): boolean {
  if (e.agentId !== 'cs.widget.copilot.v1') return false;
  if (e.subject.kind !== 'user') return false;
  const samplePercent = e.ai?.learningCapture?.rawSamplePercent;
  return typeof samplePercent === 'number' && Number.isFinite(samplePercent) && samplePercent > 0;
}

export type LearningCaptureDecision =
  | { captureRaw: true; reason: 'sample' }
  | { captureRaw: false; reason: 'free_or_ineligible' | 'not_sampled' };

export function resolveLearningCaptureDecision(e: InteractionEvent): LearningCaptureDecision {
  if (!hasPaidLearningEntitlement(e)) return { captureRaw: false, reason: 'free_or_ineligible' };
  const samplePercent = e.ai?.learningCapture?.rawSamplePercent;
  const boundedSamplePercent =
    typeof samplePercent === 'number' && Number.isFinite(samplePercent)
      ? Math.max(0, Math.min(100, samplePercent))
      : 0;
  const seed = `${e.subject.kind}:${resolveSubjectHash(e) ?? 'unknown'}:${e.agentId}:${e.requestId}`;
  if (deterministicPercent(seed) < boundedSamplePercent) return { captureRaw: true, reason: 'sample' };
  return { captureRaw: false, reason: 'not_sampled' };
}

function sanitizeInputForLearning(input: unknown): Record<string, unknown> | null {
  if (!isRecord(input)) return null;
  const prompt = resolveCopilotPrompt(input);
  const widgetType = resolveCopilotWidgetType(input);
  const sessionId = asTrimmedString((input as any).sessionId);
  const inputControls = resolveCopilotControls(input);
  const controls = inputControls.length
    ? inputControls
        .filter(isRecord)
        .map((control: Record<string, unknown>) => ({
          path: asTrimmedString(control.path) ?? '',
          ...(asTrimmedString(control.label) ? { label: asTrimmedString(control.label) as string } : {}),
          ...(asTrimmedString(control.groupId) ? { groupId: asTrimmedString(control.groupId) as string } : {}),
          ...(asTrimmedString(control.groupLabel) ? { groupLabel: asTrimmedString(control.groupLabel) as string } : {}),
          ...(asTrimmedString(control.kind) ? { kind: asTrimmedString(control.kind) as string } : {}),
        }))
        .filter((control: { path: string }) => Boolean(control.path))
    : [];

  return {
    ...(prompt ? { prompt } : {}),
    ...(widgetType ? { widgetType } : {}),
    ...(sessionId ? { sessionId } : {}),
    controlCount: controls.length,
    controls,
  };
}

export function buildLearningSample(e: InteractionEvent, decision: Extract<LearningCaptureDecision, { captureRaw: true }>): Record<string, unknown> {
  return {
    v: 1,
    captureReason: decision.reason,
    requestId: e.requestId,
    agentId: e.agentId,
    occurredAtMs: e.occurredAtMs,
    subjectHash: resolveSubjectHash(e),
    trace: e.trace ?? null,
    ai: e.ai ?? null,
    input: sanitizeInputForLearning(e.input),
    result: e.result,
    usage: e.usage,
  };
}

export async function indexCopilotEvent(env: Env, e: InteractionEvent): Promise<void> {
  const runtimeEnv = asTrimmedString(env.ENVIRONMENT) ?? 'unknown';
  const envStage = isRecord(e.trace) ? asTrimmedString((e.trace as any).envStage) : null;
  const surfaceId = isRecord(e.trace) ? asTrimmedString((e.trace as any).surfaceId) : null;
  const sessionId = isRecord(e.trace) ? asTrimmedString((e.trace as any).sessionId) : null;
  const instanceId = isRecord(e.trace) ? asTrimmedString((e.trace as any).instanceId) : null;

  const day = toIsoDay(e.occurredAtMs);
  const agentId = e.agentId;

  let widgetType: string | null = null;
  let controlCount: number | null = null;
  let hasUrl = 0;

  if (isRecord(e.input)) {
    widgetType = resolveCopilotWidgetType(e.input);
    const controls = resolveCopilotControls(e.input);
    controlCount = controls.length ? controls.length : null;
    hasUrl = promptHasUrl(e.input) ? 1 : 0;
  }

  let intent: string | null = null;
  let outcome: string | null = null;
  let promptVersion: string | null = null;
  let policyVersion: string | null = asTrimmedString(e.ai?.policyVersion) ?? null;
  let dictionaryHash: string | null = null;

  let ctaAction: string | null = null;
  let opsCount: number | null = null;
  let uniquePathsTouched: number | null = null;
  let scopesTouched: string | null = null;

  if (isRecord(e.result)) {
    const meta = isRecord((e.result as any).meta) ? ((e.result as any).meta as any) : null;
    const resultKind = asTrimmedString((e.result as any).kind);
    intent = (resultKind === 'draft_edit' ? 'edit' : resultKind) ?? (meta ? asTrimmedString(meta.intent) : null);
    outcome = resultKind === 'draft_edit' ? 'draft_edit_returned' : meta ? asTrimmedString(meta.outcome) : null;
    intent = intent ?? asTrimmedString((e.result as any).operation);
    outcome = outcome ?? asTrimmedString((e.result as any).outcome);
    promptVersion = meta ? asTrimmedString(meta.promptVersion) : null;
    policyVersion = (meta ? asTrimmedString(meta.policyVersion) : null) ?? policyVersion;
    dictionaryHash = meta ? asTrimmedString(meta.dictionaryHash) : null;

    const cta = isRecord((e.result as any).cta) ? ((e.result as any).cta as any) : null;
    ctaAction = cta ? asTrimmedString(cta.action) : null;

    const metaTouchedScopes = meta ? readJsonStringArray(meta.touchedScopes) : [];
    const metaOpsCount = meta && typeof meta.opsCount === 'number' && Number.isFinite(meta.opsCount) ? meta.opsCount : null;
    const metaUniquePathsTouched =
      meta && typeof meta.uniquePathsTouched === 'number' && Number.isFinite(meta.uniquePathsTouched) ? meta.uniquePathsTouched : null;

    const draftEdit = isRecord((e.result as any).draftEdit) ? ((e.result as any).draftEdit as any) : null;
    const opsRaw = Array.isArray(draftEdit?.ops) ? draftEdit.ops : (e.result as any).ops;
    if (metaOpsCount != null || metaUniquePathsTouched != null || metaTouchedScopes.length > 0) {
      opsCount = metaOpsCount ?? (Array.isArray(opsRaw) ? opsRaw.length : null);
      uniquePathsTouched = metaUniquePathsTouched;
      scopesTouched = metaTouchedScopes.length ? JSON.stringify(metaTouchedScopes) : null;
      if (!outcome) outcome = (opsCount ?? 0) > 0 ? 'draft_edit_returned' : 'no_ops';
    } else if (Array.isArray(opsRaw)) {
      opsCount = opsRaw.length;
      uniquePathsTouched = null;
      if (!outcome) outcome = opsRaw.length > 0 ? 'draft_edit_returned' : 'no_ops';
    } else if (!outcome) {
      outcome = 'no_ops';
    }
  }

  const provider = asTrimmedString(e.usage?.provider) ?? null;
  const model = asTrimmedString(e.usage?.model) ?? null;
  const latencyMs = typeof e.usage?.latencyMs === 'number' && Number.isFinite(e.usage.latencyMs) ? e.usage.latencyMs : null;
  const taskClass = asTrimmedString(e.ai?.taskClass) ?? null;

  try {
    await env.SF_D1.prepare(
      `INSERT OR REPLACE INTO copilot_events_v1
      (requestId, day, occurredAtMs, runtimeEnv, envStage, surfaceId, sessionId, instancePublicId, agentId, widgetType, intent, outcome, hasUrl, controlCount, opsCount, uniquePathsTouched, scopesTouched, ctaAction, promptVersion, policyVersion, dictionaryHash, taskClass, provider, model, latencyMs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        e.requestId,
        day,
        e.occurredAtMs,
        runtimeEnv,
        envStage,
        surfaceId,
        sessionId,
        instanceId,
        agentId,
        widgetType,
        intent,
        outcome,
        hasUrl,
        controlCount,
        opsCount,
        uniquePathsTouched,
        scopesTouched,
        ctaAction,
        promptVersion,
        policyVersion,
        dictionaryHash,
        taskClass,
        provider,
        model,
        latencyMs,
      )
      .run();
  } catch (err) {
    console.error('[sanfrancisco] D1 index insert failed', err);
  }
}

export async function persistOutcomeAttach(env: Env, body: OutcomeAttachRequest): Promise<void> {
  const day = toIsoDay(body.occurredAtMs);
  try {
    await env.SF_D1.prepare(
      `INSERT OR REPLACE INTO copilot_outcomes_v1
      (requestId, outcomeId, surfaceId, artifactId, event, day, occurredAtMs, sessionId, timeToDecisionMs, accountIdHash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        body.requestId,
        body.outcomeId ?? null,
        body.surfaceId ?? null,
        body.artifactId ?? null,
        body.event,
        day,
        body.occurredAtMs,
        body.sessionId,
        body.timeToDecisionMs ?? null,
        body.accountIdHash ?? null,
      )
      .run();
  } catch (err) {
    console.error('[sanfrancisco] outcome insert failed', err);
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Failed to persist outcome' });
  }
}
