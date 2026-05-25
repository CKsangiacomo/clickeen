import {
  INSTANCE_TRANSLATION_AGENT_ID,
  INSTANCE_TRANSLATION_JOB_KIND,
  normalizeInstanceTranslationJob,
  type InstanceTranslationJob,
} from '@clickeen/ck-contracts/instance-translation-jobs';
import { resolveAiAgent } from '@clickeen/ck-contracts/ai';
import {
  extractSavedTextFieldsForEditableFields,
  widgetEditableFieldsContractHash,
  type SavedTextField,
} from '@clickeen/ck-contracts/translated-value-primitives';
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
  productLocaleStatesForContent,
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

const TRANSLATION_GENERATION_ACTIVE_TIMEOUT_MS = 10 * 60 * 1000;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableFnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function buildBaseContentMarker(args: {
  baseLocale: string;
  widgetType: string;
  widgetContractHash: string;
  fields: SavedTextField[];
}): string {
  return stableFnv1a(stableJson({
    v: 1,
    baseLocale: args.baseLocale,
    widgetType: args.widgetType,
    widgetContractHash: args.widgetContractHash,
    fields: args.fields
      .map((field) => ({
        identityKey: field.identityKey,
        fieldPattern: field.fieldPattern,
        path: field.path,
        baseText: field.baseText,
      }))
      .sort((left, right) => left.identityKey.localeCompare(right.identityKey)),
  }));
}

function buildGenerationRequestMarker(args: {
  baseContentMarker: string;
  targetLocales: string[];
}): string {
  return stableFnv1a(stableJson({
    v: 1,
    baseContentMarker: args.baseContentMarker,
    targetLocales: [...args.targetLocales].sort((left, right) => left.localeCompare(right)),
  }));
}

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

function deletedIdentityKeys(args: {
  previousSavedTextFields: SavedTextField[];
  currentSavedTextFields: SavedTextField[];
}): string[] {
  const current = new Set(args.currentSavedTextFields.map((field) => field.identityKey));
  return args.previousSavedTextFields
    .map((field) => field.identityKey)
    .filter((key) => !current.has(key));
}

function fieldComparable(field: SavedTextField): string {
  return JSON.stringify({
    identityKey: field.identityKey,
    fieldPattern: field.fieldPattern,
    path: field.path,
    role: field.role,
    type: field.type,
    label: field.label,
    baseText: field.baseText,
  });
}

function sameJobBasis(args: {
  currentSavedTextFields: SavedTextField[];
  job: InstanceTranslationJob;
  widgetContractHash: string;
}): boolean {
  if (args.job.widgetContract.hash !== args.widgetContractHash) return false;
  const currentBasis = args.currentSavedTextFields
    .map((field) => ({
      identityKey: field.identityKey,
      fieldPattern: field.fieldPattern,
      path: field.path,
      baseText: field.baseText,
    }))
    .sort((left, right) => left.identityKey.localeCompare(right.identityKey));
  const jobBasis = [...args.job.basis.fields].sort((left, right) => left.identityKey.localeCompare(right.identityKey));
  return JSON.stringify(currentBasis) === JSON.stringify(jobBasis);
}

function baseContentMarkerForJob(job: InstanceTranslationJob): string {
  if (job.baseContentMarker) return job.baseContentMarker;
  return stableFnv1a(stableJson({
    v: 1,
    baseLocale: job.baseLocale,
    widgetType: job.widgetType,
    widgetContractHash: job.widgetContract.hash,
    fields: [...job.basis.fields].sort((left, right) => left.identityKey.localeCompare(right.identityKey)),
  }));
}

function currentJobMatchesCompletionJob(current: TranslationGenerationJobDocument, job: InstanceTranslationJob): boolean {
  return current.baseContentMarker
    ? current.baseContentMarker === baseContentMarkerForJob(job)
    : current.jobId === job.jobId;
}

function buildJobBasis(jobs: InstanceTranslationJob[]): TranslationGenerationJobBasis {
  return jobs
    .map((job) => ({
      locale: job.targetLocale,
      widgetContract: job.widgetContract,
      fields: job.basis.fields
        .map((field) => ({ ...field }))
        .sort((left, right) => left.identityKey.localeCompare(right.identityKey)),
    }))
    .sort((left, right) => left.locale.localeCompare(right.locale));
}

function createGenerationJobDocument(args: {
  jobId: string;
  baseContentMarker: string;
  generationRequestMarker: string;
  accountId: string;
  instanceId: string;
  widgetType: string;
  baseLocale: string;
  targetLocales: string[];
  requestedAt: string;
  currentReadyLocales: string[];
  jobs: InstanceTranslationJob[];
}): TranslationGenerationJobDocument {
  const locales: TranslationGenerationJobDocument['locales'] = {};
  for (const job of args.jobs) {
    locales[job.targetLocale] = {
      locale: job.targetLocale,
      status: 'queued',
      paths: job.changedFields.map((field) => field.path).sort((left, right) => left.localeCompare(right)),
      updatedAt: args.requestedAt,
    };
  }
  return deriveTranslationGenerationJob({
    job: {
      jobId: args.jobId,
      baseContentMarker: args.baseContentMarker,
      generationRequestMarker: args.generationRequestMarker,
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
  fields: SavedTextField[];
  changedFields: SavedTextField[];
  existingValues: Record<string, string>;
  completedValues: Record<string, string>;
}): Record<string, string> {
  const changedKeys = new Set(args.changedFields.map((field) => field.identityKey));
  const values: Record<string, string> = {};
  for (const field of args.fields) {
    const key = field.identityKey;
    if (changedKeys.has(key)) {
      const translated = args.completedValues[field.path];
      if (typeof translated !== 'string') {
        throw new Error(`instance.translation.missing_completed_value:${field.path}`);
      }
      values[field.path] = translated;
      continue;
    }
    const existing = args.existingValues[field.path];
    if (typeof existing === 'string') {
      values[field.path] = existing;
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
  currentBaseContentMarker?: string;
  currentGenerationRequestMarker?: string;
  outOfSyncLocales?: string[];
  productLocales?: TranslationGenerationJobSummary['locales'];
  job: TranslationGenerationJobDocument;
}): InstanceRegistryTranslationStatus {
  return registryStatusForGenerationStatus(
    summarizeTranslationGenerationJob({
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
      targetLocales: args.targetLocales,
      currentReadyLocales: args.currentReadyLocales,
      currentBaseContentMarker: args.currentBaseContentMarker,
      currentGenerationRequestMarker: args.currentGenerationRequestMarker,
      outOfSyncLocales: args.outOfSyncLocales,
      productLocales: args.productLocales,
      job: args.job,
    }).status,
  );
}

function applyRegistryStatusToGenerationSummary(args: {
  summary: TranslationGenerationJobSummary;
  registryStatus: InstanceRegistryTranslationStatus | null;
}): TranslationGenerationJobSummary {
  if (!args.registryStatus) return args.summary;
  if (
    args.summary.status === 'idle' ||
    args.summary.status === 'completed' ||
    args.summary.status === 'failed' ||
    args.summary.status === 'superseded'
  ) {
    return args.summary;
  }
  if (args.registryStatus === 'queued' || args.registryStatus === 'running' || args.registryStatus === 'failed') {
    return { ...args.summary, status: args.registryStatus };
  }
  return { ...args.summary, status: 'idle' };
}

function isActiveGenerationSummary(summary: TranslationGenerationJobSummary): boolean {
  return summary.status === 'queued' || summary.status === 'running';
}

function shouldTimeoutGeneration(summary: TranslationGenerationJobSummary): boolean {
  if (!isActiveGenerationSummary(summary) || !summary.requestedAt) return false;
  const requestedAtMs = Date.parse(summary.requestedAt);
  return Number.isFinite(requestedAtMs) && Date.now() - requestedAtMs >= TRANSLATION_GENERATION_ACTIVE_TIMEOUT_MS;
}

async function timeoutStalledGeneration(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetCode: string;
  baseLocale: string;
  targetLocales: string[];
  currentReadyLocales: string[];
  outOfSyncLocales?: string[];
  currentBaseContentMarker?: string;
  currentGenerationRequestMarker?: string;
  productLocales?: TranslationGenerationJobSummary['locales'];
  job: TranslationGenerationJobDocument | null;
  summary: TranslationGenerationJobSummary;
}): Promise<TranslationGenerationJobSummary> {
  if (!args.job || !shouldTimeoutGeneration(args.summary)) return args.summary;
  const now = new Date().toISOString();
  const timedOutJob = deriveTranslationGenerationJob({
    job: {
      ...args.job,
      status: 'failed',
      updatedAt: now,
      reasonKey: 'instance.translation.timed_out',
      detail: 'Translation generation timed out before all locale jobs reported completion or failure.',
      locales: Object.fromEntries(Object.entries(args.job.locales).map(([locale, state]) => [
        locale,
        state.status === 'queued'
          ? {
              ...state,
              status: 'failed' as const,
              updatedAt: now,
              reasonKey: 'instance.translation.timed_out',
              detail: 'Translation job did not report completion or failure before the generation timeout.',
            }
          : state,
      ])),
    },
    currentReadyLocales: args.currentReadyLocales,
    updatedAt: now,
  });
  await writeCurrentTranslationGenerationJob({
    env: args.env,
    accountId: args.accountId,
    widgetCode: args.widgetCode,
    instanceId: args.instanceId,
    job: timedOutJob,
  });
  await writeRegistryTranslationStatus({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    status: 'failed',
  });
  return summarizeTranslationGenerationJob({
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    targetLocales: args.targetLocales,
    currentReadyLocales: args.currentReadyLocales,
    outOfSyncLocales: args.outOfSyncLocales,
    currentBaseContentMarker: args.currentBaseContentMarker,
    currentGenerationRequestMarker: args.currentGenerationRequestMarker,
    productLocales: args.productLocales,
    job: timedOutJob,
  });
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
  const widgetDefinition = getWidgetDefinition(instance.value.widgetType);
  let currentBaseContentMarker: string | undefined;
  let currentGenerationRequestMarker: string | undefined;
  if (widgetDefinition?.editableFields) {
    try {
      const fields = extractSavedTextFieldsForEditableFields({
        contract: widgetDefinition.editableFields,
        config: instance.value.config,
      });
      currentBaseContentMarker = buildBaseContentMarker({
        baseLocale: instance.value.baseLocale,
        widgetType: instance.value.widgetType,
        widgetContractHash: widgetEditableFieldsContractHash(widgetDefinition.editableFields),
        fields,
      });
      currentGenerationRequestMarker = buildGenerationRequestMarker({
        baseContentMarker: currentBaseContentMarker,
        targetLocales,
      });
    } catch {
      currentBaseContentMarker = undefined;
      currentGenerationRequestMarker = undefined;
    }
  }
  const productLocales = productLocaleStatesForContent({
    content: content.value,
    targetLocales,
    currentBaseContentMarker,
    job,
  });
  const outOfSyncLocales = productLocales
    .filter((entry) => entry.state === 'outOfSync')
    .map((entry) => entry.locale);
  const registry = await readInstanceRegistryRow({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  const summary = await timeoutStalledGeneration({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetCode: instance.value.widgetCode,
    baseLocale: instance.value.baseLocale,
    targetLocales,
    currentReadyLocales,
    outOfSyncLocales,
    currentBaseContentMarker,
    currentGenerationRequestMarker,
    productLocales,
    job,
    summary: summarizeTranslationGenerationJob({
      instanceId: args.instanceId,
      baseLocale: instance.value.baseLocale,
      targetLocales,
      currentReadyLocales,
      outOfSyncLocales,
      currentBaseContentMarker,
      currentGenerationRequestMarker,
      productLocales,
      job,
    }),
  });
  return {
    ok: true,
    generation: applyRegistryStatusToGenerationSummary({
      registryStatus: registry?.translationStatus ?? null,
      summary,
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
  if (!widgetDefinition?.editableFields || widgetDefinition.editableFields.widgetType !== instance.value.widgetType) {
    return generationFailure({
      baseLocale,
      reasonKey: 'instance.translation.widget_unsupported',
      detail: `Translation jobs require an editable-fields contract for ${instance.value.widgetType}.`,
    });
  }

  let currentSavedTextFields: SavedTextField[];
  try {
    currentSavedTextFields = extractSavedTextFieldsForEditableFields({
      contract: widgetDefinition.editableFields,
      config: instance.value.config,
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
  const widgetContract = {
    schemaVersion: 1 as const,
    hash: widgetEditableFieldsContractHash(widgetDefinition.editableFields),
  };
  const baseContentMarker = buildBaseContentMarker({
    baseLocale,
    widgetType: instance.value.widgetType,
    widgetContractHash: widgetContract.hash,
    fields: currentSavedTextFields,
  });
  const generationRequestMarker = buildGenerationRequestMarker({
    baseContentMarker,
    targetLocales: uniqueTargetLocales,
  });
  const existingJob = await readCurrentTranslationGenerationJob({
    env: args.env,
    accountId: args.accountId,
    widgetCode: instance.value.widgetCode,
    instanceId: args.instanceId,
  });
  if (existingJob) {
    const existingTargetLocales = existingJob.targetLocales.length ? existingJob.targetLocales : uniqueTargetLocales;
    const existingGenerationRequestMarker = buildGenerationRequestMarker({
      baseContentMarker,
      targetLocales: existingTargetLocales,
    });
    const existingProductLocales = productLocaleStatesForContent({
      content: content.value,
      targetLocales: existingTargetLocales,
      currentBaseContentMarker: baseContentMarker,
      job: existingJob,
    });
    const existingOutOfSyncLocales = existingProductLocales
      .filter((entry) => entry.state === 'outOfSync')
      .map((entry) => entry.locale);
    const existingSummary = summarizeTranslationGenerationJob({
      instanceId: args.instanceId,
      baseLocale,
      targetLocales: existingTargetLocales,
      currentReadyLocales: readyLocalesForContent(content.value, existingTargetLocales),
      outOfSyncLocales: existingOutOfSyncLocales,
      currentBaseContentMarker: baseContentMarker,
      currentGenerationRequestMarker: existingGenerationRequestMarker,
      productLocales: existingProductLocales,
      job: existingJob,
    });
    if (isActiveGenerationSummary(existingSummary)) {
      return {
        ok: true,
        accepted: true,
        baseLocale,
        targetLocales: existingTargetLocales,
        queuedLocales: existingSummary.pendingLocales,
        skippedLocales: [],
        jobIds: existingJob.jobId ? [existingJob.jobId] : [],
        generation: existingSummary,
        results: [],
      };
    }
  }
  const basis = {
    fields: currentSavedTextFields
      .map((field) => ({
        identityKey: field.identityKey,
        fieldPattern: field.fieldPattern,
        path: field.path,
        baseText: field.baseText,
      }))
      .sort((left, right) => left.identityKey.localeCompare(right.identityKey)),
  };
  const productLocalesBeforeGeneration = productLocaleStatesForContent({
    content: content.value,
    targetLocales: uniqueTargetLocales,
    currentBaseContentMarker: baseContentMarker,
    job: null,
  });
  const productLocaleByLocale = new Map(productLocalesBeforeGeneration.map((entry) => [entry.locale, entry]));

  for (const locale of uniqueTargetLocales) {
    if (!resolveLanguageOverlayCode(locale)) {
      return generationFailure({
        baseLocale,
        locale,
        reasonKey: 'instance.translation.language_unsupported',
        detail: `No overlay language code for locale ${locale}`,
      });
    }

    const previousSavedTextFields = currentSavedTextFields;
    const missingTranslatedFields = currentSavedTextFields.filter((field) => {
      const contentField = content.value.fields[field.path];
      return (
        contentField?.localeStatus?.[locale] !== 'ok' ||
        typeof contentField?.translatedValues?.[locale] !== 'string'
      );
    });
    const sync = content.value.localeSync?.[locale];
    const productLocale = productLocaleByLocale.get(locale);
    let changedFields = currentSavedTextFields;
    if (productLocale?.state === 'inSync') {
      changedFields = [];
    } else if (sync?.baseContentMarker === baseContentMarker && sync.status === 'inSync') {
      changedFields = missingTranslatedFields;
    } else if (sync && sync.baseContentMarker !== baseContentMarker) {
      changedFields = missingTranslatedFields.length ? missingTranslatedFields : currentSavedTextFields;
    }
    if (!changedFields.length) {
      skippedLocales.push(locale);
      continue;
    }

    jobs.push({
      v: 2,
      kind: INSTANCE_TRANSLATION_JOB_KIND,
      jobId: generationJobId,
      baseContentMarker,
      generationRequestMarker,
      accountId: args.authz.accountId,
      accountPublicId: args.accountId,
      userId: args.authz.userId,
      instanceId: args.instanceId,
      widgetType: instance.value.widgetType,
      widgetContract,
      baseLocale,
      targetLocale: locale,
      targetLocales: uniqueTargetLocales,
      requestedAt,
      ...(args.requestId ? { requestId: args.requestId } : {}),
      ai: runtime.ai,
      budgets: runtime.budgets,
      changedFields,
      deletedIdentityKeys: deletedIdentityKeys({ previousSavedTextFields, currentSavedTextFields }),
      basis,
    });
  }

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
        outOfSyncLocales: productLocalesBeforeGeneration
          .filter((entry) => entry.state === 'outOfSync')
          .map((entry) => entry.locale),
        currentBaseContentMarker: baseContentMarker,
        currentGenerationRequestMarker: generationRequestMarker,
        productLocales: productLocalesBeforeGeneration,
        job: completedJob,
      }),
      results: [],
    };
  }

  const generationJob = createGenerationJobDocument({
    jobId: generationJobId,
    baseContentMarker,
    generationRequestMarker,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: instance.value.widgetType,
    baseLocale,
    targetLocales: uniqueTargetLocales,
    requestedAt,
    currentReadyLocales,
    jobs,
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
      outOfSyncLocales: productLocalesBeforeGeneration
        .filter((entry) => entry.state === 'outOfSync')
        .map((entry) => entry.locale),
      currentBaseContentMarker: baseContentMarker,
      currentGenerationRequestMarker: generationRequestMarker,
      productLocales: productLocaleStatesForContent({
        content: content.value,
        targetLocales: uniqueTargetLocales,
        currentBaseContentMarker: baseContentMarker,
        job: generationJob,
      }),
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
  if (!widgetDefinition?.editableFields || widgetDefinition.editableFields.widgetType !== instance.value.widgetType) {
    return {
      ok: false,
      locale,
      reasonKey: 'instance.translation.widget_unsupported',
      detail: `Translation jobs require an editable-fields contract for ${instance.value.widgetType}.`,
    };
  }

  const currentJob = await readCurrentTranslationGenerationJob({
    env: args.env,
    accountId: args.accountId,
    widgetCode: instance.value.widgetCode,
    instanceId: args.instanceId,
  });

  let currentSavedTextFields: SavedTextField[];
  try {
    currentSavedTextFields = extractSavedTextFieldsForEditableFields({
      contract: widgetDefinition.editableFields,
      config: instance.value.config,
    });
  } catch (error) {
    return {
      ok: false,
      locale,
      reasonKey: 'instance.translation.contract_invalid',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  const currentBaseContentMarker = buildBaseContentMarker({
    baseLocale: instance.value.baseLocale,
    widgetType: instance.value.widgetType,
    widgetContractHash: widgetEditableFieldsContractHash(widgetDefinition.editableFields),
    fields: currentSavedTextFields,
  });
  const jobBaseContentMarker = baseContentMarkerForJob(job);
  if (
    !currentJob ||
    !currentJob.locales[locale] ||
    !currentJobMatchesCompletionJob(currentJob, job)
  ) {
    return {
      ok: true,
      applied: false,
      locale,
      reasonKey: 'instance.translation.stale_generation',
      detail: 'This translation job does not match the active translation operation for the instance.',
    };
  }
  if (jobBaseContentMarker !== currentBaseContentMarker) {
    const updatedJob = await updateCurrentTranslationGenerationJob({
      env: args.env,
      accountId: args.accountId,
      widgetCode: instance.value.widgetCode,
      instanceId: args.instanceId,
      update(current) {
        if (!current || !currentJobMatchesCompletionJob(current, job) || !current.locales[locale]) return current;
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
    if (updatedJob && currentJobMatchesCompletionJob(updatedJob, job)) {
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
  if (!sameJobBasis({
    currentSavedTextFields,
    job,
    widgetContractHash: widgetEditableFieldsContractHash(widgetDefinition.editableFields),
  })) {
    const updatedJob = await updateCurrentTranslationGenerationJob({
      env: args.env,
      accountId: args.accountId,
      widgetCode: instance.value.widgetCode,
      instanceId: args.instanceId,
      update(current) {
        if (!current || !currentJobMatchesCompletionJob(current, job) || !current.locales[locale]) return current;
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
    if (updatedJob && currentJobMatchesCompletionJob(updatedJob, job)) {
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
      fields: currentSavedTextFields,
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
      paths: job.changedFields.map((field) => field.path),
      values: nextValues,
      baseContentMarker: jobBaseContentMarker,
      widgetContractHash: job.widgetContract.hash,
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
      if (!current || !currentJobMatchesCompletionJob(current, job) || !current.locales[locale]) return current;
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
  if (updatedJob && currentJobMatchesCompletionJob(updatedJob, job)) {
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
      if (!current || !currentJobMatchesCompletionJob(current, job) || !current.locales[locale]) return current;
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

  if (!recorded || !currentJobMatchesCompletionJob(recorded, job) || !recorded.locales[locale] || recorded.locales[locale]?.status !== 'failed') {
    return {
      ok: true,
      recorded: false,
      locale,
      reasonKey: 'instance.translation.stale_generation',
      detail: 'This translation job does not match the active translation operation for the instance.',
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
