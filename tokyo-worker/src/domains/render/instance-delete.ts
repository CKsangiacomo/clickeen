import type { Env } from '../../types';
import { accountInstanceRoot } from './keys';
import {
  deleteInstanceRegistryRow,
  resolveAccountInstanceLocation,
} from './instance-registry';
import { deletePrefix } from './storage';
import { normalizeStorageId } from './utils';

export async function deleteAccountInstanceSubtree(env: Env, instanceId: string, accountId: string): Promise<{ existed: boolean }> {
  const normalized = normalizeStorageId(instanceId);
  const normalizedAccount = normalizeStorageId(accountId);
  if (!normalized) throw new Error('[tokyo] delete-instance missing instanceId');
  if (!normalizedAccount) throw new Error('[tokyo] delete-instance missing accountId');
  const location = await resolveAccountInstanceLocation({
    env,
    accountId: normalizedAccount,
    instanceId: normalized,
  });
  const existed = Boolean(location);
  if (location) {
    await deletePrefix(env, `${accountInstanceRoot(location.accountId, location.widgetCode, location.instanceId)}/`);
    await deleteInstanceRegistryRow({ env, accountId: location.accountId, instanceId: location.instanceId });
  }
  return { existed };
}
