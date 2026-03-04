import type { Env } from './types';
import { asTrimmedString } from './validation';

const DEFAULT_ADMIN_ACCOUNT_ID = '00000000-0000-0000-0000-000000000100';

export function resolveAdminAccountId(env: Env): string {
  return asTrimmedString(env.CK_ADMIN_ACCOUNT_ID) ?? DEFAULT_ADMIN_ACCOUNT_ID;
}

