'use client';

import { DEFAULT_INSTANCE_DISPLAY_NAME, normalizeWidgetType } from './use-roma-widgets';

export type TemplateInstance = {
  publicId: string;
  widgetType: string;
  displayName: string;
};

type RawTemplateInstance = {
  publicId?: string | null;
  widgetType?: string | null;
  displayName?: string | null;
};

export type RomaTemplatesSnapshot = {
  accountId: string;
  widgetTypes: string[];
  instances: TemplateInstance[];
};

export function normalizeTemplateInstance(raw: RawTemplateInstance): TemplateInstance | null {
  const publicId = String(raw.publicId || '').trim();
  if (!publicId) return null;
  return {
    publicId,
    widgetType: normalizeWidgetType(raw.widgetType),
    displayName: String(raw.displayName || '').trim() || DEFAULT_INSTANCE_DISPLAY_NAME,
  };
}

function normalizeWidgetTypeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((entry) => normalizeWidgetType(typeof entry === 'string' ? entry : ''))
        .filter((widgetType) => widgetType !== 'unknown'),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function normalizeRomaTemplatesSnapshot(raw: unknown): RomaTemplatesSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const account = record.account;
  const accountId =
    account && typeof account === 'object' && !Array.isArray(account) && typeof (account as any).accountId === 'string'
      ? String((account as any).accountId).trim()
      : typeof record.accountId === 'string'
        ? record.accountId.trim()
        : '';
  if (!accountId) return null;

  const instances = Array.isArray(record.instances)
    ? record.instances
        .map((item) => normalizeTemplateInstance((item || {}) as RawTemplateInstance))
        .filter((item): item is TemplateInstance => Boolean(item))
    : [];

  return {
    accountId,
    widgetTypes: normalizeWidgetTypeList(record.widgetTypes),
    instances,
  };
}
