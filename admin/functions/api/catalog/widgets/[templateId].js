import { methodNotAllowed } from '../../../_shared/http.js';
import {
  invalidPayload,
  isCompactCatalogId,
  readExactJson,
  readPresentationPatchPayload,
} from '../../../_shared/catalog.js';
import { requireRomaCatalogTemplate, romaResponse, withRomaSession } from '../../../_shared/roma.js';

export async function onRequest(context) {
  return withRomaSession(context, async (session) => {
    const templateId = context.params.templateId;
    if (!isCompactCatalogId(templateId)) return invalidPayload();
    if (context.request.method === 'GET') {
      return romaResponse(context, session, `/api/account/widget-catalog/${templateId}`);
    }
    if (context.request.method === 'DELETE') {
      const invalidTarget = await requireRomaCatalogTemplate(
        context,
        session,
        `/api/account/widget-catalog/${templateId}`,
      );
      if (invalidTarget) return invalidTarget;
      return romaResponse(context, session, `/api/account/instances/${templateId}`, { method: 'DELETE' });
    }
    if (context.request.method === 'PATCH') {
      const raw = await readExactJson(context.request, ['catalogPresentation']);
      if (raw) {
        const payload = readPresentationPatchPayload(raw);
        if (!payload) return invalidPayload();
        return romaResponse(context, session, `/api/account/instances/${templateId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return invalidPayload();
    }
    return methodNotAllowed();
  });
}
