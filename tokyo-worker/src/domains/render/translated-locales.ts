import type { Env } from '../../types';
import {
  readAccountInstanceContentDocument,
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
  const content = await readAccountInstanceContentDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!content.ok) return [];

  const fields = Object.values(content.value.fields);
  if (!fields.length) return [];

  const candidates = new Set<string>();
  for (const field of fields) {
    for (const [locale, status] of Object.entries(field.localeStatus ?? {})) {
      if (status === 'ok' && typeof field.translatedValues?.[locale] === 'string') candidates.add(locale);
    }
  }

  return Array.from(candidates)
    .filter((locale) => fields.every((field) => (
      field.localeStatus?.[locale] === 'ok' &&
      typeof field.translatedValues?.[locale] === 'string'
    )))
    .sort((left, right) => left.localeCompare(right))
    .map((locale) => ({ locale }));
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
