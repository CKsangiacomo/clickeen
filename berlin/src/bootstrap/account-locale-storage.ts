export const ACCOUNT_MEMBERSHIP_BOOTSTRAP_SELECT =
  'account_id,user_id,role,created_at,accounts(id,status,tier,status_changed_at,selected_target_locales,locale_policy,created_at)';

export type BerlinAccountStorageAccountRow = {
  id?: unknown;
  status?: unknown;
  tier?: unknown;
  status_changed_at?: unknown;
  selected_target_locales?: unknown;
  locale_policy?: unknown;
  created_at?: unknown;
};

export function readStoredAccountActiveLocales(account: BerlinAccountStorageAccountRow): unknown {
  return account.selected_target_locales;
}

export function readStoredAccountLocalePolicy(account: BerlinAccountStorageAccountRow): unknown {
  return account.locale_policy;
}
