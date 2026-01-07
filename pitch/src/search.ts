import type { Env } from './types';
import { HttpError, asString } from './http';
import { embedText } from './embed';

export async function handlePitchSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = asString(url.searchParams.get('query')) || '';
  const topKRaw = asString(url.searchParams.get('top_k')) || '6';
  const topK = Math.min(Math.max(parseInt(topKRaw, 10) || 6, 1), 10);

  if (!query.trim()) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing query' });
  }
  if (!env.OPENAI_API_KEY) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Missing OPENAI_API_KEY' });
  }
  if (!env.PITCH_DOCS) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'vectorize', message: 'Missing PITCH_DOCS binding' });
  }

  const vector = await embedText(env.OPENAI_API_KEY, query);
  const results = await env.PITCH_DOCS.query(vector, { topK, returnMetadata: true });
  const items = (results?.matches ?? []).map((m: any) => ({
    text: String(m?.metadata?.text ?? ''),
    title: String(m?.metadata?.title ?? ''),
    url: m?.metadata?.url ? String(m.metadata.url) : null,
    section: m?.metadata?.section ? String(m.metadata.section) : null,
    source_id: String(m?.id ?? ''),
    score: Number(m?.score ?? 0),
  }));

  return Response.json({ items });
}


