import type { Env } from '../../types';
import { accountInstanceRoot, accountInstanceSourceKey } from './keys';
import { deletePrefix } from '../storage';

export async function deleteAccountInstanceSourceAnchor(
  env: Env,
  instanceId: string,
  accountId: string,
  widgetCode: string,
): Promise<void> {
  await env.TOKYO_R2.delete(accountInstanceSourceKey(accountId, widgetCode, instanceId));
}

export function scheduleAccountInstanceResidualCleanup(args: {
  env: Env;
  waitUntil: ExecutionContext['waitUntil'];
  instanceId: string;
  accountId: string;
}): void {
  const cleanup = deletePrefix(
    args.env,
    `${accountInstanceRoot(args.accountId, '', args.instanceId)}/`,
  ).then(
    () => undefined,
    () => undefined,
  );
  try {
    args.waitUntil(cleanup);
  } catch {
    // The source anchor is the completed product deletion; residual bytes are unreachable.
  }
}
