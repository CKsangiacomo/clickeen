import {
  normalizeInstanceTranslationJob,
  INSTANCE_TRANSLATION_JOB_KIND,
  INSTANCE_TRANSLATION_AGENT_ID,
  type InstanceTranslationJob,
} from '@clickeen/ck-contracts/instance-translation-jobs';
import type { SavedTextField } from '@clickeen/ck-contracts/translated-value-primitives';
import { validateTranslatedValuesForProducerItems } from '@clickeen/ck-contracts/translated-value-primitives';
import { HttpError } from './http';
import {
  produceCurrentLanguageValues,
} from './l10n-account-routes';
import {
  completeLocaleTranslationInTokyo,
  failLocaleTranslationInTokyo,
} from './tokyo-translation-client';
import type { AIGrant, Env, Usage } from './types';

type QueueMessage = Message<unknown>;
const INSTANCE_TRANSLATION_CONCURRENCY = 4;

function fieldToTranslationItem(field: SavedTextField) {
  return {
    path: field.path,
    type: field.type,
    label: field.label,
    role: field.role,
    value: field.baseText,
  };
}

function buildGrant(job: InstanceTranslationJob): AIGrant {
  return {
    v: 1,
    iss: 'roma',
    jti: job.jobId,
    sub: { kind: 'user', userId: job.userId, accountId: job.accountId },
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
    caps: [`agent:${INSTANCE_TRANSLATION_AGENT_ID}`],
    budgets: job.budgets,
    mode: 'ops',
    ai: job.ai,
    trace: {
      sessionId: job.requestId ?? job.jobId,
      instancePublicId: job.instanceId,
      envStage: job.ai.policyProfile,
    },
  };
}

function usageForFailure(job: InstanceTranslationJob, startedAtMs: number): Usage {
  const model = job.ai.selectedModel ?? job.ai.defaultModel;
  return {
    provider: model.provider,
    model: model.model,
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: Math.max(0, Date.now() - startedAtMs),
  };
}

async function executeInstanceTranslationJob(env: Env, job: InstanceTranslationJob): Promise<void> {
  const startedAtMs = Date.now();
  const grant = buildGrant(job);
  const produced =
    job.changedFields.length > 0
      ? await produceCurrentLanguageValues({
          env,
          grant,
          request: {
            v: 1,
            widgetType: job.widgetType,
            sourceLanguage: job.baseLocale,
            targetLanguage: job.targetLocale,
            items: job.changedFields.map(fieldToTranslationItem),
          },
        })
      : { v: 1 as const, values: {} };

  const changedByPath = new Map(job.changedFields.map((field) => [field.path, field]));
  for (const path of Object.keys(produced.values)) {
    if (!changedByPath.has(path)) {
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider: 'sanfrancisco',
        message: `Instance Translation Agent returned unknown path: ${path}`,
      });
    }
  }
  const changedValidation = validateTranslatedValuesForProducerItems(
    job.changedFields.map(fieldToTranslationItem),
    produced.values,
  );
  if (!changedValidation.ok) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: `changed translation values ${changedValidation.reason}: ${changedValidation.path}`,
    });
  }

  const completion = await completeLocaleTranslationInTokyo({
    env,
    accountPublicId: job.accountPublicId,
    instanceId: job.instanceId,
    targetLocale: job.targetLocale,
    job,
    values: produced.values,
    requestId: job.requestId,
  });

  if (env.SF_EVENTS) {
    await env.SF_EVENTS.send({
      v: 1,
      requestId: job.jobId,
      agentId: INSTANCE_TRANSLATION_AGENT_ID,
      occurredAtMs: startedAtMs,
      subject: grant.sub,
      trace: grant.trace,
      ai: {
        policyProfile: job.ai.policyProfile,
        policyVersion: job.ai.policyVersion,
        learningCapture: job.ai.learningCapture,
        taskClass: 'l10n.instance',
      },
      input: {
        ...job,
        changedFields: `[${job.changedFields.length} fields]`,
        basis: `[${job.basis.fields.length} fields]`,
      },
      result: {
        operation: 'translate_saved_instance',
        outcome: completion.applied ? 'locale_translation_completed' : 'stale_completion_ignored',
        targetLocale: job.targetLocale,
        ...(completion.reasonKey ? { reasonKey: completion.reasonKey } : {}),
        ...(completion.detail ? { detail: completion.detail } : {}),
      },
      usage: produced.usage ?? usageForFailure(job, startedAtMs),
    });
  }
}

function retryDelaySeconds(attempt: number): number {
  return Math.min(90, 5 * Math.max(1, attempt));
}

function retryJitterSeconds(jobId: string, attempt: number): number {
  let checksum = attempt;
  for (let index = 0; index < jobId.length; index += 1) {
    checksum = (checksum + jobId.charCodeAt(index)) % 997;
  }
  return checksum % 7;
}

function modelLabel(job: InstanceTranslationJob): string {
  const model = job.ai.selectedModel ?? job.ai.defaultModel;
  return `${job.ai.policyProfile}:${model.provider}:${model.model}`;
}

export function isNonRetryable(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false;
  if (error.status === 400 || error.status === 403 || error.status === 404 || error.status === 422) {
    return true;
  }
  const message = String(error.error?.message || '').toLowerCase();
  return (
    message.includes('unknown path') ||
    message.includes('translation values') ||
    message.includes('missing_path') ||
    message.includes('extra_path') ||
    message.includes('invalid_value') ||
    message.includes('missing deepseek_api_key') ||
    message.includes('missing openai_api_key')
  );
}

function terminalFailureReasonKey(error: unknown, attempt: number): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (
    message.includes('unknown path') ||
    message.includes('values_invalid') ||
    message.includes('output missing') ||
    message.includes('output extra') ||
    message.includes('translation values')
  ) {
    return 'instance.translation.validation_failed';
  }
  if (isNonRetryable(error)) return 'instance.translation.provider_unavailable';
  if (attempt >= 8) return 'instance.translation.retry_exhausted';
  return 'instance.translation.provider_failed';
}

async function reportTerminalFailureToTokyo(args: {
  env: Env;
  job: InstanceTranslationJob;
  attempt: number;
  error: unknown;
}): Promise<void> {
  const detail = args.error instanceof Error ? args.error.message : String(args.error);
  const reasonKey = terminalFailureReasonKey(args.error, args.attempt);
  const startedAtMs = Date.now();
  const failure = await failLocaleTranslationInTokyo({
    env: args.env,
    accountPublicId: args.job.accountPublicId,
    instanceId: args.job.instanceId,
    targetLocale: args.job.targetLocale,
    job: args.job,
    reasonKey,
    detail,
    requestId: args.job.requestId,
  });
  if (args.env.SF_EVENTS) {
    await args.env.SF_EVENTS.send({
      v: 1,
      requestId: args.job.jobId,
      agentId: INSTANCE_TRANSLATION_AGENT_ID,
      occurredAtMs: startedAtMs,
      subject: { kind: 'user', userId: args.job.userId, accountId: args.job.accountId },
      trace: {
        sessionId: args.job.requestId ?? args.job.jobId,
        instancePublicId: args.job.instanceId,
        envStage: args.job.ai.policyProfile,
      },
      ai: {
        policyProfile: args.job.ai.policyProfile,
        policyVersion: args.job.ai.policyVersion,
        learningCapture: args.job.ai.learningCapture,
        taskClass: 'l10n.instance',
      },
      input: {
        ...args.job,
        changedFields: `[${args.job.changedFields.length} fields]`,
        basis: `[${args.job.basis.fields.length} fields]`,
      },
      result: {
        operation: 'translate_saved_instance',
        outcome: failure.recorded ? 'locale_translation_failed' : 'stale_failure_ignored',
        targetLocale: args.job.targetLocale,
        reasonKey: failure.reasonKey ?? reasonKey,
        detail: failure.detail ?? detail,
      },
      usage: usageForFailure(args.job, startedAtMs),
    });
  }
}

export function isInstanceTranslationQueueMessage(value: unknown): value is InstanceTranslationJob {
  return normalizeInstanceTranslationJob(value) != null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isInstanceTranslationShapedQueueMessage(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    value.kind === INSTANCE_TRANSLATION_JOB_KIND ||
    (value.v === 2 &&
      typeof value.jobId === 'string' &&
      typeof value.instanceId === 'string' &&
      typeof value.targetLocale === 'string')
  );
}

export function summarizeInstanceTranslationQueuePayload(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return { type: typeof value };
  return {
    v: value.v,
    kind: value.kind,
    jobId: value.jobId,
    accountPublicId: value.accountPublicId,
    instanceId: value.instanceId,
    targetLocale: value.targetLocale,
    hasBaseContentMarker: typeof value.baseContentMarker === 'string' && value.baseContentMarker.trim().length > 0,
    hasGenerationRequestMarker:
      typeof value.generationRequestMarker === 'string' && value.generationRequestMarker.trim().length > 0,
  };
}

export async function handleInstanceTranslationQueueMessage(env: Env, msg: QueueMessage): Promise<boolean> {
  const job = normalizeInstanceTranslationJob(msg.body);
  if (!job) return false;

  try {
    await executeInstanceTranslationJob(env, job);
    msg.ack();
  } catch (error) {
    const attempt =
      typeof msg.attempts === 'number' && Number.isFinite(msg.attempts) ? msg.attempts : 0;
    const message = error instanceof Error ? error.message : String(error);
    if (isNonRetryable(error) || attempt >= 8) {
      try {
        await reportTerminalFailureToTokyo({ env, job, attempt, error });
      } catch (reportError) {
        const reportMessage = reportError instanceof Error ? reportError.message : String(reportError);
        console.error(
          '[sanfrancisco] failed to report terminal instance translation outcome to Tokyo',
          job.jobId,
          job.accountPublicId,
          job.instanceId,
          job.targetLocale,
          modelLabel(job),
          `attempt=${attempt}`,
          reportMessage,
        );
        msg.retry({ delaySeconds: retryDelaySeconds(attempt) + retryJitterSeconds(job.jobId, attempt) });
        return true;
      }
      console.error(
        '[sanfrancisco] instance translation job failed permanently',
        job.jobId,
        job.accountPublicId,
        job.instanceId,
        job.targetLocale,
        modelLabel(job),
        `attempt=${attempt}`,
        message,
      );
      msg.ack();
      return true;
    }
    console.warn(
      '[sanfrancisco] instance translation job failed, retrying',
      job.jobId,
      job.accountPublicId,
      job.instanceId,
      job.targetLocale,
      modelLabel(job),
      `attempt=${attempt}`,
      message,
    );
    msg.retry({ delaySeconds: retryDelaySeconds(attempt) + retryJitterSeconds(job.jobId, attempt) });
  }
  return true;
}

export async function handleInstanceTranslationQueueBatch(
  env: Env,
  messages: QueueMessage[],
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(INSTANCE_TRANSLATION_CONCURRENCY, messages.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = nextIndex;
        nextIndex += 1;
        const msg = messages[index];
        if (!msg) return;
        await handleInstanceTranslationQueueMessage(env, msg);
      }
    }),
  );
}
