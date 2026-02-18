'use client';

export type WidgetInstance = {
  publicId: string;
  widgetType: string;
  displayName: string;
  workspaceId: string | null;
  source: 'workspace' | 'curated';
  actions: {
    edit: boolean;
    duplicate: boolean;
    delete: boolean;
  };
};

type RawWidgetInstance = {
  publicId?: string | null;
  widgetType?: string | null;
  displayName?: string | null;
  workspaceId?: string | null;
  source?: string | null;
  actions?: {
    edit?: boolean | null;
    duplicate?: boolean | null;
    delete?: boolean | null;
  } | null;
};

export type RomaWidgetsSnapshot = {
  accountId: string;
  workspaceId: string;
  widgetTypes: string[];
  instances: WidgetInstance[];
};

export const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';

export function normalizeWidgetType(value: string | null | undefined): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized || 'unknown';
}

export function normalizeWidgetInstance(raw: RawWidgetInstance): WidgetInstance | null {
  const publicId = String(raw.publicId || '').trim();
  if (!publicId) return null;

  const widgetType = normalizeWidgetType(raw.widgetType);
  const displayName = String(raw.displayName || '').trim() || DEFAULT_INSTANCE_DISPLAY_NAME;
  const workspaceId = String(raw.workspaceId || '').trim() || null;
  const source = raw.source === 'curated' ? 'curated' : 'workspace';
  const actions = raw.actions && typeof raw.actions === 'object' ? raw.actions : null;

  return {
    publicId,
    widgetType,
    displayName,
    workspaceId,
    source,
    actions: {
      edit: actions?.edit !== false,
      duplicate: actions?.duplicate !== false,
      delete: actions?.delete !== false,
    },
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

export function normalizeRomaWidgetsSnapshot(raw: unknown): RomaWidgetsSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const accountId = typeof record.accountId === 'string' ? record.accountId.trim() : '';
  const workspaceId = typeof record.workspaceId === 'string' ? record.workspaceId.trim() : '';
  if (!accountId || !workspaceId) return null;

  const instances = Array.isArray(record.instances)
    ? record.instances
        .map((item) => normalizeWidgetInstance((item || {}) as RawWidgetInstance))
        .filter((item): item is WidgetInstance => Boolean(item))
    : [];

  return {
    accountId,
    workspaceId,
    widgetTypes: normalizeWidgetTypeList(record.widgetTypes),
    instances,
  };
}

export function createUserInstancePublicId(widgetType: string): string {
  const normalized = widgetType
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const stem = normalized || 'instance';
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `wgt_${stem}_u_${suffix}`;
}

export function buildBuilderRoute(args: {
  publicId: string;
  workspaceId: string;
  accountId: string;
  widgetType?: string | null;
}): string {
  const search = new URLSearchParams({
    workspaceId: args.workspaceId,
    publicId: args.publicId,
    subject: 'workspace',
  });
  if (args.accountId) {
    search.set('accountId', args.accountId);
  }
  const normalizedWidgetType = normalizeWidgetType(args.widgetType);
  if (normalizedWidgetType !== 'unknown') {
    search.set('widgetType', normalizedWidgetType);
  }
  return `/builder/${encodeURIComponent(args.publicId)}?${search.toString()}`;
}
