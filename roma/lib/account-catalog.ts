import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import { parseCatalogPresentation, type CatalogPresentation } from '@clickeen/ck-contracts/catalog';
import type { AccountPageTemplate } from '@clickeen/ck-contracts/pages';
import { parseAccountPageSource } from './account-page-contract';
import { callTokyo } from './tokyo-client';

export type WidgetCatalogListItem = {
  templateId: string;
  templateName: string;
  widgetType: string;
  updatedAt: string;
  catalogPresentation: CatalogPresentation;
};

export type WidgetCatalogTemplate = WidgetCatalogListItem & {
  isTemplate: true;
  source: { config: Record<string, unknown>; content: Record<string, unknown> };
  publicPackage: { indexHtml: string; stylesCss: string; runtimeJs: string };
};

export type PageCatalogListItem = {
  pageId: string;
  displayName: string;
  catalogPresentation: CatalogPresentation;
};

export type PageCatalogTemplate = {
  source: AccountPageTemplate;
  files: { indexHtml: string; stylesCss: string; runtimeJs: string };
};

type CatalogContext = { accountId: string; accountCapsule: string; requestId?: string | null };

function decodeFiles(raw: unknown) {
  if (!isRecord(raw) || typeof raw.indexHtml !== 'string' || typeof raw.stylesCss !== 'string' || typeof raw.runtimeJs !== 'string') return null;
  return { indexHtml: raw.indexHtml, stylesCss: raw.stylesCss, runtimeJs: raw.runtimeJs };
}

function decodeWidgetListItem(raw: unknown): WidgetCatalogListItem | null {
  if (!isRecord(raw)) return null;
  const templateId = asTrimmedString(raw.templateId);
  const templateName = asTrimmedString(raw.templateName);
  const widgetType = asTrimmedString(raw.widgetType);
  const updatedAt = asTrimmedString(raw.updatedAt);
  const catalogPresentation = parseCatalogPresentation(raw.catalogPresentation);
  return templateId && templateName && widgetType && updatedAt && catalogPresentation
    ? { templateId, templateName, widgetType, updatedAt, catalogPresentation }
    : null;
}

export function decodeWidgetCatalogTemplate(raw: unknown): WidgetCatalogTemplate | null {
  if (!isRecord(raw) || raw.isTemplate !== true || !isRecord(raw.source) || !isRecord(raw.source.config) || !isRecord(raw.source.content)) return null;
  const item = decodeWidgetListItem(raw);
  const publicPackage = decodeFiles(raw.publicPackage);
  return item && publicPackage
    ? { ...item, isTemplate: true, source: { config: raw.source.config, content: raw.source.content }, publicPackage }
    : null;
}

function decodePageListItem(raw: unknown): PageCatalogListItem | null {
  if (!isRecord(raw)) return null;
  const pageId = asTrimmedString(raw.pageId);
  const displayName = asTrimmedString(raw.displayName);
  const catalogPresentation = parseCatalogPresentation(raw.catalogPresentation);
  return pageId && displayName && catalogPresentation ? { pageId, displayName, catalogPresentation } : null;
}

export function decodePageCatalogTemplate(raw: unknown): PageCatalogTemplate | null {
  if (!isRecord(raw)) return null;
  const source = parseAccountPageSource(raw.source);
  const files = decodeFiles(raw.files);
  return source?.isTemplate && source.catalogPresentation && files ? { source, files } : null;
}

function invalidCatalogPayload(detail: string) {
  return { ok: false as const, status: 502, error: { kind: 'UPSTREAM_UNAVAILABLE' as const, reasonKey: 'coreui.errors.payload.invalid', detail } };
}

export async function listWidgetCatalog(args: CatalogContext) {
  const result = await callTokyo(args, { path: '/__internal/catalog/widgets', method: 'GET', decode: (value) => value, errorKey: 'coreui.errors.db.readFailed', errorDetail: 'tokyo_widget_catalog_list_http_error' });
  if (!result.ok) return result;
  if (!isRecord(result.value) || !Array.isArray(result.value.templates)) return invalidCatalogPayload('invalid Widget Catalog payload');
  const templates = result.value.templates.map(decodeWidgetListItem);
  return templates.some((entry) => !entry) ? invalidCatalogPayload('invalid Widget Catalog item') : { ok: true as const, value: { templates: templates as WidgetCatalogListItem[] } };
}

export async function readWidgetCatalogTemplate(args: CatalogContext & { templateId: string }) {
  const result = await callTokyo(args, { path: `/__internal/catalog/widgets/${encodeURIComponent(args.templateId)}`, method: 'GET', decode: (value) => value, errorKey: 'coreui.errors.db.readFailed', errorDetail: 'tokyo_widget_catalog_read_http_error' });
  if (!result.ok) return result;
  const template = isRecord(result.value) ? decodeWidgetCatalogTemplate(result.value.template) : null;
  return template ? { ok: true as const, value: { template } } : invalidCatalogPayload('invalid Widget Catalog template');
}

export async function listPageCatalog(args: CatalogContext) {
  const result = await callTokyo(args, { path: '/__internal/catalog/pages', method: 'GET', decode: (value) => value, errorKey: 'coreui.errors.db.readFailed', errorDetail: 'tokyo_page_catalog_list_http_error' });
  if (!result.ok) return result;
  if (!isRecord(result.value) || !Array.isArray(result.value.templates)) return invalidCatalogPayload('invalid Page Catalog payload');
  const templates = result.value.templates.map(decodePageListItem);
  return templates.some((entry) => !entry) ? invalidCatalogPayload('invalid Page Catalog item') : { ok: true as const, value: { templates: templates as PageCatalogListItem[] } };
}

export async function readPageCatalogTemplate(args: CatalogContext & { pageId: string }) {
  const result = await callTokyo(args, { path: `/__internal/catalog/pages/${encodeURIComponent(args.pageId)}`, method: 'GET', decode: (value) => value, errorKey: 'coreui.errors.db.readFailed', errorDetail: 'tokyo_page_catalog_read_http_error' });
  if (!result.ok) return result;
  const template = isRecord(result.value) ? decodePageCatalogTemplate(result.value.template) : null;
  return template ? { ok: true as const, value: { template } } : invalidCatalogPayload('invalid Page Catalog template');
}
