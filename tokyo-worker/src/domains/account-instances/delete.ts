import type { Env } from '../../types';
import { accountInstanceRoot } from './keys';
import { deletePrefix } from '../storage';
import { normalizeStorageId } from './utils';
import { readConfigDocumentByLocation } from './source';

export async function deleteAccountInstanceSubtree(env: Env, instanceId: string, accountId: string): Promise<{ existed: boolean }> {
  const normalized = normalizeStorageId(instanceId);
  const normalizedAccount = normalizeStorageId(accountId);
  if (!normalized) throw new Error('[tokyo] delete-instance missing instanceId');
  if (!normalizedAccount) throw new Error('[tokyo] delete-instance missing accountId');
  const configDoc = await readConfigDocumentByLocation({
    env,
    accountId: normalizedAccount,
    widgetCode: '',
    instanceId: normalized,
  });
  const existed = Boolean(configDoc);
  if (configDoc) {
    await deletePrefix(env, `${accountInstanceRoot(normalizedAccount, configDoc.widgetCode, normalized)}/`);
  }
  return { existed };
}
