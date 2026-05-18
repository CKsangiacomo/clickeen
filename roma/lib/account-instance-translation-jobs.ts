import {
  INSTANCE_TRANSLATION_JOB_KIND,
  INSTANCE_TRANSLATION_AGENT_ID,
  type InstanceTranslationJob,
} from '@clickeen/ck-contracts/instance-translation-jobs';
import {
  buildFaqSavedTextGraph,
  faqFieldIdentityKey,
  selectFaqFieldsNeedingTranslation,
  type FaqLanguageValue,
  type FaqSavedTextField,
} from '@clickeen/ck-contracts/faq-language-values';
import type { AiGrantPolicy } from '@clickeen/ck-contracts/ai';
import { resolveLanguageOverlayCode } from '@clickeen/ck-contracts/overlay-codebooks';
import {
  resolveAiRuntimeBudget,
  resolveAiRuntimePolicy,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import { resolveAiAgent } from '@clickeen/ck-contracts/ai';
import { getOptionalCloudflareRequestContext } from './cloudflare-request-context';
import { loadTokyoWidgetCatalog } from './account-instance-direct';
import {
  loadAccountInstanceLocaleOverlayInventory,
  readAccountInstanceLocaleOverlayObject,
} from './account-instance-locale-overlays';
import { loadAccountTranslationLanguagePolicy } from './account-translation-policy';
import { assertInstanceTranslationRuntimeReady } from './instance-translation-agent-client';

type TranslationJobQueue = {
  send(message: InstanceTranslationJob): Promise<void>;
};

type TranslationQueueContext = {
  env?: {
    INSTANCE_TRANSLATION_JOBS?: TranslationJobQueue;
  };
};

type InstanceTranslationJobAcceptanceFailure = {
  ok: false;
  accepted: false;
  baseLocale: string | null;
  reasonKey: string;
  detail: string;
  results: Array<{ locale: string; ok: false; reasonKey: string; detail: string; path?: string }>;
};

export type InstanceTranslationJobAcceptance =
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
  | InstanceTranslationJobAcceptanceFailure;

type TranslationJobBuildResult =
  | {
      ok: true;
      baseLocale: string;
      jobs: InstanceTranslationJob[];
      skippedLocales: string[];
      targetLocales: string[];
    }
  | InstanceTranslationJobAcceptanceFailure;

function resolveTranslationQueue(): TranslationJobQueue | null {
  const queue = getOptionalCloudflareRequestContext<TranslationQueueContext>()?.env?.INSTANCE_TRANSLATION_JOBS;
  return queue && typeof queue.send === 'function' ? queue : null;
}

function acceptanceFailure(args: {
  baseLocale: string | null;
  locale?: string;
  reasonKey: string;
  detail: string;
  path?: string;
}): InstanceTranslationJobAcceptanceFailure {
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

function resolveTranslationRuntime(args: {
  authz: RomaAccountAuthzCapsulePayload;
}): { ai: AiGrantPolicy; budgets: InstanceTranslationJob['budgets'] } | null {
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

function previousLanguageValuesFromOverlay(args: {
  fields: FaqSavedTextField[];
  locale: string;
  values: Record<string, string>;
}): FaqLanguageValue[] {
  return args.fields
    .filter((field) => typeof args.values[field.identity.path] === 'string')
    .map((field) => ({
      identity: field.identity,
      locale: args.locale,
      value: args.values[field.identity.path] as string,
      updatedAt: new Date(0).toISOString(),
    }));
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

async function buildAcceptedTranslationJobs(args: {
  authz: RomaAccountAuthzCapsulePayload;
  accessToken: string;
  accountCapsule: string;
  accountPublicId: string;
  instanceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  previousConfig: Record<string, unknown> | null;
  translateAllCurrentFields?: boolean;
  skipReadyLocales?: boolean;
  targetLocales?: string[];
  requestId?: string | null;
}): Promise<TranslationJobBuildResult> {
  const queue = resolveTranslationQueue();
  if (!queue) {
    return acceptanceFailure({
      baseLocale: null,
      reasonKey: 'instance.translation.queue_unavailable',
      detail: 'INSTANCE_TRANSLATION_JOBS queue binding is unavailable.',
    });
  }

  const policy = await loadAccountTranslationLanguagePolicy({
    accessToken: args.accessToken,
    accountId: args.authz.accountId,
    requestId: args.requestId,
  });
  if (!policy.ok) {
    return acceptanceFailure({
      baseLocale: null,
      reasonKey: policy.error.reasonKey,
      detail: policy.error.detail ?? 'account_language_policy_unavailable',
    });
  }
  const baseLocale = policy.value.baseLocale;
  const desiredTargets = policy.value.desiredLocales.filter((locale) => locale !== baseLocale);
  const desiredTargetSet = new Set(desiredTargets);
  const targetLocales = Array.isArray(args.targetLocales)
    ? Array.from(
        new Set(
          args.targetLocales
            .map((locale) => String(locale || '').trim())
            .filter((locale) => locale && locale !== baseLocale && desiredTargetSet.has(locale)),
        ),
      )
    : desiredTargets;
  if (!targetLocales.length) {
    return { ok: true, baseLocale, jobs: [], skippedLocales: [], targetLocales: [] };
  }

  const runtime = resolveTranslationRuntime({ authz: args.authz });
  if (!runtime) {
    return acceptanceFailure({
      baseLocale,
      reasonKey: 'instance.translation.agent_missing',
      detail: 'Missing AI registry entry for Instance Translation Agent.',
    });
  }
  const ready = await assertInstanceTranslationRuntimeReady({
    authz: args.authz,
    instanceId: args.instanceId,
    requestId: args.requestId,
  });
  if (!ready.ok) {
    return acceptanceFailure({
      baseLocale,
      reasonKey: 'instance.translation.runtime_unavailable',
      detail: ready.detail,
    });
  }

  const catalog = await loadTokyoWidgetCatalog({
    accountId: args.accountPublicId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!catalog.ok) {
    return acceptanceFailure({
      baseLocale,
      reasonKey: catalog.error.reasonKey,
      detail: catalog.error.detail ?? 'widget_content_contract_unavailable',
    });
  }

  const entry = catalog.value.widgets.find((candidate) => candidate.widgetType === args.widgetType);
  if (args.widgetType !== 'faq' || !entry?.content || entry.content.widgetType !== 'faq') {
    return acceptanceFailure({
      baseLocale,
      reasonKey: 'instance.translation.widget_unsupported',
      detail: `Translation jobs require a FAQ content contract for ${args.widgetType}.`,
    });
  }

  let previousSavedTextGraph: FaqSavedTextField[];
  let currentSavedTextGraph: FaqSavedTextField[];
  try {
    previousSavedTextGraph = args.translateAllCurrentFields || !args.previousConfig
      ? []
      : buildFaqSavedTextGraph({
          contract: entry.content,
          config: args.previousConfig,
          instanceId: args.instanceId,
        });
    currentSavedTextGraph = buildFaqSavedTextGraph({
      contract: entry.content,
      config: args.config,
      instanceId: args.instanceId,
    });
  } catch (error) {
    return acceptanceFailure({
      baseLocale,
      reasonKey: 'instance.translation.contract_invalid',
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const inventory = await loadAccountInstanceLocaleOverlayInventory({
    accountId: args.accountPublicId,
    instanceId: args.instanceId,
    baseLocale,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!inventory.ok) {
    return acceptanceFailure({
      baseLocale,
      reasonKey: inventory.error.reasonKey,
      detail: inventory.error.detail ?? 'tokyo_overlay_inventory_unavailable',
    });
  }

  const readyLocales = new Set(inventory.value.overlays.map((overlay) => overlay.locale));
  const skippedLocales: string[] = [];
  const jobs: InstanceTranslationJob[] = [];
  const requestedAt = new Date().toISOString();

  for (const locale of targetLocales) {
    if (!resolveLanguageOverlayCode(locale)) {
      return acceptanceFailure({
        baseLocale,
        locale,
        reasonKey: 'instance.translation.language_unsupported',
        detail: `No overlay language code for locale ${locale}`,
      });
    }
    if (args.skipReadyLocales && readyLocales.has(locale)) {
      skippedLocales.push(locale);
      continue;
    }

    const existingOverlay = inventory.value.overlays.find((overlay) => overlay.locale === locale);
    let previousLanguageValues: FaqLanguageValue[] = [];
    if (!args.translateAllCurrentFields && existingOverlay) {
      const object = await readAccountInstanceLocaleOverlayObject({
        accountId: args.accountPublicId,
        instanceId: args.instanceId,
        overlayId: existingOverlay.overlayId,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      });
      if (!object.ok) {
        return acceptanceFailure({
          baseLocale,
          locale,
          reasonKey: object.error.reasonKey,
          detail: object.error.detail ?? 'tokyo_overlay_read_failed',
        });
      }
      previousLanguageValues = previousLanguageValuesFromOverlay({
        fields: previousSavedTextGraph,
        locale,
        values: object.value.values,
      });
    }

    const changedFields = args.translateAllCurrentFields
      ? currentSavedTextGraph
      : selectFaqFieldsNeedingTranslation({
          previousSavedTextGraph,
          currentSavedTextGraph,
          previousLanguageValues,
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
      accountPublicId: args.accountPublicId,
      userId: args.authz.userId,
      instanceId: args.instanceId,
      widgetType: 'faq',
      widgetContractVersion: entry.content.v,
      baseLocale,
      targetLocale: locale,
      requestedAt,
      ...(args.requestId ? { requestId: args.requestId } : {}),
      ai: runtime.ai,
      budgets: runtime.budgets,
      previousSavedTextGraph,
      currentSavedTextGraph,
      previousLanguageValues,
      changedFields,
      deletedFieldKeys: deletedFieldKeys({ previousSavedTextGraph, currentSavedTextGraph }),
    });
  }

  void queue;
  return {
    ok: true,
    baseLocale,
    jobs,
    skippedLocales,
    targetLocales,
  };
}

export async function acceptInstanceTranslationJobs(args: {
  authz: RomaAccountAuthzCapsulePayload;
  accessToken: string;
  accountCapsule: string;
  accountPublicId: string;
  instanceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  previousConfig: Record<string, unknown> | null;
  translateAllCurrentFields?: boolean;
  skipReadyLocales?: boolean;
  targetLocales?: string[];
  requestId?: string | null;
}): Promise<InstanceTranslationJobAcceptance> {
  const queue = resolveTranslationQueue();
  const built = await buildAcceptedTranslationJobs(args);
  if (!built.ok) return built;
  if (!queue) {
    return acceptanceFailure({
      baseLocale: built.baseLocale,
      reasonKey: 'instance.translation.queue_unavailable',
      detail: 'INSTANCE_TRANSLATION_JOBS queue binding is unavailable.',
    });
  }

  try {
    await Promise.all(built.jobs.map((job) => queue.send(job)));
  } catch (error) {
    return acceptanceFailure({
      baseLocale: built.baseLocale,
      reasonKey: 'instance.translation.queue_send_failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  return {
    ok: true,
    accepted: built.jobs.length > 0,
    baseLocale: built.baseLocale,
    targetLocales: built.targetLocales,
    queuedLocales: built.jobs.map((job) => job.targetLocale),
    skippedLocales: built.skippedLocales,
    jobIds: built.jobs.map((job) => job.jobId),
    results: built.jobs.map((job) => ({ locale: job.targetLocale, ok: true, jobId: job.jobId })),
  };
}
