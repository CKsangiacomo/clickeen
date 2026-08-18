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

async function readStoredServeState(env: Env, coordinate: InstanceCoordinate): Promise<InstanceServeState> {
  const obj = await env.TOKYO_R2.get(
    accountInstanceServeStateKey(coordinate.accountId, coordinate.widgetCode, coordinate.instanceId),
  );
  if (!obj) throw new Error('coreui.errors.instance.serveStateMissing');
  try {
    const record = await obj.json<{ status: InstanceServeState }>();
    return record.status;
  } catch {
    throw new Error('coreui.errors.instance.serveStateInvalid');
  }
}

export async function readInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetCode: string;
}): Promise<InstanceServeState> {
  return readStoredServeState(args.env, args);
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
