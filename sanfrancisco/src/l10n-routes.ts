import { HttpError, asTrimmedString, json, noStore } from './http';
import { verifyBodySignature } from './signatures';
import { executePragueStringsTranslate, isPragueStringsTranslationRequest } from './agents/l10nPragueStrings';
import { withInflightLimit } from './concurrency';
import type { Env } from './types';

export async function handlePragueStringsTranslate(request: Request, env: Env): Promise<Response> {
  return await withInflightLimit(async () => {
    const environment = asTrimmedString(env.ENVIRONMENT);
    if (environment !== 'local' && environment !== 'dev') {
      throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
    }

    const bodyText = await request.text();
    await verifyBodySignature({
      signature: request.headers.get('x-clickeen-signature'),
      secret: env.AI_GRANT_HMAC_SECRET,
      message: `prague-l10n.v1.${bodyText}`,
      missingSecretMessage: 'Missing AI_GRANT_HMAC_SECRET',
    });

    let body: unknown;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
    }
    if (!isPragueStringsTranslationRequest(body)) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid Prague translation request' });
    }

    const result = await executePragueStringsTranslate(body, env);
    return noStore(json(result));
  });
}
