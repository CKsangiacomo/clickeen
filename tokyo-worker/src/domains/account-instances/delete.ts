import type { Env } from '../../types';
import { accountInstanceRoot } from './keys';
import { deletePrefix } from '../storage';

export async function deleteAccountInstanceSubtree(
  env: Env,
  instanceId: string,
  accountId: string,
  widgetCode: string,
): Promise<void> {
  await deletePrefix(env, `${accountInstanceRoot(accountId, widgetCode, instanceId)}/`);
}
