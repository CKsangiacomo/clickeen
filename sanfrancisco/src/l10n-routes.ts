import { HttpError, json, noStore, readJson, isRecord } from './http';
import { assertInternalAuth, asTrimmedString } from './internalAuth';
import { executePragueStringsTranslate, isPragueStringsJob } from './agents/l10nPragueStrings';
import { withInflightLimit } from './concurrency';
import type { Env } from './types';

export async function handlePragueStringsTranslate(request: Request, env: Env): Promise<Response> {
  return await withInflightLimit(async () => {
    const environment = asTrimmedString(env.ENVIRONMENT);
    if (environment !== 'local' && environment !== 'dev') {
      throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
    }

    assertInternalAuth(request, env);

    const body = await readJson(request);
    const payload = isRecord(body) && isRecord((body as any).job) ? (body as any).job : body;
    if (!isPragueStringsJob(payload)) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid l10n translate job' });
    }

    const result = await executePragueStringsTranslate(payload, env);
    return noStore(json(result));
  });
}
