import type { Env } from '../../types';
import {
  listAccountInstanceTranslatedLocaleValues,
  readAccountInstanceTranslatedLocaleValues,
  writeAccountInstanceTranslatedLocaleValues,
} from './saved-config';

export type TranslatedLocaleSummary = {
  locale: string;
};

export type TranslatedLocaleValues = {
  locale: string;
  values: Record<string, string>;
};

export async function listTranslatedLocales(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<TranslatedLocaleSummary[]> {
  return listAccountInstanceTranslatedLocaleValues({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
}

export async function readTranslatedLocaleValues(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  locale: string;
}): Promise<TranslatedLocaleValues | null> {
  const translation = await readAccountInstanceTranslatedLocaleValues({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    locale: args.locale,
  });
  return translation.ok ? translation.value : null;
}

export async function writeTranslatedLocaleValues(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  locale: string;
  values: Record<string, string>;
}): Promise<TranslatedLocaleValues> {
  return writeAccountInstanceTranslatedLocaleValues({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    locale: args.locale,
    values: args.values,
  });
}
