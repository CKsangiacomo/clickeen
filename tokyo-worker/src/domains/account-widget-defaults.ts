import type { AccountFontLibrary } from '@clickeen/widget-foundation';
import type { Env } from '../types';
import { putJson } from './storage';

export type AccountWidgetDefaultsDocument = {
  accountId: string;
  fontLibrary: AccountFontLibrary;
  common: Record<string, unknown>;
  widgets: Record<
    string,
    {
      core: Record<string, unknown>;
    }
  >;
  seededAt: string;
  updatedAt: string;
};

export function accountWidgetDefaultsKey(accountId: string): string {
  return `accounts/${accountId}/widget-defaults.json`;
}

async function loadStoredAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
}): Promise<{ exists: true; value: unknown } | { exists: false }> {
  const obj = await args.env.TOKYO_R2.get(accountWidgetDefaultsKey(args.accountId));
  if (!obj) return { exists: false };
  try {
    return { exists: true, value: await obj.json() };
  } catch {
    throw new Error('tokyo.widgetDefaults.invalid');
  }
}

export async function readAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
}): Promise<AccountWidgetDefaultsDocument | null> {
  const loaded = await loadStoredAccountWidgetDefaults(args);
  if (!loaded.exists) throw new Error('tokyo.widgetDefaults.missing');
  return loaded.value as AccountWidgetDefaultsDocument;
}

export async function createInitialAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
}): Promise<AccountWidgetDefaultsDocument> {
  const existing = await loadStoredAccountWidgetDefaults(args);
  if (existing.exists) {
    throw new Error('tokyo.widgetDefaults.exists');
  }
  await putJson(args.env, accountWidgetDefaultsKey(args.accountId), args.widgetDefaults);
  return args.widgetDefaults;
}

export async function writeAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
}): Promise<AccountWidgetDefaultsDocument> {
  await putJson(args.env, accountWidgetDefaultsKey(args.accountId), args.widgetDefaults);
  return args.widgetDefaults;
}
