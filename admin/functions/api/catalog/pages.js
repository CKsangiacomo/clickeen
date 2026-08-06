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
  const [templatesResult, sourcesResult] = await Promise.all([
    fetchRoma(context, session, '/api/account/page-templates'),
    fetchRoma(context, session, '/api/account/pages'),
  ]);
  for (const response of [templatesResult, sourcesResult]) {
    if (!response.ok) return forwardRomaResponse(response);
  }
  const [templatesJson, sourcesJson] = await Promise.all([
    readSuccessfulRomaJson(templatesResult),
    readSuccessfulRomaJson(sourcesResult),
  ]);
  if (!templatesJson.ok) return templatesJson.response;
  if (!sourcesJson.ok) return sourcesJson.response;
  const templateRows = templatesJson.payload?.templates;
  const sourceRows = sourcesJson.payload?.pages;
  if (
    templatesJson.payload?.accountId !== 'CLICKEEN' ||
    sourcesJson.payload?.accountId !== 'CLICKEEN' ||
    !Array.isArray(templateRows) ||
    !Array.isArray(sourceRows)
  ) return invalidUpstream('Roma Page catalog collection payload is invalid');
  const templates = templateRows.map((row) => {
    const catalogPresentation = readCatalogPresentation(row?.catalogPresentation);
    return row && typeof row.pageId === 'string' && typeof row.displayName === 'string' && catalogPresentation
      ? { templateId: row.pageId, templateName: row.displayName, catalogPresentation }
      : null;
  });
  const sources = sourceRows.map((row) => row?.source && typeof row.source.pageId === 'string' &&
    typeof row.source.displayName === 'string'
    ? { sourceId: row.source.pageId, displayName: row.source.displayName }
    : null);
  if (templates.some((row) => !row) || sources.some((row) => !row)) {
    return invalidUpstream('Roma Page catalog item is invalid');
  }
  return json({ templates, sources });
}

async function create(context, session) {
  const raw = await readExactJson(context.request, ['sourceId', 'templateName', 'catalogPresentation']);
  const payload = readTemplateCreatePayload(raw);
  if (!payload) return invalidPayload();
  return romaResponse(context, session, `/api/account/pages/${payload.sourceId}/save-as-template`, {
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
