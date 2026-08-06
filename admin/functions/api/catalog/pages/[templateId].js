import { json, methodNotAllowed } from '../../../_shared/http.js';
import {
  forwardRomaResponse,
  invalidPayload,
  invalidUpstream,
  isCompactCatalogId,
  readCatalogPresentation,
  readExactJson,
  readPresentationPatchPayload,
  readSuccessfulRomaJson,
} from '../../../_shared/catalog.js';
import { fetchRoma, requireRomaCatalogTemplate, romaResponse, withRomaSession } from '../../../_shared/roma.js';

async function open(context, session, templateId) {
  const result = await readSuccessfulRomaJson(
    await fetchRoma(context, session, `/api/account/page-catalog/${templateId}`),
  );
  if (!result.ok) return forwardRomaResponse(result.response);
  const source = result.payload?.template?.source;
  const files = result.payload?.template?.files;
  const catalogPresentation = readCatalogPresentation(source?.catalogPresentation);
  if (
    !source || source.isTemplate !== true || source.pageId !== templateId ||
    typeof source.displayName !== 'string' || !catalogPresentation ||
    !files || typeof files.indexHtml !== 'string' || typeof files.stylesCss !== 'string' ||
    typeof files.runtimeJs !== 'string'
  ) return invalidUpstream('Roma Page catalog template is invalid');
  return json({
    template: {
      templateId: source.pageId,
      templateName: source.displayName,
      catalogPresentation,
      source,
      files,
    },
  });
}

export async function onRequest(context) {
  return withRomaSession(context, async (session) => {
    const templateId = context.params.templateId;
    if (!isCompactCatalogId(templateId)) return invalidPayload();
    if (context.request.method === 'GET') {
      return open(context, session, templateId);
    }
    if (context.request.method === 'DELETE') {
      const invalidTarget = await requireRomaCatalogTemplate(
        context,
        session,
        `/api/account/page-catalog/${templateId}`,
      );
      if (invalidTarget) return invalidTarget;
      return romaResponse(context, session, `/api/account/pages/${templateId}`, { method: 'DELETE' });
    }
    if (context.request.method === 'PATCH') {
      const raw = await readExactJson(context.request, ['catalogPresentation']);
      const payload = readPresentationPatchPayload(raw);
      if (!payload) return invalidPayload();
      return romaResponse(context, session, `/api/account/pages/${templateId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    }
    return methodNotAllowed();
  });
}
