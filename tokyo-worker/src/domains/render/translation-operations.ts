import {
  INSTANCE_TRANSLATION_AGENT_ID,
  INSTANCE_TRANSLATION_JOB_KIND,
  normalizeInstanceTranslationJob,
  type InstanceTranslationJob,
} from '@clickeen/ck-contracts/instance-translation-jobs';
import { resolveAiAgent } from '@clickeen/ck-contracts/ai';
import {
  buildFaqSavedTextGraph,
  faqFieldIdentityKey,
  type FaqSavedTextField,
} from '@clickeen/ck-contracts/faq-language-values';
import { resolveLanguageOverlayCode } from '@clickeen/ck-contracts/overlay-codebooks';
import {
  resolveAiRuntimeBudget,
  resolveAiRuntimePolicy,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import { normalizeLocale } from '../../asset-utils';
import type { Env } from '../../types';
import { getWidgetDefinition } from '../widget-catalog';
import {
  completeAccountInstanceTranslatedLocaleValues,
  readAccountInstanceContentDocument,
  readAccountInstanceCurrentTranslatedLocaleValues,
  readAccountInstanceDocument,
} from './saved-config';
import {
  readInstanceRegistryRow,
  updateInstanceRegistryTranslationStatus,
  type InstanceRegistryTranslationStatus,
} from './instance-registry';
import {
  deriveTranslationGenerationJob,
  readyLocalesForContent,
  readCurrentTranslationGenerationJob,
  summarizeTranslationGenerationJob,
  updateCurrentTranslationGenerationJob,
  writeCurrentTranslationGenerationJob,
} from './translation-generation-state';
import type {
  TranslationGenerationJobBasis,
  TranslationGenerationJobDocument,
  TranslationGenerationJobSummary,
} from './types';

type TranslationQueue = {
  send(message: InstanceTranslationJob): Promise<void>;
};

export type InstanceTranslationGenerationResult =
  | {
      ok: true;
      accepted: boolean;
      baseLocale: string;
      targetLocales: string[];
      queuedLocales: string[];
      skippedLocales: string[];
      jobIds: string[];
      generation: TranslationGenerationJobSummary | null;
      results: Array<{ locale: string; ok: true; jobId: string }>;
    }
  | {
      ok: false;
      accepted: false;
      baseLocale: string | null;
      reasonKey: string;
      detail: string;
      results: Array<{ locale: string; ok: false; reasonKey: string; detail: string; path?: string }>;
    };

export type LocaleTranslationCompletionResult =
  | { ok: true; applied: true; locale: string }
  | { ok: true; applied: false; locale: string; reasonKey: string; detail: string }
  | { ok: false; locale: string; reasonKey: string; detail: string };

export type LocaleTranslationFailureResult =
  | { ok: true; recorded: true; locale: string; reasonKey: string; detail: string }
  | { ok: true; recorded: false; locale: string; reasonKey: string; detail: string }
  | { ok: false; locale: string; reasonKey: string; detail: string };

export type InstanceTranslationGenerationReadResult =
  | { ok: true; generation: TranslationGenerationJobSummary }
  | { ok: false; reasonKey: string; detail: string };

function generationFailure(args: {
  baseLocale: string | null;
  locale?: string;
  reasonKey: string;
  detail: string;
  path?: string;
}): InstanceTranslationGenerationResult {
  return {
    ok: false,
    accepted: false,
    baseLocale: args.baseLocale,
    reasonKey: args.reasonKey,
    detail: args.detail,
    results: [
      {
        locale: args.locale ?? '<job>',
        ok: false,
        reasonKey: args.reasonKey,
        detail: args.detail,
        ...(args.path ? { path: args.path } : {}),
      },
    ],
  };
}

function normalizeLocaleList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => normalizeLocale(entry)).filter((entry): entry is string => Boolean(entry))),
  );
}

function resolveTranslationQueue(env: Env): TranslationQueue | null {
  const queue = env.INSTANCE_TRANSLATION_JOBS;
  return queue && typeof queue.send === 'function' ? queue : null;
}

function resolveTranslationRuntime(args: {
  authz: RomaAccountAuthzCapsulePayload;
}): Pick<InstanceTranslationJob, 'ai' | 'budgets'> | null {
  const agent = resolveAiAgent(INSTANCE_TRANSLATION_AGENT_ID);
  if (!agent) return null;
  const ai = resolveAiRuntimePolicy({
    entry: agent.entry,
    policyProfile: args.authz.profile,
  });
  const budget = resolveAiRuntimeBudget(ai);
  return {
    ai,
    budgets: {
      maxTokens: budget.maxTokens,
      ...(budget.timeoutMs ? { timeoutMs: budget.timeoutMs } : {}),
    },
  };
}

function deletedFieldKeys(args: {
  previousSavedTextGraph: FaqSavedTextField[];
  currentSavedTextGraph: FaqSavedTextField[];
}): string[] {
  const current = new Set(args.currentSavedTextGraph.map((field) => faqFieldIdentityKey(field.identity)));
  return args.previousSavedTextGraph
    .map((field) => faqFieldIdentityKey(field.identity))
    .filter((key) => !current.has(key));
}

function fieldComparable(field: FaqSavedTextField): string {
  return JSON.stringify({
    key: faqFieldIdentityKey(field.identity),
    path: field.identity.path,
    role: field.identity.role,
    sectionId: field.identity.sectionId ?? '',
    faqId: field.identity.faqId ?? '',
    type: field.type,
    label: field.label,
    baseText: field.baseText,
  });
}

function sameChangedFieldBasis(args: {
  currentSavedTextGraph: FaqSavedTextField[];
  jobChangedFields: FaqSavedTextField[];
}): boolean {
  const current = new Map(args.currentSavedTextGraph.map((field) => [faqFieldIdentityKey(field.identity), field]));
  return args.jobChangedFields.every((field) => {
    const latest = current.get(faqFieldIdentityKey(field.identity));
    return Boolean(latest) && fieldComparable(latest!) === fieldComparable(field);
  });
}

function buildJobBasis(jobs: InstanceTranslationJob[]): TranslationGenerationJobBasis {
  return jobs
    .map((job) => ({
      locale: job.targetLocale,
      fields: job.changedFields
        .map((field) => ({
          path: field.identity.path,
          baseText: field.baseText,
        }))
        .sort((left, right) => left.path.localeCompare(right.path)),
    }))
    .sort((left, right) => left.locale.localeCompare(right.locale));
}

function sameBasisFields(
  left: Array<{ path: string; baseText: string }> | undefined,
  right: Array<{ path: string; baseText: string }>,
): boolean {
  if (!left || left.length !== right.length) return false;
  return right.every((rightField, index) => {
    const leftField = left[index];
    return leftField?.path === rightField.path && leftField.baseText === rightField.baseText;
  });
}

function activeJobCoversBasis(job: TranslationGenerationJobDocument, basis: TranslationGenerationJobBasis): boolean {
  if (job.status !== 'queued' && job.status !== 'running') return false;
  const existing = new Map(job.basis.map((entry) => [entry.locale, entry.fields]));
  return basis.every((entry) => sameBasisFields(existing.get(entry.locale), entry.fields));
}

function createGenerationJobDocument(args: {
  jobId: string;
  accountId: string;
  instanceId: string;
  widgetType: string;
  baseLocale: string;
  targetLocales: string[];
  requestedAt: string;
  currentReadyLocales: string[];
  jobs: InstanceTranslationJob[];
  previous?: TranslationGenerationJobDocument | null;
}): TranslationGenerationJobDocument {
  const locales: TranslationGenerationJobDocument['locales'] = {};
  for (const job of args.jobs) {
    locales[job.targetLocale] = {
      locale: job.targetLocale,
      status: 'queued',
      paths: job.changedFields.map((field) => field.identity.path).sort((left, right) => left.localeCompare(right)),
      updatedAt: args.requestedAt,
    };
  }
  return deriveTranslationGenerationJob({
    job: {
      jobId: args.jobId,
      accountId: args.accountId,
      instanceId: args.instanceId,
      widgetType: args.widgetType,
      baseLocale: args.baseLocale,
      targetLocales: args.targetLocales,
      status: 'queued',
      requestedAt: args.requestedAt,
      updatedAt: args.requestedAt,
      totalLocales: args.jobs.length,
      completedLocales: [],
      failedLocales: [],
      supersededLocales: [],
      pendingLocales: args.jobs.map((job) => job.targetLocale).sort((left, right) => left.localeCompare(right)),
      currentReadyLocales: args.currentReadyLocales,
      locales,
      basis: buildJobBasis(args.jobs),
      ...(args.previous?.jobId ? { previousJobId: args.previous.jobId } : {}),
      ...(args.previous?.jobId ? { supersededJobIds: Array.from(new Set([...(args.previous.supersededJobIds ?? []), args.previous.jobId])) } : {}),
    },
  });
}

function uniqueJobIds(jobs: InstanceTranslationJob[]): string[] {
  return Array.from(new Set(jobs.map((job) => job.jobId)));
}

function resultsForJobs(jobs: InstanceTranslationJob[]): Array<{ locale: string; ok: true; jobId: string }> {
  return jobs.map((job) => ({ locale: job.targetLocale, ok: true, jobId: job.jobId }));
}

function composeTranslatedValues(args: {
  fields: FaqSavedTextField[];
  changedFields: FaqSavedTextField[];
  existingValues: Record<string, string>;
  completedValues: Record<string, string>;
}): Record<string, string> {
  const changedKeys = new Set(args.changedFields.map((field) => faqFieldIdentityKey(field.identity)));
  const values: Record<string, string> = {};
  for (const field of args.fields) {
    const key = faqFieldIdentityKey(field.identity);
    if (changedKeys.has(key)) {
      const translated = args.completedValues[field.identity.path];
      if (typeof translated !== 'string') {
        throw new Error(`instance.translation.missing_completed_value:${field.identity.path}`);
      }
      values[field.identity.path] = translated;
      continue;
    }
    const existing = args.existingValues[field.identity.path];
    if (typeof existing === 'string') {
      values[field.identity.path] = existing;
    }
  }
  return values;
}

function normalizeFailureText(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function registryStatusForGenerationStatus(
  status: TranslationGenerationJobSummary['status'],
): InstanceRegistryTranslationStatus {
  if (status === 'queued' || status === 'running' || status === 'failed') return status;
  return 'idle';
}

function registryStatusForGenerationJob(args: {
  instanceId: string;
  baseLocale: string;
  targetLocales: string[];
  currentReadyLocales: string[];
  job: TranslationGenerationJobDocument;
}): InstanceRegistryTranslationStatus {
  return registryStatusForGenerationStatus(
    summarizeTranslationGenerationJob({
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
      targetLocales: args.targetLocales,
      currentReadyLocales: args.currentReadyLocales,
      job: args.job,
    }).status,
  );
}

function applyRegistryStatusToGenerationSummary(args: {
  summary: TranslationGenerationJobSummary;
  registryStatus: InstanceRegistryTranslationStatus | null;
}): TranslationGenerationJobSummary {
  if (!args.registryStatus) return args.summary;
  if (args.registryStatus === 'queued' || args.registryStatus === 'running' || args.registryStatus === 'failed') {
    return { ...args.summary, status: args.registryStatus };
  }
  if (args.summary.status === 'completed' || args.summary.status === 'superseded') return args.summary;
  return { ...args.summary, status: 'idle' };
}

async function writeRegistryTranslationStatus(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  status: InstanceRegistryTranslationStatus;
}): Promise<void> {
  await updateInstanceRegistryTranslationStatus({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    translationStatus: args.status,
  });
}

export async function readInstanceTranslationGeneration(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<InstanceTranslationGenerationReadResult> {
  const instance = await readAccountInstanceDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!instance.ok) {
    return {
      ok: false,
      reasonKey: instance.reasonKey,
      detail: instance.reasonKey,
    };
  }
  const job = await readCurrentTranslationGenerationJob({
    env: args.env,
    accountId: args.accountId,
    widgetCode: instance.value.widgetCode,
    instanceId: args.instanceId,
  });
  const targetLocales = job?.targetLocales.length ? job.targetLocales : instance.value.targetLocales;
  const content = await readAccountInstanceContentDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: instance.value.widgetType,
  });
  if (!content.ok) {
    return {
      ok: false,
      reasonKey: content.reasonKey,
      detail: content.reasonKey,
    };
  }
  const currentReadyLocales = readyLocalesForContent(content.value, targetLocales);
  const registry = await readInstanceRegistryRow({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  return {
    ok: true,
    generation: applyRegistryStatusToGenerationSummary({
      registryStatus: registry?.translationStatus ?? null,
      summary: summarizeTranslationGenerationJob({
        instanceId: args.instanceId,
        baseLocale: instance.value.baseLocale,
        targetLocales,
        currentReadyLocales,
        job,
      }),
    }),
  };
}

export async function generateInstanceTranslations(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  authz: RomaAccountAuthzCapsulePayload;
  baseLocale?: unknown;
  targetLocales?: unknown;
  requestId?: string | null;
}): Promise<InstanceTranslationGenerationResult> {
  const queue = resolveTranslationQueue(args.env);
  if (!queue) {
    return generationFailure({
      baseLocale: null,
      reasonKey: 'instance.translation.queue_unavailable',
      detail: 'INSTANCE_TRANSLATION_JOBS queue binding is unavailable.',
    });
  }

  const instance = await readAccountInstanceDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!instance.ok) {
    return generationFailure({
      baseLocale: null,
      reasonKey: instance.reasonKey,
      detail: instance.reasonKey,
    });
  }

  const baseLocale = normalizeLocale(args.baseLocale) ?? instance.value.baseLocale;
  const requestedTargets = normalizeLocaleList(args.targetLocales);
  const targetLocales = (requestedTargets.length ? requestedTargets : instance.value.targetLocales)
    .filter((locale) => locale !== baseLocale);
  const uniqueTargetLocales = Array.from(new Set(targetLocales));
  if (!uniqueTargetLocales.length) {
    await writeRegistryTranslationStatus({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      status: 'idle',
    });
    return {
      ok: true,
      accepted: false,
      baseLocale,
      targetLocales: [],
      queuedLocales: [],
      skippedLocales: [],
      jobIds: [],
      generation: null,
      results: [],
    };
  }

  const runtime = resolveTranslationRuntime({ authz: args.authz });
  if (!runtime) {
    return generationFailure({
      baseLocale,
      reasonKey: 'instance.translation.agent_missing',
      detail: 'Missing AI registry entry for Instance Translation Agent.',
    });
  }

  const widgetDefinition = getWidgetDefinition(instance.value.widgetType);
  if (instance.value.widgetType !== 'faq' || !widgetDefinition?.editableFields || widgetDefinition.editableFields.widgetType !== 'faq') {
    return generationFailure({
      baseLocale,
      reasonKey: 'instance.translation.widget_unsupported',
      detail: `Translation jobs require a FAQ editable-fields contract for ${instance.value.widgetType}.`,
    });
  }

  let currentSavedTextGraph: FaqSavedTextField[];
  try {
    currentSavedTextGraph = buildFaqSavedTextGraph({
      contract: widgetDefinition.editableFields,
      config: instance.value.config,
      instanceId: args.instanceId,
    });
  } catch (error) {
    return generationFailure({
      baseLocale,
      reasonKey: 'instance.translation.contract_invalid',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  const content = await readAccountInstanceContentDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: instance.value.widgetType,
  });
  if (!content.ok) {
    return generationFailure({
      baseLocale,
      reasonKey: content.reasonKey,
      detail: content.reasonKey,
    });
  }

  const jobs: InstanceTranslationJob[] = [];
  const skippedLocales: string[] = [];
  const requestedAt = new Date().toISOString();
  const generationJobId = crypto.randomUUID();
  const currentReadyLocales = readyLocalesForContent(content.value, uniqueTargetLocales);

  for (const locale of uniqueTargetLocales) {
    if (!resolveLanguageOverlayCode(locale)) {
      return generationFailure({
        baseLocale,
        locale,
        reasonKey: 'instance.translation.language_unsupported',
        detail: `No overlay language code for locale ${locale}`,
      });
    }

    const previousSavedTextGraph = currentSavedTextGraph;
    const changedFields = currentSavedTextGraph.filter((field) => {
      const contentField = content.value.fields[field.identity.path];
      return (
        contentField?.localeStatus?.[locale] !== 'ok' ||
        typeof contentField?.translatedValues?.[locale] !== 'string'
      );
    });
    if (!changedFields.length) {
      skippedLocales.push(locale);
      continue;
    }

    jobs.push({
      v: 1,
      kind: INSTANCE_TRANSLATION_JOB_KIND,
      jobId: generationJobId,
      accountId: args.authz.accountId,
      accountPublicId: args.accountId,
      userId: args.authz.userId,
      instanceId: args.instanceId,
      widgetType: 'faq',
      widgetContractVersion: widgetDefinition.editableFields.v,
      baseLocale,
      targetLocale: locale,
      targetLocales: uniqueTargetLocales,
      requestedAt,
      ...(args.requestId ? { requestId: args.requestId } : {}),
      ai: runtime.ai,
      budgets: runtime.budgets,
      previousSavedTextGraph,
      currentSavedTextGraph,
      previousLanguageValues: [],
      changedFields,
      deletedFieldKeys: deletedFieldKeys({ previousSavedTextGraph, currentSavedTextGraph }),
    });
  }

  const existingJob = await readCurrentTranslationGenerationJob({
    env: args.env,
    accountId: args.accountId,
    widgetCode: instance.value.widgetCode,
    instanceId: args.instanceId,
  });

  if (!jobs.length) {
    const completedAt = new Date().toISOString();
    const completedJob = existingJob
      ? deriveTranslationGenerationJob({
          job: {
            ...existingJob,
            status: 'completed',
            updatedAt: completedAt,
            currentReadyLocales,
            locales: Object.fromEntries(Object.entries(existingJob.locales).map(([localeKey, state]) => [
              localeKey,
              {
                ...state,
                status: 'completed',
                updatedAt: completedAt,
              },
            ])),
          },
          currentReadyLocales,
        })
      : null;
    if (completedJob) {
      await writeCurrentTranslationGenerationJob({
        env: args.env,
        accountId: args.accountId,
        widgetCode: instance.value.widgetCode,
        instanceId: args.instanceId,
        job: completedJob,
      });
    }
    await writeRegistryTranslationStatus({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      status: 'idle',
    });
    return {
      ok: true,
      accepted: false,
      baseLocale,
      targetLocales: uniqueTargetLocales,
      queuedLocales: [],
      skippedLocales,
      jobIds: completedJob ? [completedJob.jobId] : [],
      generation: summarizeTranslationGenerationJob({
        instanceId: args.instanceId,
        baseLocale,
        targetLocales: uniqueTargetLocales,
        currentReadyLocales,
        job: completedJob,
      }),
      results: [],
    };
  }

  const basis = buildJobBasis(jobs);
  if (existingJob && activeJobCoversBasis(existingJob, basis)) {
    const generation = summarizeTranslationGenerationJob({
      instanceId: args.instanceId,
      baseLocale,
      targetLocales: uniqueTargetLocales,
      currentReadyLocales,
      job: existingJob,
    });
    await writeRegistryTranslationStatus({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      status: registryStatusForGenerationStatus(generation.status),
    });
    return {
      ok: true,
      accepted: true,
      baseLocale,
      targetLocales: uniqueTargetLocales,
      queuedLocales: generation.pendingLocales,
      skippedLocales,
      jobIds: generation.jobId ? [generation.jobId] : [],
      generation,
      results: generation.pendingLocales.map((locale) => ({ locale, ok: true, jobId: generation.jobId ?? existingJob.jobId })),
    };
  }

  const generationJob = createGenerationJobDocument({
    jobId: generationJobId,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: instance.value.widgetType,
    baseLocale,
    targetLocales: uniqueTargetLocales,
    requestedAt,
    currentReadyLocales,
    jobs,
    previous: existingJob,
  });
  await writeCurrentTranslationGenerationJob({
    env: args.env,
    accountId: args.accountId,
    widgetCode: instance.value.widgetCode,
    instanceId: args.instanceId,
    job: generationJob,
  });
  await writeRegistryTranslationStatus({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    status: 'queued',
  });

  try {
    await Promise.all(jobs.map((job) => queue.send(job)));
  } catch (error) {
    const failedAt = new Date().toISOString();
    await writeCurrentTranslationGenerationJob({
      env: args.env,
      accountId: args.accountId,
      widgetCode: instance.value.widgetCode,
      instanceId: args.instanceId,
      job: {
        ...generationJob,
        status: 'failed',
        updatedAt: failedAt,
        locales: Object.fromEntries(Object.entries(generationJob.locales).map(([locale, state]) => [
          locale,
          {
            ...state,
            status: 'failed',
            updatedAt: failedAt,
            reasonKey: 'instance.translation.queue_send_failed',
            detail: error instanceof Error ? error.message : String(error),
          },
        ])),
        reasonKey: 'instance.translation.queue_send_failed',
        detail: error instanceof Error ? error.message : String(error),
      },
    });
    await writeRegistryTranslationStatus({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      status: 'failed',
    });
    return generationFailure({
      baseLocale,
      reasonKey: 'instance.translation.queue_send_failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    ok: true,
    accepted: jobs.length > 0,
    baseLocale,
    targetLocales: uniqueTargetLocales,
    queuedLocales: jobs.map((job) => job.targetLocale),
    skippedLocales,
    jobIds: uniqueJobIds(jobs),
    generation: summarizeTranslationGenerationJob({
      instanceId: args.instanceId,
      baseLocale,
      targetLocales: uniqueTargetLocales,
      currentReadyLocales,
      job: generationJob,
    }),
    results: resultsForJobs(jobs),
  };
}

export async function completeLocaleTranslation(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  locale: string;
  job: unknown;
  values: Record<string, string>;
}): Promise<LocaleTranslationCompletionResult> {
  const locale = normalizeLocale(args.locale) ?? '';
  const job = normalizeInstanceTranslationJob(args.job);
  if (!locale || !job || job.accountPublicId !== args.accountId || job.instanceId !== args.instanceId || job.targetLocale !== locale) {
    return {
      ok: false,
      locale,
      reasonKey: 'instance.translation.completion_invalid',
      detail: 'translation completion payload does not match account, instance, or locale',
    };
  }

  const instance = await readAccountInstanceDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!instance.ok) {
    return {
      ok: false,
      locale,
      reasonKey: instance.reasonKey,
      detail: instance.reasonKey,
    };
  }
  const widgetDefinition = getWidgetDefinition(instance.value.widgetType);
  if (instance.value.widgetType !== 'faq' || !widgetDefinition?.editableFields || widgetDefinition.editableFields.widgetType !== 'faq') {
    return {
      ok: false,
      locale,
      reasonKey: 'instance.translation.widget_unsupported',
      detail: `Translation jobs require a FAQ editable-fields contract for ${instance.value.widgetType}.`,
    };
  }

  const currentJob = await readCurrentTranslationGenerationJob({
    env: args.env,
    accountId: args.accountId,
    widgetCode: instance.value.widgetCode,
    instanceId: args.instanceId,
  });
  if (!currentJob || currentJob.jobId !== job.jobId) {
    return {
      ok: true,
      applied: false,
      locale,
      reasonKey: 'instance.translation.job_superseded',
      detail: 'This translation job is no longer the current generation job for the instance.',
    };
  }

  let currentSavedTextGraph: FaqSavedTextField[];
  try {
    currentSavedTextGraph = buildFaqSavedTextGraph({
      contract: widgetDefinition.editableFields,
      config: instance.value.config,
      instanceId: args.instanceId,
    });
  } catch (error) {
    return {
      ok: false,
      locale,
      reasonKey: 'instance.translation.contract_invalid',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  if (!sameChangedFieldBasis({
    currentSavedTextGraph,
    jobChangedFields: job.changedFields,
  })) {
    const updatedJob = await updateCurrentTranslationGenerationJob({
      env: args.env,
      accountId: args.accountId,
      widgetCode: instance.value.widgetCode,
      instanceId: args.instanceId,
      update(current) {
        if (!current || current.jobId !== job.jobId || !current.locales[locale]) return current;
        return {
          ...current,
          updatedAt: new Date().toISOString(),
          locales: {
            ...current.locales,
            [locale]: {
              ...current.locales[locale],
              status: 'superseded',
              updatedAt: new Date().toISOString(),
              reasonKey: 'instance.translation.stale_source_text',
              detail: 'Current saved text for the translated fields no longer matches the translation job basis.',
            },
          },
        };
      },
    });
    if (updatedJob?.jobId === job.jobId) {
      await writeRegistryTranslationStatus({
        env: args.env,
        accountId: args.accountId,
        instanceId: args.instanceId,
        status: registryStatusForGenerationJob({
          instanceId: args.instanceId,
          baseLocale: updatedJob.baseLocale,
          targetLocales: updatedJob.targetLocales,
          currentReadyLocales: updatedJob.currentReadyLocales,
          job: updatedJob,
        }),
      });
    }
    return {
      ok: true,
      applied: false,
      locale,
      reasonKey: 'instance.translation.stale_source_text',
      detail: 'Current saved text for the translated fields no longer matches the translation job basis.',
    };
  }

  const existing = await readAccountInstanceCurrentTranslatedLocaleValues({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    locale,
  });

  let nextValues: Record<string, string>;
  try {
    nextValues = composeTranslatedValues({
      fields: currentSavedTextGraph,
      changedFields: job.changedFields,
      existingValues: existing.ok ? existing.value.values : {},
      completedValues: args.values,
    });
  } catch (error) {
    return {
      ok: false,
      locale,
      reasonKey: 'instance.translation.values_invalid',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    await completeAccountInstanceTranslatedLocaleValues({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      widgetType: instance.value.widgetType,
      locale,
      targetLocales: job.targetLocales,
      paths: job.changedFields.map((field) => field.identity.path),
      values: nextValues,
    });
  } catch (error) {
    return {
      ok: false,
      locale,
      reasonKey: 'instance.translation.values_invalid',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const content = await readAccountInstanceContentDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: instance.value.widgetType,
  });
  const readyLocales = content.ok
    ? readyLocalesForContent(content.value, currentJob.targetLocales)
    : currentJob.currentReadyLocales;
  const updatedJob = await updateCurrentTranslationGenerationJob({
    env: args.env,
    accountId: args.accountId,
    widgetCode: instance.value.widgetCode,
    instanceId: args.instanceId,
    update(current) {
      if (!current || current.jobId !== job.jobId || !current.locales[locale]) return current;
      return {
        ...current,
        updatedAt: new Date().toISOString(),
        currentReadyLocales: readyLocales,
        locales: {
          ...current.locales,
          [locale]: {
            ...current.locales[locale],
            status: 'completed',
            updatedAt: new Date().toISOString(),
          },
        },
      };
    },
  });
  if (updatedJob?.jobId === job.jobId) {
    await writeRegistryTranslationStatus({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      status: registryStatusForGenerationJob({
        instanceId: args.instanceId,
        baseLocale: updatedJob.baseLocale,
        targetLocales: updatedJob.targetLocales,
        currentReadyLocales: readyLocales,
        job: updatedJob,
      }),
    });
  }

  return { ok: true, applied: true, locale };
}

export async function failLocaleTranslation(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  locale: string;
  job: unknown;
  reasonKey?: unknown;
  detail?: unknown;
}): Promise<LocaleTranslationFailureResult> {
  const locale = normalizeLocale(args.locale) ?? '';
  const job = normalizeInstanceTranslationJob(args.job);
  const reasonKey = normalizeFailureText(args.reasonKey, 'instance.translation.failed');
  const detail = normalizeFailureText(args.detail, reasonKey);
  if (!locale || !job || job.accountPublicId !== args.accountId || job.instanceId !== args.instanceId || job.targetLocale !== locale) {
    return {
      ok: false,
      locale,
      reasonKey: 'instance.translation.failure_invalid',
      detail: 'translation failure payload does not match account, instance, or locale',
    };
  }

  const instance = await readAccountInstanceDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!instance.ok) {
    return {
      ok: false,
      locale,
      reasonKey: instance.reasonKey,
      detail: instance.reasonKey,
    };
  }

  const recorded = await updateCurrentTranslationGenerationJob({
    env: args.env,
    accountId: args.accountId,
    widgetCode: instance.value.widgetCode,
    instanceId: args.instanceId,
    update(current) {
      if (!current || current.jobId !== job.jobId || !current.locales[locale]) return current;
      const now = new Date().toISOString();
      return {
        ...current,
        updatedAt: now,
        reasonKey,
        detail,
        locales: {
          ...current.locales,
          [locale]: {
            ...current.locales[locale],
            status: 'failed',
            updatedAt: now,
            reasonKey,
            detail,
          },
        },
      };
    },
  });

  if (!recorded || recorded.jobId !== job.jobId || !recorded.locales[locale] || recorded.locales[locale]?.status !== 'failed') {
    return {
      ok: true,
      recorded: false,
      locale,
      reasonKey: 'instance.translation.job_superseded',
      detail: 'This translation job is no longer the current generation job for the instance.',
    };
  }
  await writeRegistryTranslationStatus({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    status: 'failed',
  });

  return {
    ok: true,
    recorded: true,
    locale,
    reasonKey,
    detail,
  };
}
