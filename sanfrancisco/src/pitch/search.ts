import type { Env } from '../types';
import { HttpError, asString } from '../http';
import { embedText } from './embed';

type PitchSearchItem = {
  text: string;
  title: string;
  url: string | null;
  section: string | null;
  source_id: string;
  score: number;
};

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
  const index = (env as any).PITCH_DOCS;
  if (!index) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'vectorize', message: 'Missing PITCH_DOCS binding' });
  }

  const vector = await embedText(env.OPENAI_API_KEY, query);
  const results = await index.query(vector, { topK, returnMetadata: true });
  const items: PitchSearchItem[] = (results?.matches ?? []).map((m: any) => ({
    text: String(m?.metadata?.text ?? ''),
    title: String(m?.metadata?.title ?? ''),
    url: m?.metadata?.url ? String(m.metadata.url) : null,
    section: m?.metadata?.section ? String(m.metadata.section) : null,
    source_id: String(m?.id ?? ''),
    score: Number(m?.score ?? 0),
  }));

  return Response.json({ items });
}


