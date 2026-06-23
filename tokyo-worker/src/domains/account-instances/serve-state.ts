import { isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import { putJson } from '../storage';
import { accountInstanceServeStateKey } from './keys';
import type { InstanceServeState } from './types';
import { normalizeStorageId } from './utils';

type InstanceCoordinate = {
  accountId: string;
  instanceId: string;
  widgetCode: string;
};

function assertCoordinate(args: {
  accountId: string;
  instanceId: string;
  widgetCode?: string | null;
}): InstanceCoordinate {
  const accountId = normalizeStorageId(args.accountId);
  const instanceId = normalizeStorageId(args.instanceId);
  const widgetCode = typeof args.widgetCode === 'string' ? args.widgetCode.trim() : '';
  if (!isCompactAccountPublicId(accountId) || !isCompactInstanceId(instanceId) || !widgetCode) {
    throw new Error('coreui.errors.instance.invalidPayload');
  }
  return { accountId, instanceId, widgetCode };
}

function serveStatePayload(
  coordinate: InstanceCoordinate,
  status: InstanceServeState,
  now = new Date().toISOString(),
) {
  return {
    accountId: coordinate.accountId,
    instanceId: coordinate.instanceId,
    status,
    ...(status === 'published' ? { publishedAt: now } : {}),
    updatedAt: now,
  };
}

async function readStoredServeState(env: Env, coordinate: InstanceCoordinate): Promise<InstanceServeState> {
  const obj = await env.TOKYO_R2.get(
    accountInstanceServeStateKey(coordinate.accountId, coordinate.widgetCode, coordinate.instanceId),
  );
  if (!obj) throw new Error('coreui.errors.instance.serveStateMissing');
  let record: Record<string, unknown> | null = null;
  try {
    record = (await obj.json()) as Record<string, unknown> | null;
  } catch {
    throw new Error('coreui.errors.instance.serveStateInvalid');
  }
  if (
    !record ||
    Array.isArray(record) ||
    record.accountId !== coordinate.accountId ||
    record.instanceId !== coordinate.instanceId ||
    (record.status !== 'published' && record.status !== 'unpublished') ||
    typeof record.updatedAt !== 'string' ||
    !record.updatedAt
  ) {
    throw new Error('coreui.errors.instance.serveStateInvalid');
  }
  return record.status;
}

export async function readInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetCode?: string | null;
}): Promise<InstanceServeState> {
  return readStoredServeState(args.env, assertCoordinate(args));
}

export async function createInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetCode?: string | null;
  now?: string;
}): Promise<InstanceServeState> {
  const coordinate = assertCoordinate(args);
  await putJson(
    args.env,
    accountInstanceServeStateKey(coordinate.accountId, coordinate.widgetCode, coordinate.instanceId),
    serveStatePayload(coordinate, 'unpublished', args.now),
  );
  return 'unpublished';
}

export async function writeInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  status: InstanceServeState;
  widgetCode?: string | null;
  now?: string;
}): Promise<{ changed: boolean }> {
  const coordinate = assertCoordinate(args);
  if (args.status !== 'published' && args.status !== 'unpublished') {
    throw new Error('coreui.errors.instance.serveStateInvalid');
  }
  const previous = await readStoredServeState(args.env, coordinate);
  await putJson(
    args.env,
    accountInstanceServeStateKey(coordinate.accountId, coordinate.widgetCode, coordinate.instanceId),
    serveStatePayload(coordinate, args.status, args.now),
  );
  return { changed: previous !== args.status };
}
