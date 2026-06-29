import { isRecord } from '@clickeen/ck-contracts';
import {
  normalizeAccountFontLibrary,
  type AccountFontLibrary,
} from '@clickeen/widget-shell';
import type { Env } from '../types';
import { putJson } from './storage';

export type AccountWidgetDefaultsDocument = {
  accountId: string;
  fontLibrary: AccountFontLibrary;
  shell: Record<string, unknown>;
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

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
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

export function normalizeAccountWidgetDefaultsDocument(
  value: unknown,
  accountId: string,
): AccountWidgetDefaultsDocument | null {
  if (!isRecord(value) || value.accountId !== accountId) return null;
  if (!isRecord(value.shell) || !isRecord(value.widgets)) return null;
  if (typeof value.seededAt !== 'string' || !value.seededAt.trim()) return null;
  if (typeof value.updatedAt !== 'string' || !value.updatedAt.trim()) return null;
  const fontLibrary = normalizeAccountFontLibrary(value.fontLibrary);
  if (!fontLibrary) return null;

  const shell = cloneRecord(value.shell);
  const widgets: AccountWidgetDefaultsDocument['widgets'] = {};
  for (const [widgetType, widgetDefaults] of Object.entries(value.widgets)) {
    if (!isRecord(widgetDefaults) || !isRecord(widgetDefaults.core)) return null;
    if (!widgetType.trim()) return null;
    widgets[widgetType] = {
      core: cloneRecord(widgetDefaults.core),
    };
  }

  return {
    accountId,
    fontLibrary,
    shell,
    widgets,
    seededAt: value.seededAt,
    updatedAt: value.updatedAt,
  };
}

export async function readAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
}): Promise<AccountWidgetDefaultsDocument | null> {
  const loaded = await loadStoredAccountWidgetDefaults(args);
  if (!loaded.exists) throw new Error('tokyo.widgetDefaults.missing');
  const normalized = normalizeAccountWidgetDefaultsDocument(loaded.value, args.accountId);
  if (!normalized) throw new Error('tokyo.widgetDefaults.invalid');
  return normalized;
}

export async function createInitialAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
}): Promise<AccountWidgetDefaultsDocument> {
  const existing = await loadStoredAccountWidgetDefaults(args);
  if (existing.exists) {
    const normalized = normalizeAccountWidgetDefaultsDocument(existing.value, args.accountId);
    throw new Error(normalized ? 'tokyo.widgetDefaults.exists' : 'tokyo.widgetDefaults.invalid');
  }
  const normalized = normalizeAccountWidgetDefaultsDocument(args.widgetDefaults, args.accountId);
  if (!normalized) throw new Error('tokyo.widgetDefaults.invalid');
  await putJson(args.env, accountWidgetDefaultsKey(args.accountId), normalized);
  return normalized;
}

export async function writeAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
}): Promise<AccountWidgetDefaultsDocument> {
  const normalized = normalizeAccountWidgetDefaultsDocument(args.widgetDefaults, args.accountId);
  if (!normalized) throw new Error('tokyo.widgetDefaults.invalid');
  await putJson(args.env, accountWidgetDefaultsKey(args.accountId), normalized);
  return normalized;
}
