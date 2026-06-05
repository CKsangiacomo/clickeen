import {
  INSTANCE_TRANSLATION_AGENT_ID,
  INSTANCE_TRANSLATION_JOB_KIND,
  normalizeInstanceTranslationJob,
  type InstanceTranslationJob,
} from '@clickeen/ck-contracts/instance-translation-jobs';
import { resolveAiAgent } from '@clickeen/ck-contracts/ai';
import {
  extractSavedTextFieldsForEditableFields,
  type SavedTextField,
} from '@clickeen/ck-contracts/translated-value-primitives';
import {
  resolveAiRuntimeBudget,
  resolveAiRuntimePolicy,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import { normalizeLocale } from '../../asset-utils';
import type { Env } from '../../types';
import { getWidgetDefinition } from '../widget-definitions';
import { listLocaleOverlays, localeOverlayByLocale } from './overlays';
import {
  readAccountInstanceContentDocument,
  readAccountInstanceDocument,
} from '../account-instances/source';
import {
  completeAccountInstanceTranslatedLocaleValues,
  readAccountInstanceCurrentTranslatedLocaleValues,
} from './values';
import {
  readInstanceRegistryRow,
  updateInstanceRegistryTranslationStatus,
  type InstanceRegistryTranslationStatus,
} from '../account-instances/registry';
import {
  deriveTranslationGenerationOperation,
  productLocaleStatesForOverlays,
  readyLocalesForOverlays,
  summarizeTranslationGenerationOperation,
} from './generation-state';
import {
  completeTranslationGenerationLocale,
  createTranslationGenerationOperation,
  failTranslationGenerationLocale,
  failTranslationGenerationOperation,
  markTranslationGenerationEnqueued,
  markTranslationGenerationLocaleStale,
  readLatestTranslationGenerationOperation,
  updateOperationStatusFromLocales,
} from './ledger';
import {
  baseContentMarkerForTranslationJob,
  buildBaseContentMarker,
  buildGenerationRequestMarker,
  buildWidgetContractMarker,
} from './markers';
import type {
  TranslationGenerationOperationBasis,
  TranslationGenerationOperationDocument,
  TranslationGenerationOperationSummary,
} from '../account-instances/types';

type TranslationQueue = {
  send(message: InstanceTranslationJob): Promise<void>;
};

const TRANSLATION_GENERATION_ACTIVE_TIMEOUT_MS = 10 * 60 * 1000;

export type InstanceTranslationGenerationResult =
  | {
      ok: true;
      accepted: boolean;
      baseLocale: string;
      targetLocales: string[];
      skippedLocales: string[];
      generation: TranslationGenerationOperationSummary | null;
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
  | { ok: true; generation: TranslationGenerationOperationSummary }
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

async function baseContentMarkerForJob(job: InstanceTranslationJob): Promise<string> {
  if (job.baseContentMarker) return job.baseContentMarker;
  return baseContentMarkerForTranslationJob({
    baseLocale: job.baseLocale,
    widgetType: job.widgetType,
    widgetContractHash: job.widgetContract.hash,
    fields: job.basis.fields,
  });
}

function currentOperationMatchesCompletionJob(current: TranslationGenerationOperationDocument, job: InstanceTranslationJob, jobBaseContentMarker: string): boolean {
  return current.jobId === job.jobId && current.baseContentMarker === jobBaseContentMarker;
}

function buildJobBasis(jobs: InstanceTranslationJob[]): TranslationGenerationOperationBasis {
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

function createTranslationGenerationOperationDocument(args: {
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
}): TranslationGenerationOperationDocument {
  const locales: TranslationGenerationOperationDocument['locales'] = {};
  for (const job of args.jobs) {
    locales[job.targetLocale] = {
      locale: job.targetLocale,
      status: 'queued',
      paths: job.changedFields.map((field) => field.path).sort((left, right) => left.localeCompare(right)),
      updatedAt: args.requestedAt,
    };
  }
  return deriveTranslationGenerationOperation({
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
  status: TranslationGenerationOperationSummary['status'],
): InstanceRegistryTranslationStatus {
  if (status === 'queued' || status === 'running' || status === 'failed') return status;
  return 'idle';
}

function registryStatusForGenerationOperation(args: {
  instanceId: string;
  baseLocale: string;
  targetLocales: string[];
  currentReadyLocales: string[];
  currentBaseContentMarker?: string;
  currentGenerationRequestMarker?: string;
  outOfSyncLocales?: string[];
  productLocales?: TranslationGenerationOperationSummary['locales'];
  job: TranslationGenerationOperationDocument;
}): InstanceRegistryTranslationStatus {
  return registryStatusForGenerationStatus(
    summarizeTranslationGenerationOperation({
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
  summary: TranslationGenerationOperationSummary;
  registryStatus: InstanceRegistryTranslationStatus | null;
}): TranslationGenerationOperationSummary {
  if (!args.registryStatus) return args.summary;
  if (
    args.summary.status === 'idle' ||
    args.summary.status === 'completed' ||
    args.summary.status === 'failed'
  ) {
    return args.summary;
  }
  if (args.registryStatus === 'queued' || args.registryStatus === 'running' || args.registryStatus === 'failed') {
    return { ...args.summary, status: args.registryStatus };
  }
  return { ...args.summary, status: 'idle' };
}

function isActiveGenerationSummary(summary: TranslationGenerationOperationSummary): boolean {
  return summary.status === 'queued' || summary.status === 'running';
}

function shouldTimeoutGeneration(summary: TranslationGenerationOperationSummary): boolean {
  if (!isActiveGenerationSummary(summary) || !summary.requestedAt) return false;
  const requestedAtMs = Date.parse(summary.requestedAt);
  return Number.isFinite(requestedAtMs) && Date.now() - requestedAtMs >= TRANSLATION_GENERATION_ACTIVE_TIMEOUT_MS;
}

async function timeoutStalledGeneration(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  baseLocale: string;
  targetLocales: string[];
  currentReadyLocales: string[];
  outOfSyncLocales?: string[];
  currentBaseContentMarker?: string;
  currentGenerationRequestMarker?: string;
  productLocales?: TranslationGenerationOperationSummary['locales'];
  job: TranslationGenerationOperationDocument | null;
  summary: TranslationGenerationOperationSummary;
}): Promise<TranslationGenerationOperationSummary> {
  if (!args.job || !shouldTimeoutGeneration(args.summary)) return args.summary;
  const now = new Date().toISOString();
  await failTranslationGenerationOperation({
    env: args.env,
    operationId: args.job.jobId,
    now,
    status: 'timed_out',
    reasonKey: 'instance.translation.timed_out',
    detail: 'Translation generation timed out before all locale jobs reported completion or failure.',
    localeDetail: 'Translation job did not report completion or failure before the generation timeout.',
  });
  await writeRegistryTranslationStatus({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    status: 'failed',
  });
  const timedOutJob = await readLatestTranslationGenerationOperation({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: args.job.widgetType,
    currentReadyLocales: args.currentReadyLocales,
  }) ?? args.job;
  const productLocales = args.productLocales?.map((locale) => {
    const failedLocale = timedOutJob.locales[locale.locale];
    if (failedLocale?.status !== 'failed') return locale;
    return {
      ...locale,
      state: 'failed' as const,
      reviewable: false,
      ...(failedLocale.reasonKey ? { reasonKey: failedLocale.reasonKey } : {}),
      ...(failedLocale.detail ? { detail: failedLocale.detail } : {}),
    };
  });
  return summarizeTranslationGenerationOperation({
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    targetLocales: args.targetLocales,
    currentReadyLocales: args.currentReadyLocales,
    outOfSyncLocales: args.outOfSyncLocales,
    currentBaseContentMarker: args.currentBaseContentMarker,
    currentGenerationRequestMarker: args.currentGenerationRequestMarker,
    productLocales,
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
  const targetLocales = instance.value.targetLocales;
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
  const overlays = localeOverlayByLocale(await listLocaleOverlays({
    env: args.env,
    accountId: args.accountId,
    widgetCode: instance.value.widgetCode,
    instanceId: args.instanceId,
  }));
  const widgetDefinition = getWidgetDefinition(instance.value.widgetType);
  let currentBaseContentMarker: string | undefined;
  let currentGenerationRequestMarker: string | undefined;
  if (widgetDefinition?.editableFields) {
    try {
      const fields = extractSavedTextFieldsForEditableFields({
        contract: widgetDefinition.editableFields,
        config: instance.value.config,
      });
      currentBaseContentMarker = await buildBaseContentMarker({
        baseLocale: instance.value.baseLocale,
        widgetType: instance.value.widgetType,
        widgetContractHash: await buildWidgetContractMarker(widgetDefinition.editableFields),
        fields,
      });
      currentGenerationRequestMarker = await buildGenerationRequestMarker({
        baseContentMarker: currentBaseContentMarker,
        targetLocales,
      });
    } catch {
      currentBaseContentMarker = undefined;
      currentGenerationRequestMarker = undefined;
    }
  }
  const currentReadyLocales = readyLocalesForOverlays(content.value, targetLocales, overlays, currentBaseContentMarker);
  const job = await readLatestTranslationGenerationOperation({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: instance.value.widgetType,
    currentReadyLocales,
  });
  const summaryTargetLocales = job?.targetLocales.length ? job.targetLocales : targetLocales;
  if (currentBaseContentMarker) {
    currentGenerationRequestMarker = await buildGenerationRequestMarker({
      baseContentMarker: currentBaseContentMarker,
      targetLocales: summaryTargetLocales,
    });
  }
  const productLocales = productLocaleStatesForOverlays({
    content: content.value,
    targetLocales: summaryTargetLocales,
    overlays,
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
    baseLocale: instance.value.baseLocale,
    targetLocales: summaryTargetLocales,
    currentReadyLocales,
    outOfSyncLocales,
    currentBaseContentMarker,
    currentGenerationRequestMarker,
    productLocales,
    job,
    summary: summarizeTranslationGenerationOperation({
      instanceId: args.instanceId,
      baseLocale: instance.value.baseLocale,
      targetLocales: summaryTargetLocales,
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
      skippedLocales: [],
      generation: null,
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
  const generationOperationId = crypto.randomUUID();
  const widgetContract = {
    schemaVersion: 1 as const,
    hash: await buildWidgetContractMarker(widgetDefinition.editableFields),
  };
  const baseContentMarker = await buildBaseContentMarker({
    baseLocale,
    widgetType: instance.value.widgetType,
    widgetContractHash: widgetContract.hash,
    fields: currentSavedTextFields,
  });
  const generationRequestMarker = await buildGenerationRequestMarker({
    baseContentMarker,
    targetLocales: uniqueTargetLocales,
  });
  const overlays = localeOverlayByLocale(await listLocaleOverlays({
    env: args.env,
    accountId: args.accountId,
    widgetCode: instance.value.widgetCode,
    instanceId: args.instanceId,
  }));
  const currentReadyLocales = readyLocalesForOverlays(content.value, uniqueTargetLocales, overlays, baseContentMarker);
  const existingJob = await readLatestTranslationGenerationOperation({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: instance.value.widgetType,
    currentReadyLocales,
  });
  if (existingJob && existingJob.baseContentMarker === baseContentMarker) {
    const existingTargetLocales = existingJob.targetLocales.length ? existingJob.targetLocales : uniqueTargetLocales;
    const existingGenerationRequestMarker = await buildGenerationRequestMarker({
      baseContentMarker,
      targetLocales: existingTargetLocales,
    });
    const existingProductLocales = productLocaleStatesForOverlays({
      content: content.value,
      targetLocales: existingTargetLocales,
      overlays,
      currentBaseContentMarker: baseContentMarker,
      job: existingJob,
    });
    const existingOutOfSyncLocales = existingProductLocales
      .filter((entry) => entry.state === 'outOfSync')
      .map((entry) => entry.locale);
    const existingSummary = summarizeTranslationGenerationOperation({
      instanceId: args.instanceId,
      baseLocale,
      targetLocales: existingTargetLocales,
      currentReadyLocales: readyLocalesForOverlays(content.value, existingTargetLocales, overlays, baseContentMarker),
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
        skippedLocales: [],
        generation: existingSummary,
      };
    }
  } else if (existingJob && (existingJob.status === 'queued' || existingJob.status === 'running')) {
    await failTranslationGenerationOperation({
      env: args.env,
      operationId: existingJob.jobId,
      now: requestedAt,
      reasonKey: 'instance.translation.stale_base_content',
      detail: 'A newer saved base content marker superseded this translation generation.',
    });
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
  const productLocalesBeforeGeneration = productLocaleStatesForOverlays({
    content: content.value,
    targetLocales: uniqueTargetLocales,
    overlays,
    currentBaseContentMarker: baseContentMarker,
    job: null,
  });
  const productLocaleByLocale = new Map(productLocalesBeforeGeneration.map((entry) => [entry.locale, entry]));

  for (const locale of uniqueTargetLocales) {
    const previousSavedTextFields = currentSavedTextFields;
    const overlay = overlays.get(locale);
    const missingTranslatedFields = currentSavedTextFields.filter((field) => typeof overlay?.values[field.path] !== 'string');
    const productLocale = productLocaleByLocale.get(locale);
    let changedFields = currentSavedTextFields;
    if (productLocale?.state === 'inSync') {
      changedFields = [];
    } else if (overlay?.baseContentMarker === baseContentMarker) {
      changedFields = missingTranslatedFields;
    } else if (overlay && overlay.baseContentMarker !== baseContentMarker) {
      changedFields = missingTranslatedFields.length ? missingTranslatedFields : currentSavedTextFields;
    }
    if (!changedFields.length) {
      skippedLocales.push(locale);
      continue;
    }

    jobs.push({
      v: 2,
      kind: INSTANCE_TRANSLATION_JOB_KIND,
      jobId: generationOperationId,
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
      skippedLocales,
      generation: summarizeTranslationGenerationOperation({
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
        job: null,
      }),
    };
  }

  const generationOperation = createTranslationGenerationOperationDocument({
    jobId: generationOperationId,
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
  const createdGenerationOperation = await createTranslationGenerationOperation({
    env: args.env,
    operation: generationOperation,
    expiresAt: new Date(Date.parse(requestedAt) + TRANSLATION_GENERATION_ACTIVE_TIMEOUT_MS).toISOString(),
  });
  if (createdGenerationOperation.jobId !== generationOperation.jobId) {
    const activeProductLocales = productLocaleStatesForOverlays({
      content: content.value,
      targetLocales: createdGenerationOperation.targetLocales,
      overlays,
      currentBaseContentMarker: baseContentMarker,
      job: createdGenerationOperation,
    });
    return {
      ok: true,
      accepted: true,
      baseLocale,
      targetLocales: createdGenerationOperation.targetLocales,
      skippedLocales: [],
      generation: summarizeTranslationGenerationOperation({
        instanceId: args.instanceId,
        baseLocale,
        targetLocales: createdGenerationOperation.targetLocales,
        currentReadyLocales: readyLocalesForOverlays(content.value, createdGenerationOperation.targetLocales, overlays, baseContentMarker),
        outOfSyncLocales: activeProductLocales
          .filter((entry) => entry.state === 'outOfSync')
          .map((entry) => entry.locale),
        currentBaseContentMarker: baseContentMarker,
        currentGenerationRequestMarker: createdGenerationOperation.generationRequestMarker,
        productLocales: activeProductLocales,
        job: createdGenerationOperation,
      }),
    };
  }
  await writeRegistryTranslationStatus({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    status: 'queued',
  });

  try {
    await Promise.all(jobs.map((job) => queue.send(job)));
    await markTranslationGenerationEnqueued({
      env: args.env,
      operationId: generationOperation.jobId,
      now: new Date().toISOString(),
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    await failTranslationGenerationOperation({
      env: args.env,
      operationId: generationOperation.jobId,
      now: failedAt,
      reasonKey: 'instance.translation.queue_send_failed',
      detail: error instanceof Error ? error.message : String(error),
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
    skippedLocales,
    generation: summarizeTranslationGenerationOperation({
      instanceId: args.instanceId,
      baseLocale,
      targetLocales: uniqueTargetLocales,
      currentReadyLocales,
      outOfSyncLocales: productLocalesBeforeGeneration
        .filter((entry) => entry.state === 'outOfSync')
        .map((entry) => entry.locale),
      currentBaseContentMarker: baseContentMarker,
      currentGenerationRequestMarker: generationRequestMarker,
      productLocales: productLocaleStatesForOverlays({
        content: content.value,
        targetLocales: uniqueTargetLocales,
        overlays,
        currentBaseContentMarker: baseContentMarker,
        job: generationOperation,
      }),
      job: generationOperation,
    }),
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

  const currentJob = await readLatestTranslationGenerationOperation({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: instance.value.widgetType,
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
  const currentBaseContentMarker = await buildBaseContentMarker({
    baseLocale: instance.value.baseLocale,
    widgetType: instance.value.widgetType,
    widgetContractHash: await buildWidgetContractMarker(widgetDefinition.editableFields),
    fields: currentSavedTextFields,
  });
  const jobBaseContentMarker = await baseContentMarkerForJob(job);
  if (
    !currentJob ||
    !currentJob.locales[locale] ||
    !currentOperationMatchesCompletionJob(currentJob, job, jobBaseContentMarker)
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
    const now = new Date().toISOString();
    await markTranslationGenerationLocaleStale({
      env: args.env,
      operationId: currentJob.jobId,
      locale,
      now,
      reasonKey: 'instance.translation.stale_source_text',
      detail: 'Current saved text for the translated fields no longer matches the translation job basis.',
    });
    const updatedJob = await updateOperationStatusFromLocales({
      env: args.env,
      operationId: currentJob.jobId,
      widgetType: instance.value.widgetType,
      currentReadyLocales: currentJob.currentReadyLocales,
      now,
    });
    await writeRegistryTranslationStatus({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      status: updatedJob
        ? registryStatusForGenerationOperation({
            instanceId: args.instanceId,
            baseLocale: updatedJob.baseLocale,
            targetLocales: updatedJob.targetLocales,
            currentReadyLocales: updatedJob.currentReadyLocales,
            job: updatedJob,
          })
        : 'idle',
    });
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
    widgetContractHash: await buildWidgetContractMarker(widgetDefinition.editableFields),
  })) {
    const now = new Date().toISOString();
    await markTranslationGenerationLocaleStale({
      env: args.env,
      operationId: currentJob.jobId,
      locale,
      now,
      reasonKey: 'instance.translation.stale_source_text',
      detail: 'Current saved text for the translated fields no longer matches the translation job basis.',
    });
    const updatedJob = await updateOperationStatusFromLocales({
      env: args.env,
      operationId: currentJob.jobId,
      widgetType: instance.value.widgetType,
      currentReadyLocales: currentJob.currentReadyLocales,
      now,
    });
    await writeRegistryTranslationStatus({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      status: updatedJob
        ? registryStatusForGenerationOperation({
            instanceId: args.instanceId,
            baseLocale: updatedJob.baseLocale,
            targetLocales: updatedJob.targetLocales,
            currentReadyLocales: updatedJob.currentReadyLocales,
            job: updatedJob,
          })
        : 'idle',
    });
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
  const overlays = localeOverlayByLocale(await listLocaleOverlays({
    env: args.env,
    accountId: args.accountId,
    widgetCode: instance.value.widgetCode,
    instanceId: args.instanceId,
  }));
  const readyLocales = content.ok
    ? readyLocalesForOverlays(content.value, currentJob.targetLocales, overlays, jobBaseContentMarker)
    : currentJob.currentReadyLocales;
  const updatedJob = await completeTranslationGenerationLocale({
    env: args.env,
    operationId: currentJob.jobId,
    locale,
    now: new Date().toISOString(),
    widgetType: instance.value.widgetType,
    currentReadyLocales: readyLocales,
  });
  if (updatedJob && currentOperationMatchesCompletionJob(updatedJob, job, jobBaseContentMarker)) {
    await writeRegistryTranslationStatus({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      status: registryStatusForGenerationOperation({
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
  const jobBaseContentMarker = await baseContentMarkerForJob(job);

  const currentJob = await readLatestTranslationGenerationOperation({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: instance.value.widgetType,
  });

  if (!currentJob || !currentOperationMatchesCompletionJob(currentJob, job, jobBaseContentMarker) || !currentJob.locales[locale]) {
    return {
      ok: true,
      recorded: false,
      locale,
      reasonKey: 'instance.translation.stale_generation',
      detail: 'This translation job does not match the active translation operation for the instance.',
    };
  }
  const now = new Date().toISOString();
  const recorded = await failTranslationGenerationLocale({
    env: args.env,
    operationId: currentJob.jobId,
    locale,
    now,
    reasonKey,
    detail,
    widgetType: instance.value.widgetType,
    currentReadyLocales: currentJob.currentReadyLocales,
  });
  await writeRegistryTranslationStatus({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    status: recorded
      ? registryStatusForGenerationOperation({
          instanceId: args.instanceId,
          baseLocale: recorded.baseLocale,
          targetLocales: recorded.targetLocales,
          currentReadyLocales: recorded.currentReadyLocales,
          job: recorded,
        })
      : 'failed',
  });

  return {
    ok: true,
    recorded: true,
    locale,
    reasonKey,
    detail,
  };
}
