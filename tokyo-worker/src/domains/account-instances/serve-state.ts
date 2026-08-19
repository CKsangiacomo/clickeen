import type { Env } from '../../types';
import { putJson } from '../storage';
import { accountInstanceServeStateKey } from './keys';
import type { InstanceServeState } from './types';

type InstanceCoordinate = {
  accountId: string;
  instanceId: string;
  widgetCode: string;
};

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

export type InstanceServeStateRecord = {
  status: InstanceServeState;
  publishedAt: string | null;
};

async function readStoredServeStateRecord(
  env: Env,
  coordinate: InstanceCoordinate,
): Promise<InstanceServeStateRecord> {
  const obj = await env.TOKYO_R2.get(
    accountInstanceServeStateKey(coordinate.accountId, coordinate.widgetCode, coordinate.instanceId),
  );
  if (!obj) throw new Error('coreui.errors.instance.serveStateMissing');
  try {
    const record = await obj.json<{ status: InstanceServeState; publishedAt?: string }>();
    return { status: record.status, publishedAt: record.publishedAt ?? null };
  } catch {
    throw new Error('coreui.errors.instance.serveStateInvalid');
  }
}

export async function readInstanceServeStateRecord(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetCode: string;
}): Promise<InstanceServeStateRecord> {
  return readStoredServeStateRecord(args.env, args);
}

export async function readInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetCode: string;
}): Promise<InstanceServeState> {
  return (await readStoredServeStateRecord(args.env, args)).status;
}

export async function createInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetCode: string;
  now?: string;
}): Promise<InstanceServeState> {
  await putJson(
    args.env,
    accountInstanceServeStateKey(args.accountId, args.widgetCode, args.instanceId),
    serveStatePayload(args, 'unpublished', args.now),
  );
  return 'unpublished';
}

export async function writeInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  status: InstanceServeState;
  widgetCode: string;
  now?: string;
}): Promise<void> {
  await putJson(
    args.env,
    accountInstanceServeStateKey(args.accountId, args.widgetCode, args.instanceId),
    serveStatePayload(args, args.status, args.now),
  );
}
