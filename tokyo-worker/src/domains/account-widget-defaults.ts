import { isRecord } from '@clickeen/ck-contracts';
import { WIDGET_SHELL_FACTORY_DEFAULTS } from '@clickeen/widget-shell';
import type { Env } from '../types';
import { loadJson, putJson } from './storage';
import { listWidgetCoreFactoryDefaults } from './widget-definitions';

export type AccountWidgetDefaultsDocument = {
  v: 1;
  accountId: string;
  shell: Record<string, unknown>;
  widgets: Record<string, {
    core: Record<string, unknown>;
  }>;
  seededAt: string;
  updatedAt: string;
};

export function accountWidgetDefaultsKey(accountId: string): string {
  return `accounts/${accountId}/widget-defaults.json`;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createAccountWidgetDefaultsSeed(args: {
  accountId: string;
  now?: string;
}): AccountWidgetDefaultsDocument {
  const now = args.now ?? nowIso();
  const widgets: AccountWidgetDefaultsDocument['widgets'] = {};
  for (const entry of listWidgetCoreFactoryDefaults()) {
    widgets[entry.widgetType] = {
      core: cloneRecord(entry.core),
    };
  }
  return {
    v: 1,
    accountId: args.accountId,
    shell: cloneRecord(WIDGET_SHELL_FACTORY_DEFAULTS as unknown as Record<string, unknown>),
    widgets,
    seededAt: now,
    updatedAt: now,
  };
}

export function normalizeAccountWidgetDefaultsDocument(
  value: unknown,
  accountId: string,
): AccountWidgetDefaultsDocument | null {
  if (!isRecord(value) || value.v !== 1 || value.accountId !== accountId) return null;
  if (!isRecord(value.shell) || !isRecord(value.widgets)) return null;
  const widgets: AccountWidgetDefaultsDocument['widgets'] = {};
  for (const [widgetType, widgetDefaults] of Object.entries(value.widgets)) {
    if (!widgetType || !isRecord(widgetDefaults) || !isRecord(widgetDefaults.core)) return null;
    widgets[widgetType] = {
      core: cloneRecord(widgetDefaults.core),
    };
  }
  const seededAt = typeof value.seededAt === 'string' && value.seededAt.trim() ? value.seededAt : nowIso();
  const updatedAt = typeof value.updatedAt === 'string' && value.updatedAt.trim() ? value.updatedAt : seededAt;
  return {
    v: 1,
    accountId,
    shell: cloneRecord(value.shell),
    widgets,
    seededAt,
    updatedAt,
  };
}

export async function readAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
}): Promise<AccountWidgetDefaultsDocument | null> {
  const loaded = await loadJson<unknown>(args.env, accountWidgetDefaultsKey(args.accountId));
  if (loaded == null) return null;
  const normalized = normalizeAccountWidgetDefaultsDocument(loaded, args.accountId);
  if (!normalized) throw new Error('tokyo.widgetDefaults.invalid');
  return normalized;
}

export async function writeAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
}): Promise<AccountWidgetDefaultsDocument> {
  const normalized = normalizeAccountWidgetDefaultsDocument(args.widgetDefaults, args.accountId);
  if (!normalized) throw new Error('tokyo.widgetDefaults.invalid');
  const next: AccountWidgetDefaultsDocument = {
    ...normalized,
    updatedAt: nowIso(),
  };
  await putJson(args.env, accountWidgetDefaultsKey(args.accountId), next);
  return next;
}

export async function readOrSeedAccountWidgetDefaults(args: {
  env: Env;
  accountId: string;
}): Promise<AccountWidgetDefaultsDocument> {
  const existing = await readAccountWidgetDefaults(args);
  if (existing) return existing;
  const seeded = createAccountWidgetDefaultsSeed({ accountId: args.accountId });
  await putJson(args.env, accountWidgetDefaultsKey(args.accountId), seeded);
  return seeded;
}
