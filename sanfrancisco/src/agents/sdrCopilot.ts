import type { AIGrant, Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';
import { getGrantMaxTokens, getGrantTimeoutMs } from '../grants';
import { callChatCompletion } from '../ai/chat';

type SdrInput = {
  sessionId: string;
  message: string;
};

export type SdrResult = {
  message: string;
  cta?: { kind: 'signup'; label: string; href: string };
  next: 'continue' | 'end';
};

type SdrSession = {
  sessionId: string;
  createdAtMs: number;
  lastActiveAtMs: number;
  turns: Array<{ role: 'user' | 'assistant'; content: string }>;
};

function parseSdrInput(input: unknown): SdrInput {
  if (!isRecord(input)) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues: [{ path: 'input', message: 'Expected an object' }] });
  const sessionId = asString(input.sessionId);
  const message = asString(input.message);
  const issues: Array<{ path: string; message: string }> = [];
  if (!sessionId) issues.push({ path: 'input.sessionId', message: 'Missing required value' });
  if (!message) issues.push({ path: 'input.message', message: 'Missing required value' });
  if (issues.length) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues });
  return { sessionId: sessionId as string, message: message as string };
}

function parseSdrResult(raw: string, provider: string): SdrResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model did not return valid JSON' });
  }

  if (!isRecord(parsed)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output must be an object' });
  const message = asString(parsed.message);
  const next = asString(parsed.next);
  if (!message) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output missing message' });
  if (next !== 'continue' && next !== 'end') throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output next must be continue|end' });

  const ctaRaw = parsed.cta;
  let cta: SdrResult['cta'];
  if (ctaRaw !== undefined) {
    if (!isRecord(ctaRaw)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output cta must be an object' });
    const kind = asString(ctaRaw.kind);
    const label = asString(ctaRaw.label);
    const href = asString(ctaRaw.href);
    if (kind !== 'signup' || !label || !href) {
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Model output cta must be { kind:\"signup\", label, href }' });
    }
    cta = { kind, label, href };
  }

  return { message, next, ...(cta ? { cta } : {}) };
}

async function getSession(env: Env, sessionId: string): Promise<SdrSession> {
  const key = `sdr:session:${sessionId}`;
  const existing = await env.SF_KV.get(key, 'json');
  if (!existing) {
    const now = Date.now();
    return { sessionId, createdAtMs: now, lastActiveAtMs: now, turns: [] };
  }
  if (!isRecord(existing)) throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Session store is corrupted' });
  const turns = Array.isArray(existing.turns) ? existing.turns : null;
  if (!turns) throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Session store is corrupted' });
  return existing as SdrSession;
}

async function putSession(env: Env, session: SdrSession): Promise<void> {
  const key = `sdr:session:${session.sessionId}`;
  await env.SF_KV.put(key, JSON.stringify(session), { expirationTtl: 60 * 60 * 24 });
}

export async function executeSdrCopilot(params: { grant: AIGrant; input: unknown }, env: Env): Promise<{ result: SdrResult; usage: Usage }> {
  const { grant } = params;
  const input = parseSdrInput(params.input);

  const session = await getSession(env, input.sessionId);
  const maxTokens = getGrantMaxTokens(grant);
  const timeoutMs = getGrantTimeoutMs(grant);

  const system = [
    'You are Clickeen SDR Copilot for a public website chat.',
    'Be concise, clear, and helpful. One short paragraph max.',
    'If relevant, encourage signup to unlock the full editor and copilots.',
    'Return ONLY a JSON object matching this TypeScript type:',
    '{ message: string; cta?: { kind:\"signup\"; label: string; href: string }; next: \"continue\"|\"end\" }',
  ].join('\n');

  const messages = [
    { role: 'system', content: system },
    ...session.turns,
    { role: 'user', content: input.message },
  ];

  const { content, usage } = await callChatCompletion({
    env,
    grant,
    agentId: 'sdr.copilot',
    messages,
    temperature: 0.2,
    maxTokens,
    timeoutMs,
  });
  const result = parseSdrResult(content, usage.provider);

  session.lastActiveAtMs = Date.now();
  const nextTurns: SdrSession['turns'] = [
    ...session.turns,
    { role: 'user', content: input.message },
    { role: 'assistant', content: result.message },
  ];
  session.turns = nextTurns.slice(-10);
  await putSession(env, session);

  return { result, usage };
}
