import type { Env } from '../../types';
import { putJson } from '../storage';
import { accountInstanceServeStateKey } from './keys';
import type { SubmittedInstancePublicPackage } from './package-files';
import type { InstanceServeState } from './types';

type InstanceCoordinate = {
  accountId: string;
  instanceId: string;
};

function serveStatePayload(
  coordinate: InstanceCoordinate,
  status: InstanceServeState,
  publicPackage: SubmittedInstancePublicPackage | null,
  now = new Date().toISOString(),
) {
  return {
    accountId: coordinate.accountId,
    instanceId: coordinate.instanceId,
    status,
    ...(status === 'published' ? { publishedAt: now } : {}),
    ...(status === 'published' ? { publicPackage } : {}),
    updatedAt: now,
  };
}

export type InstanceServeStateRecord =
  | {
      status: 'unpublished';
      publishedAt: null;
      publicPackage: null;
    }
  | {
      status: 'published';
      publishedAt: string;
      publicPackage: SubmittedInstancePublicPackage;
    };

async function readStoredServeStateRecord(
  env: Env,
  coordinate: InstanceCoordinate,
): Promise<InstanceServeStateRecord> {
  const obj = await env.TOKYO_R2.get(
    accountInstanceServeStateKey(coordinate.accountId, coordinate.instanceId),
  );
  if (!obj) throw new Error('coreui.errors.instance.serveStateMissing');
  try {
    const record = await obj.json<{
      status: InstanceServeState;
      publishedAt?: string;
      publicPackage?: SubmittedInstancePublicPackage;
    }>();
    if (record.status === 'published') {
      return {
        status: 'published',
        publishedAt: record.publishedAt!,
        publicPackage: record.publicPackage!,
      };
    }
    if (record.status === 'unpublished') {
      return { status: 'unpublished', publishedAt: null, publicPackage: null };
    }
    throw new Error('serve_state_status_invalid');
  } catch {
    throw new Error('coreui.errors.instance.serveStateInvalid');
  }
}

export async function readInstanceServeStateRecord(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<InstanceServeStateRecord> {
  return readStoredServeStateRecord(args.env, args);
}

export async function readInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<InstanceServeState> {
  return (await readStoredServeStateRecord(args.env, args)).status;
}

export async function createInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  now?: string;
}): Promise<InstanceServeState> {
  await putJson(
    args.env,
    accountInstanceServeStateKey(args.accountId, args.instanceId),
    serveStatePayload(args, 'unpublished', null, args.now),
  );
  return 'unpublished';
}

export async function writeInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  now?: string;
} & (
  | { status: 'published'; publicPackage: SubmittedInstancePublicPackage }
  | { status: 'unpublished'; publicPackage?: never }
)): Promise<void> {
  await putJson(
    args.env,
    accountInstanceServeStateKey(args.accountId, args.instanceId),
    serveStatePayload(
      args,
      args.status,
      args.status === 'published' ? args.publicPackage : null,
      args.now,
    ),
  );
}
