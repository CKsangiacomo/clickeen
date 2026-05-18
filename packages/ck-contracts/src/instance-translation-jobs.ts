import { normalizeLocaleToken } from '@clickeen/l10n';
import type { AiGrantPolicy } from './ai';
import type { FaqLanguageValue, FaqSavedTextField } from './faq-language-values';

type JsonRecord = Record<string, unknown>;

export const INSTANCE_TRANSLATION_JOB_KIND = 'instance.translation.render_overlay';
export const INSTANCE_TRANSLATION_AGENT_ID = 'widget.instance.translator';

export type InstanceTranslationJob = {
  v: 1;
  kind: typeof INSTANCE_TRANSLATION_JOB_KIND;
  jobId: string;
  accountId: string;
  accountPublicId: string;
  userId: string;
  instanceId: string;
  widgetType: 'faq';
  sourceVersion: number;
  widgetContractVersion: number;
  baseLocale: string;
  targetLocale: string;
  requestedAt: string;
  requestId?: string;
  ai: AiGrantPolicy;
  budgets: {
    maxTokens: number;
    timeoutMs?: number;
  };
  previousSavedTextGraph: FaqSavedTextField[];
  currentSavedTextGraph: FaqSavedTextField[];
  previousLanguageValues: FaqLanguageValue[];
  changedFields: FaqSavedTextField[];
  deletedFieldKeys: string[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.map((entry) => asTrimmedString(entry));
  if (out.some((entry) => !entry)) return null;
  return out as string[];
}

function normalizeFaqIdentity(raw: unknown): FaqSavedTextField['identity'] | null {
  if (!isRecord(raw)) return null;
  const instanceId = asTrimmedString(raw.instanceId);
  const path = asTrimmedString(raw.path);
  const role = asTrimmedString(raw.role);
  if (!instanceId || raw.widgetType !== 'faq' || !path || !role) return null;
  return {
    instanceId,
    widgetType: 'faq',
    path,
    role,
    ...(asTrimmedString(raw.sectionId) ? { sectionId: asTrimmedString(raw.sectionId) as string } : {}),
    ...(asTrimmedString(raw.faqId) ? { faqId: asTrimmedString(raw.faqId) as string } : {}),
  };
}

function normalizeFaqSavedTextField(raw: unknown): FaqSavedTextField | null {
  if (!isRecord(raw)) return null;
  const identity = normalizeFaqIdentity(raw.identity);
  const label = asTrimmedString(raw.label);
  const baseText = typeof raw.baseText === 'string' ? raw.baseText : null;
  const type = raw.type === 'richtext' ? 'richtext' : raw.type === 'string' ? 'string' : null;
  if (!identity || !label || !type || baseText == null) return null;
  return { identity, label, type, baseText };
}

function normalizeFaqSavedTextFields(raw: unknown): FaqSavedTextField[] | null {
  if (!Array.isArray(raw)) return null;
  const fields = raw.map((entry) => normalizeFaqSavedTextField(entry));
  if (fields.some((entry) => !entry)) return null;
  return fields as FaqSavedTextField[];
}

function normalizeFaqLanguageValue(raw: unknown): FaqLanguageValue | null {
  if (!isRecord(raw)) return null;
  const identity = normalizeFaqIdentity(raw.identity);
  const locale = normalizeLocaleToken(raw.locale);
  const value = typeof raw.value === 'string' ? raw.value : null;
  const updatedAt = asTrimmedString(raw.updatedAt);
  if (!identity || !locale || value == null || !updatedAt) return null;
  return {
    identity,
    locale,
    value,
    updatedAt,
    ...(asTrimmedString(raw.jobId) ? { jobId: asTrimmedString(raw.jobId) as string } : {}),
  };
}

function normalizeFaqLanguageValues(raw: unknown): FaqLanguageValue[] | null {
  if (!Array.isArray(raw)) return null;
  const values = raw.map((entry) => normalizeFaqLanguageValue(entry));
  if (values.some((entry) => !entry)) return null;
  return values as FaqLanguageValue[];
}

function normalizeAiGrantPolicy(raw: unknown): AiGrantPolicy | null {
  if (!isRecord(raw)) return null;
  const defaultModel = isRecord(raw.defaultModel) ? raw.defaultModel : null;
  const modelsByProvider = isRecord(raw.modelsByProvider) ? raw.modelsByProvider : null;
  const policyProfile = asTrimmedString(raw.policyProfile);
  const policyVersion = asTrimmedString(raw.policyVersion);
  if (!defaultModel || !modelsByProvider || !policyProfile || !policyVersion) return null;
  return raw as AiGrantPolicy;
}

export function normalizeInstanceTranslationJob(raw: unknown): InstanceTranslationJob | null {
  if (!isRecord(raw) || raw.v !== 1 || raw.kind !== INSTANCE_TRANSLATION_JOB_KIND) return null;
  const jobId = asTrimmedString(raw.jobId);
  const accountId = asTrimmedString(raw.accountId);
  const accountPublicId = asTrimmedString(raw.accountPublicId);
  const userId = asTrimmedString(raw.userId);
  const instanceId = asTrimmedString(raw.instanceId);
  const sourceVersion = normalizePositiveInteger(raw.sourceVersion);
  const widgetContractVersion = normalizePositiveInteger(raw.widgetContractVersion);
  const baseLocale = normalizeLocaleToken(raw.baseLocale);
  const targetLocale = normalizeLocaleToken(raw.targetLocale);
  const requestedAt = asTrimmedString(raw.requestedAt);
  const ai = normalizeAiGrantPolicy(raw.ai);
  const budgets = isRecord(raw.budgets) ? raw.budgets : null;
  const maxTokens = normalizePositiveInteger(budgets?.maxTokens);
  const timeoutMs =
    typeof budgets?.timeoutMs === 'number' && Number.isInteger(budgets.timeoutMs) && budgets.timeoutMs > 0
      ? budgets.timeoutMs
      : null;
  const previousSavedTextGraph = normalizeFaqSavedTextFields(raw.previousSavedTextGraph);
  const currentSavedTextGraph = normalizeFaqSavedTextFields(raw.currentSavedTextGraph);
  const previousLanguageValues = normalizeFaqLanguageValues(raw.previousLanguageValues);
  const changedFields = normalizeFaqSavedTextFields(raw.changedFields);
  const deletedFieldKeys = normalizeStringArray(raw.deletedFieldKeys);

  if (
    !jobId ||
    !accountId ||
    !accountPublicId ||
    !userId ||
    !instanceId ||
    raw.widgetType !== 'faq' ||
    sourceVersion == null ||
    widgetContractVersion == null ||
    !baseLocale ||
    !targetLocale ||
    baseLocale === targetLocale ||
    !requestedAt ||
    !ai ||
    !budgets ||
    maxTokens == null ||
    !previousSavedTextGraph ||
    !currentSavedTextGraph ||
    !previousLanguageValues ||
    !changedFields ||
    !deletedFieldKeys
  ) {
    return null;
  }

  return {
    v: 1,
    kind: INSTANCE_TRANSLATION_JOB_KIND,
    jobId,
    accountId,
    accountPublicId,
    userId,
    instanceId,
    widgetType: 'faq',
    sourceVersion,
    widgetContractVersion,
    baseLocale,
    targetLocale,
    requestedAt,
    ...(asTrimmedString(raw.requestId) ? { requestId: asTrimmedString(raw.requestId) as string } : {}),
    ai,
    budgets: {
      maxTokens,
      ...(timeoutMs != null ? { timeoutMs } : {}),
    },
    previousSavedTextGraph,
    currentSavedTextGraph,
    previousLanguageValues,
    changedFields,
    deletedFieldKeys,
  };
}

export function isInstanceTranslationJob(raw: unknown): raw is InstanceTranslationJob {
  return normalizeInstanceTranslationJob(raw) != null;
}
