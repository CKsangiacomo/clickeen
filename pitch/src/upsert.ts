import type { Env } from './types';
import { HttpError, isRecord } from './http';
import { embedText } from './embed';

type UpsertItem = {
  id: string;
  text: string;
  title?: string;
  section?: string | null;
  url?: string | null;
};

export async function handlePitchUpsert(request: Request, env: Env): Promise<Response> {
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key');
  if (!env.PITCH_SERVICE_KEY) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'pitch', message: 'Missing PITCH_SERVICE_KEY' });
  }
  if (!apiKey || apiKey !== env.PITCH_SERVICE_KEY) {
    throw new HttpError(401, { code: 'CAPABILITY_DENIED', message: 'Unauthorized' });
  }
  if (!env.OPENAI_API_KEY) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Missing OPENAI_API_KEY' });
  }
  if (!env.PITCH_DOCS) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'vectorize', message: 'Missing PITCH_DOCS binding' });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(body) || !Array.isArray((body as any).items)) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid body (expected { items: [...] })' });
  }
  const items = (body as any).items as UpsertItem[];
  if (!items.length) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'No items' });

  const vectors = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (!item.id || !item.text) continue;
    const values = await embedText(env.OPENAI_API_KEY, item.text);
    vectors.push({
      id: item.id,
      values,
      metadata: {
        text: String(item.text).slice(0, 10000),
        title: item.title ? String(item.title) : '',
        section: item.section ? String(item.section) : null,
        url: item.url ? String(item.url) : null,
      },
    });
  }

  await env.PITCH_DOCS.upsert(vectors);
  return Response.json({ upserted: vectors.length });
}


