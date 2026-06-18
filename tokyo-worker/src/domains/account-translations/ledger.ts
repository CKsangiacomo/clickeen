import type { Env } from '../../types';
import { supabaseFetch } from '../../supabase';
import { deriveTranslationGenerationOperation } from './generation-state';
import type {
  TranslationGenerationOperationDocument,
  TranslationGenerationLocaleStatus,
} from '../account-instances/types';

export type TranslationOperationStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timed_out';

type TranslationOperationLocaleDbStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stale';

type TranslationOperationDbRow = {
  id: string;
  account_public_id: string;
  instance_id: string;
  base_locale: string;
  target_locales: unknown;
  base_content_marker: string;
  generation_request_marker: string;
  status: TranslationOperationStatus;
  requested_at: string;
  updated_at: string;
  expires_at: string;
  reason_key?: string | null;
  detail?: string | null;
};

type TranslationOperationLocaleDbRow = {
  operation_id: string;
  locale: string;
  status: TranslationOperationLocaleDbStatus;
  enqueue_status: 'pending' | 'sent' | 'failed';
  job_id?: string | null;
  base_content_marker: string;
  requested_at: string;
  updated_at: string;
  completed_at?: string | null;
  reason_key?: string | null;
  detail?: string | null;
};

function eq(value: string): string {
  return `eq.${encodeURIComponent(value)}`;
}

function readJson(response: Response): Promise<unknown> {
  return response.status === 204 ? Promise.resolve(null) : response.json().catch(() => null);
}

async function assertSupabaseOk(response: Response, operation: string): Promise<unknown> {
  const payload = await readJson(response);
  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? String(
            (payload as { message?: unknown; code?: unknown }).message ??
              (payload as { code?: unknown }).code ??
              operation,
          )
        : operation;
    throw new Error(`tokyo.translation.operation.${operation}:${detail}`);
  }
  return payload;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function localeStatusFromDb(
  status: TranslationOperationLocaleDbStatus,
): TranslationGenerationLocaleStatus {
  if (status === 'stale') return 'superseded';
  if (status === 'running') return 'queued';
  return status;
}

function operationStatusForDocument(
  status: TranslationOperationStatus,
): TranslationGenerationOperationDocument['status'] {
  if (status === 'timed_out') return 'failed';
  return status;
}

function normalizeOperationRow(value: unknown): TranslationOperationDbRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<TranslationOperationDbRow>;
  const status = row.status;
  if (
    typeof row.id !== 'string' ||
    typeof row.account_public_id !== 'string' ||
    typeof row.instance_id !== 'string' ||
    typeof row.base_locale !== 'string' ||
    typeof row.base_content_marker !== 'string' ||
    typeof row.generation_request_marker !== 'string' ||
    (status !== 'queued' &&
      status !== 'running' &&
      status !== 'completed' &&
      status !== 'failed' &&
      status !== 'timed_out') ||
    typeof row.requested_at !== 'string' ||
    typeof row.updated_at !== 'string' ||
    typeof row.expires_at !== 'string'
  ) {
    return null;
  }
  return {
    id: row.id,
    account_public_id: row.account_public_id,
    instance_id: row.instance_id,
    base_locale: row.base_locale,
    target_locales: row.target_locales,
    base_content_marker: row.base_content_marker,
    generation_request_marker: row.generation_request_marker,
    status,
    requested_at: row.requested_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
    ...(typeof row.reason_key === 'string' ? { reason_key: row.reason_key } : {}),
    ...(typeof row.detail === 'string' ? { detail: row.detail } : {}),
  };
}

function normalizeLocaleRow(value: unknown): TranslationOperationLocaleDbRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<TranslationOperationLocaleDbRow>;
  const status = row.status;
  const enqueueStatus = row.enqueue_status;
  if (
    typeof row.operation_id !== 'string' ||
    typeof row.locale !== 'string' ||
    (status !== 'queued' &&
      status !== 'running' &&
      status !== 'completed' &&
      status !== 'failed' &&
      status !== 'stale') ||
    (enqueueStatus !== 'pending' && enqueueStatus !== 'sent' && enqueueStatus !== 'failed') ||
    typeof row.base_content_marker !== 'string' ||
    typeof row.requested_at !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    return null;
  }
  return {
    operation_id: row.operation_id,
    locale: row.locale,
    status,
    enqueue_status: enqueueStatus,
    ...(typeof row.job_id === 'string' ? { job_id: row.job_id } : {}),
    base_content_marker: row.base_content_marker,
    requested_at: row.requested_at,
    updated_at: row.updated_at,
    ...(typeof row.completed_at === 'string' ? { completed_at: row.completed_at } : {}),
    ...(typeof row.reason_key === 'string' ? { reason_key: row.reason_key } : {}),
    ...(typeof row.detail === 'string' ? { detail: row.detail } : {}),
  };
}

function documentFromRows(args: {
  operation: TranslationOperationDbRow;
  locales: TranslationOperationLocaleDbRow[];
  widgetType: string;
  currentReadyLocales?: string[];
}): TranslationGenerationOperationDocument {
  const locales = Object.fromEntries(
    args.locales.map((locale) => [
      locale.locale,
      {
        locale: locale.locale,
        status: localeStatusFromDb(locale.status),
        paths: [],
        updatedAt: locale.updated_at,
        ...(locale.reason_key ? { reasonKey: locale.reason_key } : {}),
        ...(locale.detail ? { detail: locale.detail } : {}),
      },
    ]),
  );
  return deriveTranslationGenerationOperation({
    job: {
      jobId: args.operation.id,
      baseContentMarker: args.operation.base_content_marker,
      generationRequestMarker: args.operation.generation_request_marker,
      accountId: args.operation.account_public_id,
      instanceId: args.operation.instance_id,
      widgetType: args.widgetType,
      baseLocale: args.operation.base_locale,
      targetLocales: stringArray(args.operation.target_locales),
      status: operationStatusForDocument(args.operation.status),
      requestedAt: args.operation.requested_at,
      updatedAt: args.operation.updated_at,
      totalLocales: args.locales.length,
      completedLocales: [],
      failedLocales: [],
      supersededLocales: [],
      pendingLocales: [],
      currentReadyLocales: args.currentReadyLocales ?? [],
      locales,
      basis: [],
      ...(args.operation.reason_key ? { reasonKey: args.operation.reason_key } : {}),
      ...(args.operation.detail ? { detail: args.operation.detail } : {}),
    },
    currentReadyLocales: args.currentReadyLocales ?? [],
  });
}

async function readLocalesForOperation(
  env: Env,
  operationId: string,
): Promise<TranslationOperationLocaleDbRow[]> {
  const payload = await assertSupabaseOk(
    await supabaseFetch(
      env,
      `/rest/v1/translation_generation_operation_locales?operation_id=${eq(operationId)}&select=*&order=locale.asc`,
    ),
    'read_locales_failed',
  );
  if (!Array.isArray(payload)) throw new Error('tokyo.translation.operation.read_locales_invalid');
  const rows = payload.map(normalizeLocaleRow);
  if (rows.some((row) => !row)) throw new Error('tokyo.translation.operation.read_locales_invalid');
  return rows as TranslationOperationLocaleDbRow[];
}

function compareOperationRecency(
  left: TranslationOperationDbRow,
  right: TranslationOperationDbRow,
): number {
  const requested = right.requested_at.localeCompare(left.requested_at);
  if (requested !== 0) return requested;
  const updated = right.updated_at.localeCompare(left.updated_at);
  if (updated !== 0) return updated;
  return left.id.localeCompare(right.id);
}

function selectCurrentOperation(
  rows: TranslationOperationDbRow[],
): TranslationOperationDbRow | null {
  const ordered = [...rows].sort(compareOperationRecency);
  return (
    ordered.find((row) => row.status === 'queued' || row.status === 'running') ?? ordered[0] ?? null
  );
}

export async function readLatestTranslationGenerationOperation(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetType: string;
  currentReadyLocales?: string[];
}): Promise<TranslationGenerationOperationDocument | null> {
  const payload = await assertSupabaseOk(
    await supabaseFetch(
      args.env,
      `/rest/v1/translation_generation_operations?account_public_id=${eq(args.accountId)}&instance_id=${eq(args.instanceId)}&select=*&order=requested_at.desc,updated_at.desc,id.asc&limit=20`,
    ),
    'read_operation_failed',
  );
  if (!Array.isArray(payload))
    throw new Error('tokyo.translation.operation.read_operation_invalid');
  const rows = payload.map(normalizeOperationRow);
  if (rows.some((row) => !row))
    throw new Error('tokyo.translation.operation.read_operation_invalid');
  const operation = selectCurrentOperation(rows as TranslationOperationDbRow[]);
  if (!operation) return null;
  const locales = await readLocalesForOperation(args.env, operation.id);
  return documentFromRows({
    operation,
    locales,
    widgetType: args.widgetType,
    currentReadyLocales: args.currentReadyLocales,
  });
}

export async function createTranslationGenerationOperation(args: {
  env: Env;
  operation: TranslationGenerationOperationDocument;
  expiresAt: string;
}): Promise<TranslationGenerationOperationDocument> {
  const operationPayload = {
    id: args.operation.jobId,
    account_public_id: args.operation.accountId,
    instance_id: args.operation.instanceId,
    base_locale: args.operation.baseLocale,
    target_locales: args.operation.targetLocales,
    base_content_marker: args.operation.baseContentMarker,
    generation_request_marker: args.operation.generationRequestMarker,
    status: args.operation.status,
    requested_at: args.operation.requestedAt,
    updated_at: args.operation.updatedAt,
    expires_at: args.expiresAt,
    reason_key: args.operation.reasonKey ?? null,
    detail: args.operation.detail ?? null,
  };
  const operationResponse = await supabaseFetch(
    args.env,
    '/rest/v1/translation_generation_operations',
    {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(operationPayload),
    },
  );
  if (operationResponse.status === 409) {
    const existing = await readLatestTranslationGenerationOperation({
      env: args.env,
      accountId: args.operation.accountId,
      instanceId: args.operation.instanceId,
      widgetType: args.operation.widgetType,
      currentReadyLocales: args.operation.currentReadyLocales,
    });
    if (existing && (existing.status === 'queued' || existing.status === 'running'))
      return existing;
  }
  await assertSupabaseOk(operationResponse, 'create_operation_failed');

  const locales = Object.values(args.operation.locales).map((locale) => ({
    operation_id: args.operation.jobId,
    locale: locale.locale,
    status: 'queued',
    enqueue_status: 'pending',
    job_id: args.operation.jobId,
    base_content_marker: args.operation.baseContentMarker,
    requested_at: args.operation.requestedAt,
    updated_at: locale.updatedAt,
    completed_at: null,
    reason_key: locale.reasonKey ?? null,
    detail: locale.detail ?? null,
  }));
  if (locales.length) {
    await assertSupabaseOk(
      await supabaseFetch(args.env, '/rest/v1/translation_generation_operation_locales', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(locales),
      }),
      'create_operation_locales_failed',
    );
  }
  return args.operation;
}

export async function markTranslationGenerationEnqueued(args: {
  env: Env;
  operationId: string;
  now: string;
}): Promise<void> {
  await assertSupabaseOk(
    await supabaseFetch(
      args.env,
      `/rest/v1/translation_generation_operation_locales?operation_id=${eq(args.operationId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          enqueue_status: 'sent',
          job_id: args.operationId,
          updated_at: args.now,
        }),
      },
    ),
    'mark_enqueued_failed',
  );
}

export async function failTranslationGenerationOperation(args: {
  env: Env;
  operationId: string;
  now: string;
  reasonKey: string;
  detail: string;
  localeDetail?: string;
  status?: 'failed' | 'timed_out';
}): Promise<void> {
  await assertSupabaseOk(
    await supabaseFetch(
      args.env,
      `/rest/v1/translation_generation_operations?id=${eq(args.operationId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: args.status ?? 'failed',
          updated_at: args.now,
          reason_key: args.reasonKey,
          detail: args.detail,
        }),
      },
    ),
    'fail_operation_failed',
  );
  await assertSupabaseOk(
    await supabaseFetch(
      args.env,
      `/rest/v1/translation_generation_operation_locales?operation_id=${eq(args.operationId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'failed',
          enqueue_status: 'failed',
          updated_at: args.now,
          completed_at: args.now,
          reason_key: args.reasonKey,
          detail: args.localeDetail ?? args.detail,
        }),
      },
    ),
    'fail_operation_locales_failed',
  );
}

export async function markTranslationGenerationLocaleStale(args: {
  env: Env;
  operationId: string;
  locale: string;
  now: string;
  reasonKey: string;
  detail: string;
}): Promise<void> {
  await assertSupabaseOk(
    await supabaseFetch(
      args.env,
      `/rest/v1/translation_generation_operation_locales?operation_id=${eq(args.operationId)}&locale=${eq(args.locale)}&status=in.(queued,running)`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'stale',
          updated_at: args.now,
          completed_at: args.now,
          reason_key: args.reasonKey,
          detail: args.detail,
        }),
      },
    ),
    'mark_locale_stale_failed',
  );
}

export async function completeTranslationGenerationLocale(args: {
  env: Env;
  operationId: string;
  locale: string;
  now: string;
  widgetType: string;
  currentReadyLocales: string[];
}): Promise<TranslationGenerationOperationDocument | null> {
  await assertSupabaseOk(
    await supabaseFetch(
      args.env,
      `/rest/v1/translation_generation_operation_locales?operation_id=${eq(args.operationId)}&locale=${eq(args.locale)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'completed', updated_at: args.now, completed_at: args.now }),
      },
    ),
    'complete_locale_failed',
  );
  return updateOperationStatusFromLocales({
    env: args.env,
    operationId: args.operationId,
    widgetType: args.widgetType,
    currentReadyLocales: args.currentReadyLocales,
    now: args.now,
  });
}

export async function failTranslationGenerationLocale(args: {
  env: Env;
  operationId: string;
  locale: string;
  now: string;
  reasonKey: string;
  detail: string;
  widgetType: string;
  currentReadyLocales: string[];
}): Promise<TranslationGenerationOperationDocument | null> {
  await assertSupabaseOk(
    await supabaseFetch(
      args.env,
      `/rest/v1/translation_generation_operation_locales?operation_id=${eq(args.operationId)}&locale=${eq(args.locale)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'failed',
          updated_at: args.now,
          completed_at: args.now,
          reason_key: args.reasonKey,
          detail: args.detail,
        }),
      },
    ),
    'fail_locale_failed',
  );
  return updateOperationStatusFromLocales({
    env: args.env,
    operationId: args.operationId,
    widgetType: args.widgetType,
    currentReadyLocales: args.currentReadyLocales,
    now: args.now,
    reasonKey: args.reasonKey,
    detail: args.detail,
  });
}

export async function updateOperationStatusFromLocales(args: {
  env: Env;
  operationId: string;
  widgetType: string;
  currentReadyLocales: string[];
  now: string;
  reasonKey?: string;
  detail?: string;
}): Promise<TranslationGenerationOperationDocument | null> {
  const operation = await readOperationRowById(args.env, args.operationId);
  if (!operation) return null;
  const locales = await readLocalesForOperation(args.env, args.operationId);
  const hasPending = locales.some(
    (locale) => locale.status === 'queued' || locale.status === 'running',
  );
  const hasFailed = locales.some((locale) => locale.status === 'failed');
  const status: TranslationOperationStatus = hasPending
    ? 'running'
    : hasFailed
      ? 'failed'
      : 'completed';
  await assertSupabaseOk(
    await supabaseFetch(
      args.env,
      `/rest/v1/translation_generation_operations?id=${eq(args.operationId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status,
          updated_at: args.now,
          reason_key: status === 'failed' ? (args.reasonKey ?? operation.reason_key ?? null) : null,
          detail: status === 'failed' ? (args.detail ?? operation.detail ?? null) : null,
        }),
      },
    ),
    'update_operation_status_failed',
  );
  const updated = await readOperationRowById(args.env, args.operationId);
  if (!updated) return null;
  const updatedLocales = await readLocalesForOperation(args.env, args.operationId);
  return documentFromRows({
    operation: updated,
    locales: updatedLocales,
    widgetType: args.widgetType,
    currentReadyLocales: args.currentReadyLocales,
  });
}

async function readOperationRowById(
  env: Env,
  operationId: string,
): Promise<TranslationOperationDbRow | null> {
  const payload = await assertSupabaseOk(
    await supabaseFetch(
      env,
      `/rest/v1/translation_generation_operations?id=${eq(operationId)}&select=*&limit=1`,
    ),
    'read_operation_by_id_failed',
  );
  if (!Array.isArray(payload))
    throw new Error('tokyo.translation.operation.read_operation_by_id_invalid');
  return normalizeOperationRow(payload[0]);
}
