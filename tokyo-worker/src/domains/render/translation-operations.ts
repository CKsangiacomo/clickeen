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
  markAccountInstanceContentFieldsTranslated,
  readAccountInstanceContentDocument,
  readAccountInstanceCurrentTranslatedLocaleValues,
  readAccountInstanceDocument,
} from './saved-config';
import {
  writeTranslatedLocaleValues,
} from './overlays';

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
    return {
      ok: true,
      accepted: false,
      baseLocale,
      targetLocales: [],
      queuedLocales: [],
      skippedLocales: [],
      jobIds: [],
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
      return contentField?.localeStatus?.[locale] !== 'ok';
    });
    if (!changedFields.length) {
      skippedLocales.push(locale);
      continue;
    }

    jobs.push({
      v: 1,
      kind: INSTANCE_TRANSLATION_JOB_KIND,
      jobId: crypto.randomUUID(),
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

  try {
    await Promise.all(jobs.map((job) => queue.send(job)));
  } catch (error) {
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
    jobIds: jobs.map((job) => job.jobId),
    results: jobs.map((job) => ({ locale: job.targetLocale, ok: true, jobId: job.jobId })),
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
    await writeTranslatedLocaleValues({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      locale,
      values: nextValues,
    });
    await markAccountInstanceContentFieldsTranslated({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      widgetType: instance.value.widgetType,
      locale,
      targetLocales: job.targetLocales,
      paths: job.changedFields.map((field) => field.identity.path),
    });
  } catch (error) {
    return {
      ok: false,
      locale,
      reasonKey: 'instance.translation.values_invalid',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  return { ok: true, applied: true, locale };
}
