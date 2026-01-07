import type { Env } from './types';
import { HttpError, asString, isRecord } from './http';
import { embedText } from './embed';

type PitchCitation = {
  source_id: string;
  title?: string;
  url?: string | null;
  section?: string | null;
  score?: number;
};

type PitchMatch = {
  source_id: string;
  score: number;
  title: string;
  url: string | null;
  section: string | null;
  text: string;
};

function extractResponsesOutputText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text) return data.output_text;
  if (Array.isArray(data?.output)) {
    const joined = data.output
      .flatMap((o: any) => (Array.isArray(o?.content) ? o.content : []))
      .filter((c: any) => c && c.type === 'output_text' && typeof c.text === 'string')
      .map((c: any) => c.text)
      .join('');
    if (joined) return joined;
  }
  return '';
}

async function openaiAnswerFromSources(args: { env: Env; model: string; locale?: string; question: string; sources: PitchMatch[] }) {
  const apiKey = args.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Missing OPENAI_API_KEY' });

  const payload = {
    model: args.model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'You are Clickeen Pitch Agent. You must be strictly retrieval-only.\n' +
              '- Use ONLY the provided sources.\n' +
              '- If sources are insufficient, say so and ask one clarifying question.\n' +
              '- Be short, clear, founder voice.\n' +
              '- Return JSON only, matching the schema.\n',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify(
              {
                question: args.question,
                locale: args.locale ?? 'en',
                sources: args.sources.map((s) => ({
                  source_id: s.source_id,
                  title: s.title,
                  url: s.url,
                  section: s.section,
                  score: s.score,
                  text: s.text,
                })),
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'pitch_answer',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            answer: { type: 'string' },
            citations: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  source_id: { type: 'string' },
                },
                required: ['source_id'],
              },
            },
          },
          required: ['answer', 'citations'],
        },
      },
    },
  };

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: `Upstream error (${res.status}) ${body}`.trim() });
  }
  const data = await res.json();
  const text = extractResponsesOutputText(data);
  if (!text) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Empty model response' });
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Model did not return valid JSON' });
  }
  if (!isRecord(parsed)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Model output must be an object' });
  const answer = asString(parsed.answer);
  const citationsRaw = Array.isArray((parsed as any).citations) ? (parsed as any).citations : [];
  const citations = citationsRaw
    .map((c: any) => ({ source_id: asString(c?.source_id) }))
    .filter((c: any) => c.source_id)
    .map((c: any) => ({ source_id: c.source_id as string }));
  if (!answer) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Model output missing answer' });
  return { answer, citations };
}

export async function handlePitchAnswer(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const question = asString(url.searchParams.get('query')) || '';
  const locale = asString(url.searchParams.get('locale')) || 'en';
  const topKRaw = asString(url.searchParams.get('top_k')) || '6';
  const topK = Math.min(Math.max(parseInt(topKRaw, 10) || 6, 1), 10);

  if (!question.trim()) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing query' });
  if (!env.OPENAI_API_KEY) throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Missing OPENAI_API_KEY' });
  if (!env.PITCH_DOCS) throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'vectorize', message: 'Missing PITCH_DOCS binding' });

  const vector = await embedText(env.OPENAI_API_KEY, question);
  const results = await env.PITCH_DOCS.query(vector, { topK, returnMetadata: true });
  const matches: PitchMatch[] = (results?.matches ?? []).map((m: any) => ({
    source_id: String(m?.id ?? ''),
    score: Number(m?.score ?? 0),
    title: String(m?.metadata?.title ?? ''),
    url: m?.metadata?.url ? String(m.metadata.url) : null,
    section: m?.metadata?.section ? String(m.metadata.section) : null,
    text: String(m?.metadata?.text ?? ''),
  }));

  const model = env.PITCH_MODEL || 'gpt-5.2';
  const { answer, citations } = await openaiAnswerFromSources({ env, model, locale, question, sources: matches });

  const byId = new Map<string, PitchMatch>(matches.map((m) => [m.source_id, m]));
  const hydrated: PitchCitation[] = citations.map((c: { source_id: string }) => {
    const m = byId.get(c.source_id);
    return {
      source_id: c.source_id,
      title: m?.title || undefined,
      url: m?.url ?? null,
      section: m?.section ?? null,
      score: m?.score ?? undefined,
    };
  });

  // Log conversation to console (viewable in Cloudflare dashboard → Workers → Logs)
  console.log(JSON.stringify({
    type: 'pitch_conversation',
    ts: Date.now(),
    question,
    answer,
    locale,
    sources: citations.map((c) => c.source_id),
    model,
    country: request.headers.get('CF-IPCountry') || 'unknown',
  }));

  return Response.json({ answer, citations: hydrated });
}


