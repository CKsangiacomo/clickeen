import {
  INSTANCE_TRANSLATION_JOB_KIND,
  normalizeInstanceTranslationJob,
  INSTANCE_TRANSLATION_AGENT_ID,
  type InstanceTranslationJob,
} from '@clickeen/ck-contracts/instance-translation-jobs';
import type { SavedTextField } from '@clickeen/ck-contracts/translated-value-primitives';
import { validateTranslatedValuesForProducerItems } from '@clickeen/ck-contracts/translated-value-primitives';
import { HttpError, isRecord } from './http';
import {
  produceCurrentLanguageValues,
} from './l10n-account-routes';
import {
  completeLocaleTranslationInTokyo,
  failLocaleTranslationInTokyo,
} from './tokyo-translation-client';
import type { AIGrant, Env } from './types';

type QueueMessage = Message<unknown>;

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
      ...(produced.usage ? { usage: produced.usage } : {}),
    });
  }
}

async function reportTerminalFailureToTokyo(args: {
  env: Env;
  job: InstanceTranslationJob;
  error: unknown;
}): Promise<void> {
  const detail = args.error instanceof Error ? args.error.message : String(args.error);
  const failure = await failLocaleTranslationInTokyo({
    env: args.env,
    accountPublicId: args.job.accountPublicId,
    instanceId: args.job.instanceId,
    targetLocale: args.job.targetLocale,
    job: args.job,
    reasonKey: 'instance.translation.failed',
    detail,
    requestId: args.job.requestId,
  });
  if (!failure.recorded) throw new HttpError(409, { code: 'PROVIDER_ERROR', provider: 'tokyo', message: 'instance.translation.failure_not_recorded' });
}

export function isInstanceTranslationQueuePayload(value: unknown): boolean {
  return isRecord(value) && value.kind === INSTANCE_TRANSLATION_JOB_KIND;
}

export async function handleInstanceTranslationQueueMessage(env: Env, msg: QueueMessage): Promise<boolean> {
  const job = normalizeInstanceTranslationJob(msg.body);
  if (!job) {
    const rawJob = isRecord(msg.body) ? msg.body : {};
    const accountPublicId = typeof rawJob.accountPublicId === 'string' ? rawJob.accountPublicId : '';
    const instanceId = typeof rawJob.instanceId === 'string' ? rawJob.instanceId : '';
    const targetLocale = typeof rawJob.targetLocale === 'string' ? rawJob.targetLocale : '';
    if (!accountPublicId || !instanceId || !targetLocale) {
      throw new HttpError(422, {
        code: 'BAD_REQUEST',
        message: 'Invalid instance translation queue job target',
      });
    }
    const failure = await failLocaleTranslationInTokyo({
      env,
      accountPublicId,
      instanceId,
      targetLocale,
      job: msg.body,
      reasonKey: 'instance.translation.invalid_job',
      detail: 'Invalid instance translation queue job.',
      requestId: typeof rawJob.requestId === 'string' ? rawJob.requestId : undefined,
    });
    if (!failure.recorded) throw new HttpError(409, { code: 'PROVIDER_ERROR', provider: 'tokyo', message: 'instance.translation.failure_not_recorded' });
    msg.ack();
    return true;
  }

  try {
    await executeInstanceTranslationJob(env, job);
    msg.ack();
  } catch (error) {
    await reportTerminalFailureToTokyo({ env, job, error });
    msg.ack();
  }
  return true;
}

export async function handleInstanceTranslationQueueBatch(
  env: Env,
  messages: QueueMessage[],
): Promise<void> {
  for (const msg of messages) await handleInstanceTranslationQueueMessage(env, msg);
}
