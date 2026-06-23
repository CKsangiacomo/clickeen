import {
  parseAccountLocaleListStrict,
  parseAccountLocalePolicyStrict,
} from '@clickeen/ck-contracts';

export const ACCOUNT_ACTIVE_LOCALES_PATCH_SELECT = 'id,selected_target_locales,locale_policy';

export type AccountActiveLocalesPatchRow = {
  id?: unknown;
  selected_target_locales?: unknown;
  locale_policy?: unknown;
};

export function buildAccountActiveLocalesPatch(args: {
  activeLocales: string[];
  localePolicy: unknown;
}): Record<string, unknown> {
  return {
    selected_target_locales: args.activeLocales,
    locale_policy: args.localePolicy,
  };
}

export function readAccountActiveLocalesPatch(row: AccountActiveLocalesPatchRow): {
  activeLocales: string[];
  localePolicy: ReturnType<typeof parseAccountLocalePolicyStrict>;
} {
  return {
    activeLocales: parseAccountLocaleListStrict(row.selected_target_locales),
    localePolicy: parseAccountLocalePolicyStrict(row.locale_policy),
  };
}
