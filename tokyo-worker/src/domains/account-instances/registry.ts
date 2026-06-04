import { isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import { supabaseFetch } from '../../supabase';
import { resolveWidgetCode } from '../widget-catalog';
import type { InstanceServeState } from './types';
import { normalizeStorageId } from './utils';

export type InstanceRegistryTranslationStatus = 'idle' | 'queued' | 'running' | 'failed';

export type InstanceRegistryRow = {
  id: string;
  accountId: string;
  widgetType: string;
  widgetCode: string;
  publishStatus: InstanceServeState;
  translationStatus: InstanceRegistryTranslationStatus;
  createdAt: string;
  editedAt: string;
};

export type AccountInstanceLocation = {
  accountId: string;
  widgetCode: string;
  widgetType: string;
  instanceId: string;
  publishStatus: InstanceServeState;
  translationStatus: InstanceRegistryTranslationStatus;
  createdAt: string;
  editedAt: string;
};

type InstanceRegistryDbRow = {
  id: string;
  account_id: string;
  widget_type: string;
  publish_status: InstanceServeState;
  translation_status: InstanceRegistryTranslationStatus;
  created_at: string;
  edited_at: string;
};

function eq(value: string): string {
  return `eq.${encodeURIComponent(value)}`;
}

function assertScopedIds(accountIdRaw: string, instanceIdRaw?: string): { accountId: string; instanceId?: string } {
  const accountId = normalizeStorageId(accountIdRaw);
  const instanceId = instanceIdRaw == null ? undefined : normalizeStorageId(instanceIdRaw);
  if (!isCompactAccountPublicId(accountId) || (instanceIdRaw != null && !isCompactInstanceId(instanceId || ''))) {
    throw new Error('coreui.errors.instance.invalidPayload');
  }
  return instanceIdRaw == null ? { accountId } : { accountId, instanceId: instanceId! };
}

function normalizePublishStatus(value: unknown): InstanceServeState | null {
  return value === 'published' || value === 'unpublished' ? value : null;
}

function normalizeTranslationStatus(value: unknown): InstanceRegistryTranslationStatus | null {
  return value === 'idle' || value === 'queued' || value === 'running' || value === 'failed' ? value : null;
}

function normalizeDbRow(value: unknown): InstanceRegistryRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<InstanceRegistryDbRow>;
  const id = normalizeStorageId(row.id);
  const accountId = normalizeStorageId(row.account_id);
  const widgetType = typeof row.widget_type === 'string' ? row.widget_type.trim() : '';
  const widgetCode = widgetType ? resolveWidgetCode(widgetType) : null;
  const publishStatus = normalizePublishStatus(row.publish_status);
  const translationStatus = normalizeTranslationStatus(row.translation_status);
  const createdAt = typeof row.created_at === 'string' ? row.created_at : '';
  const editedAt = typeof row.edited_at === 'string' ? row.edited_at : '';
  if (!isCompactInstanceId(id) || !isCompactAccountPublicId(accountId) || !widgetType || !widgetCode || !publishStatus || !translationStatus || !createdAt || !editedAt) {
    return null;
  }
  return { id, accountId, widgetType, widgetCode, publishStatus, translationStatus, createdAt, editedAt };
}

async function readJson(response: Response): Promise<unknown> {
  return response.status === 204 ? null : response.json().catch(() => null);
}

async function assertSupabaseOk(response: Response, operation: string): Promise<unknown> {
  const payload = await readJson(response);
  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? String((payload as { message?: unknown; code?: unknown }).message ?? (payload as { code?: unknown }).code ?? operation)
        : operation;
    throw new Error(`tokyo.instance.registry.${operation}:${detail}`);
  }
  return payload;
}

function rowToLocation(row: InstanceRegistryRow): AccountInstanceLocation {
  return {
    accountId: row.accountId,
    widgetCode: row.widgetCode,
    widgetType: row.widgetType,
    instanceId: row.id,
    publishStatus: row.publishStatus,
    translationStatus: row.translationStatus,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
  };
}

export async function listInstanceRegistryRows(args: {
  env: Env;
  accountId: string;
}): Promise<InstanceRegistryRow[]> {
  const { accountId } = assertScopedIds(args.accountId);
  const select = 'id,account_id,widget_type,publish_status,translation_status,created_at,edited_at';
  const payload = await assertSupabaseOk(
    await supabaseFetch(args.env, `/rest/v1/instances?account_id=${eq(accountId)}&select=${select}&order=edited_at.desc,id.asc`),
    'list_failed',
  );
  if (!Array.isArray(payload)) throw new Error('tokyo.instance.registry.list_invalid');
  return payload.map(normalizeDbRow).filter((row): row is InstanceRegistryRow => Boolean(row));
}

export async function readInstanceRegistryRow(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<InstanceRegistryRow | null> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const select = 'id,account_id,widget_type,publish_status,translation_status,created_at,edited_at';
  const payload = await assertSupabaseOk(
    await supabaseFetch(args.env, `/rest/v1/instances?account_id=${eq(accountId)}&id=${eq(instanceId!)}&select=${select}&limit=1`),
    'read_failed',
  );
  if (!Array.isArray(payload)) throw new Error('tokyo.instance.registry.read_invalid');
  return normalizeDbRow(payload[0]) ?? null;
}

export async function resolveAccountInstanceLocation(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetType?: string | null;
}): Promise<AccountInstanceLocation | null> {
  const row = await readInstanceRegistryRow(args);
  if (!row) return null;
  const requestedWidgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (requestedWidgetType && row.widgetType !== requestedWidgetType) return null;
  return rowToLocation(row);
}

export async function createInstanceRegistryRow(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetType: string;
  publishStatus?: InstanceServeState;
  translationStatus?: InstanceRegistryTranslationStatus;
  createdAt: string;
  editedAt: string;
}): Promise<InstanceRegistryRow> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const widgetType = String(args.widgetType || '').trim();
  if (!widgetType || !resolveWidgetCode(widgetType)) throw new Error('tokyo.errors.widget.unsupported');
  const payload = await assertSupabaseOk(
    await supabaseFetch(args.env, '/rest/v1/instances', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: instanceId,
        account_id: accountId,
        widget_type: widgetType,
        publish_status: args.publishStatus ?? 'unpublished',
        translation_status: args.translationStatus ?? 'idle',
        created_at: args.createdAt,
        edited_at: args.editedAt,
      }),
    }),
    'create_failed',
  );
  if (!Array.isArray(payload)) throw new Error('tokyo.instance.registry.create_invalid');
  const row = normalizeDbRow(payload[0]);
  if (!row) throw new Error('tokyo.instance.registry.create_invalid');
  return row;
}

export async function updateInstanceRegistryEditedAt(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  editedAt: string;
}): Promise<void> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const response = await supabaseFetch(args.env, `/rest/v1/instances?account_id=${eq(accountId)}&id=${eq(instanceId!)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ edited_at: args.editedAt }),
  });
  await assertSupabaseOk(response, 'touch_failed');
}

export async function updateInstanceRegistryPublishStatus(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  publishStatus: InstanceServeState;
}): Promise<void> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const response = await supabaseFetch(args.env, `/rest/v1/instances?account_id=${eq(accountId)}&id=${eq(instanceId!)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ publish_status: args.publishStatus }),
  });
  await assertSupabaseOk(response, 'publish_status_failed');
}

export async function updateInstanceRegistryTranslationStatus(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  translationStatus: InstanceRegistryTranslationStatus;
}): Promise<void> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const response = await supabaseFetch(args.env, `/rest/v1/instances?account_id=${eq(accountId)}&id=${eq(instanceId!)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ translation_status: args.translationStatus }),
  });
  await assertSupabaseOk(response, 'translation_status_failed');
}

export async function deleteInstanceRegistryRow(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<void> {
  const { accountId, instanceId } = assertScopedIds(args.accountId, args.instanceId);
  const response = await supabaseFetch(args.env, `/rest/v1/instances?account_id=${eq(accountId)}&id=${eq(instanceId!)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  await assertSupabaseOk(response, 'delete_failed');
}
