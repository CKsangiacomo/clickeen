'use client';

export type RomaWidgetTemplate = {
  templateId: string;
  templateName: string;
  widgetType: string;
  widget: string;
  updatedAt: string;
};

export type RomaWidgetTemplatesResponse = {
  accountId: string;
  templates: RomaWidgetTemplate[];
};

type FetchJson = <T = unknown>(url: string, init?: RequestInit & { timeoutMs?: number }) => Promise<T>;

function normalizeTemplate(raw: unknown): RomaWidgetTemplate | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const templateId = typeof value.templateId === 'string' ? value.templateId.trim() : '';
  const templateName = typeof value.templateName === 'string' ? value.templateName.trim() : '';
  const widgetType = typeof value.widgetType === 'string' ? value.widgetType.trim() : '';
  const widget = typeof value.widget === 'string' ? value.widget.trim() : '';
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt.trim() : '';
  return templateId && templateName && widgetType && widget && updatedAt
    ? { templateId, templateName, widgetType, widget, updatedAt }
    : null;
}

export function normalizeRomaWidgetTemplatesResponse(raw: unknown): RomaWidgetTemplatesResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const accountId = typeof value.accountId === 'string' ? value.accountId.trim() : '';
  if (!accountId || !Array.isArray(value.templates)) return null;
  const templates = value.templates.map(normalizeTemplate);
  return templates.some((template) => !template)
    ? null
    : { accountId, templates: templates as RomaWidgetTemplate[] };
}

export async function loadRomaWidgetTemplates(args: {
  accountId: string;
  fetchJson: FetchJson;
}): Promise<RomaWidgetTemplatesResponse> {
  const accountId = args.accountId.trim();
  if (!accountId) throw new Error('coreui.errors.auth.contextUnavailable');
  const normalized = normalizeRomaWidgetTemplatesResponse(await args.fetchJson('/api/account/widget-templates'));
  if (!normalized || normalized.accountId !== accountId) throw new Error('coreui.errors.payload.invalid');
  return normalized;
}
