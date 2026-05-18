import {
  normalizeInstanceTranslationJob,
  INSTANCE_TRANSLATION_AGENT_ID,
  type InstanceTranslationJob,
} from '@clickeen/ck-contracts/instance-translation-jobs';
import {
  buildCurrentLanguageValues,
  type FaqSavedTextField,
} from '@clickeen/ck-contracts/faq-language-values';
import { validateOverlayValuesForProducerItems } from '@clickeen/ck-contracts/overlay-primitives';
import { HttpError } from './http';
import {
  produceCurrentLanguageValues,
} from './l10n-account-routes';
import { writeInstanceLanguageOverlayToTokyo } from './tokyo-translation-client';
import type { AIGrant, Env, Usage } from './types';

type QueueMessage = Message<unknown>;

function fieldToTranslationItem(field: FaqSavedTextField) {
  return {
    path: field.identity.path,
    type: field.type,
    label: field.label,
    role: field.identity.role,
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

function overlayValuesFromMerged(merged: Extract<ReturnType<typeof buildCurrentLanguageValues>, { ok: true }>): Record<string, string> {
  return Object.fromEntries(
    merged.values.map((value) => [value.identity.path, value.value]),
  );
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

  const changedByPath = new Map(job.changedFields.map((field) => [field.identity.path, field]));
  const merged = buildCurrentLanguageValues({
    previousSavedTextGraph: job.previousSavedTextGraph,
    currentSavedTextGraph: job.currentSavedTextGraph,
    previousLanguageValues: job.previousLanguageValues,
    translatedValues: Object.entries(produced.values).map(([path, value]) => {
      const field = changedByPath.get(path);
      if (!field) {
        throw new HttpError(502, {
          code: 'PROVIDER_ERROR',
          provider: 'sanfrancisco',
          message: `Instance Translation Agent returned unknown path: ${path}`,
        });
      }
      return {
        identity: field.identity,
        value,
      };
    }),
    locale: job.targetLocale,
    updatedAt: new Date().toISOString(),
    jobId: job.jobId,
  });
  if (!merged.ok) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: `current language merge failed: ${merged.reason}:${merged.fieldKey}`,
    });
  }

  const values = overlayValuesFromMerged(merged);
  const validation = validateOverlayValuesForProducerItems(
    job.currentSavedTextGraph.map(fieldToTranslationItem),
    values,
  );
  if (!validation.ok) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: `merged overlay values ${validation.reason}: ${validation.path}`,
    });
  }

  const stored = await writeInstanceLanguageOverlayToTokyo({
    env,
    accountPublicId: job.accountPublicId,
    instanceId: job.instanceId,
    widgetType: job.widgetType,
    targetLocale: job.targetLocale,
    values,
    requestId: job.requestId,
  });

  if (env.SF_EVENTS) {
    await env.SF_EVENTS.send({
      v: 1,
      requestId: job.requestId ?? job.jobId,
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
        previousSavedTextGraph: `[${job.previousSavedTextGraph.length} fields]`,
        currentSavedTextGraph: `[${job.currentSavedTextGraph.length} fields]`,
        previousLanguageValues: `[${job.previousLanguageValues.length} values]`,
        changedFields: `[${job.changedFields.length} fields]`,
      },
      result: {
        operation: 'translate_saved_instance',
        outcome: 'overlay_written',
        targetLocale: job.targetLocale,
        overlayId: stored.overlayId,
      },
      usage: produced.usage ?? usageForFailure(job, startedAtMs),
    });
  }
}

function retryDelaySeconds(attempt: number): number {
  return Math.min(90, 5 * Math.max(1, attempt));
}

function isNonRetryable(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false;
  if (error.status === 400 || error.status === 403 || error.status === 404 || error.status === 422) {
    return true;
  }
  const message = String(error.error?.message || '').toLowerCase();
  return (
    message.includes('missing deepseek_api_key') ||
    message.includes('missing openai_api_key')
  );
}

export function isInstanceTranslationQueueMessage(value: unknown): value is InstanceTranslationJob {
  return normalizeInstanceTranslationJob(value) != null;
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
      console.error(
        '[sanfrancisco] instance translation job failed permanently',
        job.jobId,
        job.accountPublicId,
        job.instanceId,
        job.targetLocale,
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
      `attempt=${attempt}`,
      message,
    );
    msg.retry({ delaySeconds: retryDelaySeconds(attempt) });
  }
  return true;
}
