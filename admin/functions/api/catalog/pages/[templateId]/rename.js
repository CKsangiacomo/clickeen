import { methodNotAllowed } from '../../../../_shared/http.js';
import {
  invalidPayload,
  isCompactCatalogId,
  readExactJson,
  readRenamePayload,
} from '../../../../_shared/catalog.js';
import { requireRomaCatalogTemplate, romaResponse, withRomaSession } from '../../../../_shared/roma.js';

export async function onRequest(context) {
  return withRomaSession(context, async (session) => {
    if (context.request.method !== 'POST') return methodNotAllowed();
    const templateId = context.params.templateId;
    if (!isCompactCatalogId(templateId)) return invalidPayload();
    const raw = await readExactJson(context.request, ['displayName']);
    const payload = readRenamePayload(raw);
    if (!payload) return invalidPayload();
    const invalidTarget = await requireRomaCatalogTemplate(
      context,
      session,
      `/api/account/page-catalog/${templateId}`,
    );
    if (invalidTarget) return invalidTarget;
    return romaResponse(context, session, `/api/account/pages/${templateId}/rename`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });
}
