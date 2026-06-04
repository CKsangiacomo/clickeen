import type { Env } from '../../types';
import {
  resolveAccountInstanceLocation,
  updateInstanceRegistryPublishStatus,
} from './registry';
import type { InstanceServeState } from './types';
import { normalizeStorageId } from './utils';

export async function readInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetType?: string | null;
}): Promise<InstanceServeState> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) throw new Error('coreui.errors.instance.invalidPayload');
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) return 'unpublished';
  return location.publishStatus;
}

export async function writeInstanceServeState(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  status: InstanceServeState;
  widgetType?: string | null;
}): Promise<{ changed: boolean }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) throw new Error('coreui.errors.instance.invalidPayload');
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) throw new Error('coreui.errors.instance.notFound');
  const changed = location.publishStatus !== args.status;
  await updateInstanceRegistryPublishStatus({
    env: args.env,
    accountId: location.accountId,
    instanceId: location.instanceId,
    publishStatus: args.status,
  });
  return { changed };
}
