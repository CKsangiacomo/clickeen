import { normalizeLocaleToken } from '@clickeen/l10n';
import type { AiGrantPolicy } from './ai';
import type { SavedTextField } from './translated-value-primitives';

type JsonRecord = Record<string, unknown>;

export const INSTANCE_TRANSLATION_JOB_KIND = 'instance.translation.locale_values';
export const INSTANCE_TRANSLATION_AGENT_ID = 'widget.instance.translator';

export type InstanceTranslationJob = {
  v: 2;
  kind: typeof INSTANCE_TRANSLATION_JOB_KIND;
  jobId: string;
  accountId: string;
  accountPublicId: string;
  userId: string;
  instanceId: string;
  widgetType: string;
  widgetContract: {
    schemaVersion: 1;
    hash: string;
  };
  baseLocale: string;
  targetLocale: string;
  targetLocales: string[];
  requestedAt: string;
  requestId?: string;
  ai: AiGrantPolicy;
  budgets: {
    maxTokens: number;
    timeoutMs?: number;
  };
  changedFields: SavedTextField[];
  deletedIdentityKeys: string[];
  basis: {
    fields: Array<{
      identityKey: string;
      fieldPattern: string;
      path: string;
      baseText: string;
    }>;
  };
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

function normalizeSavedTextField(raw: unknown): SavedTextField | null {
  if (!isRecord(raw)) return null;
  const identityKey = asTrimmedString(raw.identityKey);
  const fieldPattern = asTrimmedString(raw.fieldPattern);
  const path = asTrimmedString(raw.path);
  const role = asTrimmedString(raw.role);
  const label = asTrimmedString(raw.label);
  const baseText = typeof raw.baseText === 'string' ? raw.baseText : null;
  const type = raw.type === 'richtext' ? 'richtext' : raw.type === 'string' ? 'string' : null;
  if (!identityKey || !fieldPattern || !path || !role || !label || !type || baseText == null) return null;
  return { identityKey, fieldPattern, path, role, label, type, baseText };
}

function normalizeSavedTextFields(raw: unknown): SavedTextField[] | null {
  if (!Array.isArray(raw)) return null;
  const fields = raw.map((entry) => normalizeSavedTextField(entry));
  if (fields.some((entry) => !entry)) return null;
  return fields as SavedTextField[];
}

function normalizeWidgetContract(raw: unknown): InstanceTranslationJob['widgetContract'] | null {
  if (!isRecord(raw)) return null;
  const hash = asTrimmedString(raw.hash);
  return raw.schemaVersion === 1 && hash ? { schemaVersion: 1, hash } : null;
}

function normalizeBasis(raw: unknown): InstanceTranslationJob['basis'] | null {
  if (!isRecord(raw) || !Array.isArray(raw.fields)) return null;
  const fields = raw.fields.map((entry) => {
    if (!isRecord(entry)) return null;
    const identityKey = asTrimmedString(entry.identityKey);
    const fieldPattern = asTrimmedString(entry.fieldPattern);
    const path = asTrimmedString(entry.path);
    const baseText = typeof entry.baseText === 'string' ? entry.baseText : null;
    return identityKey && fieldPattern && path && baseText != null
      ? { identityKey, fieldPattern, path, baseText }
      : null;
  });
  if (fields.some((entry) => !entry)) return null;
  return { fields: fields as InstanceTranslationJob['basis']['fields'] };
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
  if (!isRecord(raw) || raw.v !== 2 || raw.kind !== INSTANCE_TRANSLATION_JOB_KIND) return null;
  const jobId = asTrimmedString(raw.jobId);
  const accountId = asTrimmedString(raw.accountId);
  const accountPublicId = asTrimmedString(raw.accountPublicId);
  const userId = asTrimmedString(raw.userId);
  const instanceId = asTrimmedString(raw.instanceId);
  const widgetType = asTrimmedString(raw.widgetType);
  const widgetContract = normalizeWidgetContract(raw.widgetContract);
  const baseLocale = normalizeLocaleToken(raw.baseLocale);
  const targetLocale = normalizeLocaleToken(raw.targetLocale);
  const targetLocales = normalizeStringArray(raw.targetLocales);
  const requestedAt = asTrimmedString(raw.requestedAt);
  const ai = normalizeAiGrantPolicy(raw.ai);
  const budgets = isRecord(raw.budgets) ? raw.budgets : null;
  const maxTokens = normalizePositiveInteger(budgets?.maxTokens);
  const timeoutMs =
    typeof budgets?.timeoutMs === 'number' && Number.isInteger(budgets.timeoutMs) && budgets.timeoutMs > 0
      ? budgets.timeoutMs
      : null;
  const changedFields = normalizeSavedTextFields(raw.changedFields);
  const deletedIdentityKeys = normalizeStringArray(raw.deletedIdentityKeys);
  const basis = normalizeBasis(raw.basis);

  if (
    !jobId ||
    !accountId ||
    !accountPublicId ||
    !userId ||
    !instanceId ||
    !widgetType ||
    !widgetContract ||
    !baseLocale ||
    !targetLocale ||
    baseLocale === targetLocale ||
    !targetLocales ||
    !requestedAt ||
    !ai ||
    !budgets ||
    maxTokens == null ||
    !changedFields ||
    !deletedIdentityKeys ||
    !basis
  ) {
    return null;
  }

  return {
    v: 2,
    kind: INSTANCE_TRANSLATION_JOB_KIND,
    jobId,
    accountId,
    accountPublicId,
    userId,
    instanceId,
    widgetType,
    widgetContract,
    baseLocale,
    targetLocale,
    targetLocales,
    requestedAt,
    ...(asTrimmedString(raw.requestId) ? { requestId: asTrimmedString(raw.requestId) as string } : {}),
    ai,
    budgets: {
      maxTokens,
      ...(timeoutMs != null ? { timeoutMs } : {}),
    },
    changedFields,
    deletedIdentityKeys,
    basis,
  };
}

export function isInstanceTranslationJob(raw: unknown): raw is InstanceTranslationJob {
  return normalizeInstanceTranslationJob(raw) != null;
}
