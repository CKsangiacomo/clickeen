import { json, methodNotAllowed } from '../../_shared/http.js';
import {
  forwardRomaResponse,
  invalidPayload,
  invalidUpstream,
  readCatalogPresentation,
  readExactJson,
  readSuccessfulRomaJson,
  readTemplateCreatePayload,
} from '../../_shared/catalog.js';
import { fetchRoma, romaResponse, withRomaSession } from '../../_shared/roma.js';

async function list(context, session) {
  const [templatesResult, sourcesResult, defaultsResult] = await Promise.all([
    fetchRoma(context, session, '/api/account/widget-templates'),
    fetchRoma(context, session, '/api/account/widgets'),
    fetchRoma(context, session, '/api/account/widget-defaults'),
  ]);
  for (const response of [templatesResult, sourcesResult, defaultsResult]) {
    if (!response.ok) return forwardRomaResponse(response);
  }
  const [templatesJson, sourcesJson, defaultsJson] = await Promise.all([
    readSuccessfulRomaJson(templatesResult),
    readSuccessfulRomaJson(sourcesResult),
    readSuccessfulRomaJson(defaultsResult),
  ]);
  if (!templatesJson.ok) return templatesJson.response;
  if (!sourcesJson.ok) return sourcesJson.response;
  if (!defaultsJson.ok) return defaultsJson.response;
  const templateRows = templatesJson.payload?.templates;
  const sourceRows = sourcesJson.payload?.instances;
  const widgets = defaultsJson.payload?.widgetDefaults?.widgets;
  if (
    templatesJson.payload?.accountId !== 'CLICKEEN' ||
    sourcesJson.payload?.accountId !== 'CLICKEEN' ||
    defaultsJson.payload?.accountId !== 'CLICKEEN' ||
    !Array.isArray(templateRows) ||
    !Array.isArray(sourceRows) ||
    !widgets ||
    typeof widgets !== 'object' ||
    Array.isArray(widgets)
  ) return invalidUpstream('Roma Widget catalog collection payload is invalid');
  const templates = templateRows.map((row) => {
    const catalogPresentation = readCatalogPresentation(row?.catalogPresentation);
    return row && typeof row.templateId === 'string' && typeof row.templateName === 'string' &&
      typeof row.widgetType === 'string' && catalogPresentation
      ? { templateId: row.templateId, templateName: row.templateName, widgetType: row.widgetType, catalogPresentation }
      : null;
  });
  const sources = sourceRows.map((row) => row && typeof row.instanceId === 'string' &&
    typeof row.displayName === 'string' && typeof row.widgetType === 'string' && typeof row.widget === 'string'
    ? { sourceId: row.instanceId, displayName: row.displayName, widgetType: row.widgetType, widget: row.widget }
    : null);
  if (templates.some((row) => !row) || sources.some((row) => !row)) {
    return invalidUpstream('Roma Widget catalog item is invalid');
  }
  return json({ templates, sources, widgetTypes: Object.keys(widgets).sort() });
}

async function create(context, session) {
  const raw = await readExactJson(context.request, ['sourceId', 'templateName', 'catalogPresentation']);
  const payload = readTemplateCreatePayload(raw);
  if (!payload) return invalidPayload();
  return romaResponse(context, session, `/api/account/instances/${payload.sourceId}/save-as-template`, {
    method: 'POST',
    body: JSON.stringify({ templateName: payload.templateName, catalogPresentation: payload.catalogPresentation }),
  });
}

export async function onRequest(context) {
  return withRomaSession(context, (session) => {
    if (context.request.method === 'GET') return list(context, session);
    if (context.request.method === 'POST') return create(context, session);
    return methodNotAllowed();
  });
}
