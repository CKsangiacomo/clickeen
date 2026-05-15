import { isCompactAccountPublicId, isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';

export function isValidScopedInstance(
  instanceId: string | null,
  accountId: string,
): boolean {
  return isCompactInstanceId(instanceId) && isCompactAccountPublicId(accountId);
}
