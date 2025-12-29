import { NextResponse } from 'next/server';

export const runtime = 'edge';

const PARIS_BASE_URL =
  process.env.PARIS_BASE_URL ||
  process.env.NEXT_PUBLIC_PARIS_URL ||
  'http://localhost:3001';

const SANFRANCISCO_BASE_URL =
  process.env.SANFRANCISCO_BASE_URL ||
  process.env.NEXT_PUBLIC_SANFRANCISCO_URL ||
  '';

const PARIS_DEV_JWT = process.env.PARIS_DEV_JWT;

type FaqAnswerRequest = {
  path: unknown;
  question: unknown;
  existingAnswer?: unknown;
  instruction?: unknown;
};

type RateLimitEntry = { count: number; resetAt: number };

const RATE_LIMIT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 20);
const rateLimit = new Map<string, RateLimitEntry>();

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function getClientKey(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0]?.trim();
  return ip || 'local';
}

function checkRateLimit(req: Request) {
  if (!Number.isFinite(RATE_LIMIT_WINDOW_MS) || !Number.isFinite(RATE_LIMIT_MAX)) return null;
  if (RATE_LIMIT_WINDOW_MS <= 0 || RATE_LIMIT_MAX <= 0) return null;

  const now = Date.now();
  const key = getClientKey(req);
  const current = rateLimit.get(key);
  if (!current || current.resetAt <= now) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    const retryAfterMs = Math.max(0, current.resetAt - now);
    return { retryAfterMs };
  }

  current.count += 1;
  rateLimit.set(key, current);
  return null;
}

async function getAiGrant(args: { trace?: { instancePublicId?: string } }) {
  const url = `${PARIS_BASE_URL.replace(/\/$/, '')}/api/ai/grant`;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (PARIS_DEV_JWT) headers['Authorization'] = `Bearer ${PARIS_DEV_JWT}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: 'editor.faq.answer.v1',
        mode: 'editor',
        ...(args.trace ? { trace: args.trace } : {}),
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false as const,
      error: 'AI_UPSTREAM_ERROR',
      message: `Grant request failed: ${message}`,
    };
  }

  if (!res.ok) {
    const details = await res.text().catch(() => '');
    return {
      ok: false as const,
      error: 'AI_UPSTREAM_ERROR',
      message: details || `Grant request failed (${res.status})`,
    };
  }

  const data = (await res.json().catch(() => null)) as any;
  const grant = asTrimmedString(data?.grant);
  if (!grant) {
    return {
      ok: false as const,
      error: 'AI_UPSTREAM_ERROR',
      message: 'Grant service returned an invalid response',
    };
  }

  return { ok: true as const, value: grant };
}

async function executeFaqAnswer(args: { grant: string; path: string; question: string; existingAnswer: string; instruction: string }) {
  const url = `${SANFRANCISCO_BASE_URL.replace(/\/$/, '')}/v1/execute`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant: args.grant,
        agentId: 'editor.faq.answer.v1',
        input: {
          path: args.path,
          question: args.question,
          existingAnswer: args.existingAnswer,
          instruction: args.instruction,
        },
        trace: { client: 'bob' },
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: 'AI_UPSTREAM_ERROR', message: `SanFrancisco request failed: ${message}` };
  }

  const text = await res.text().catch(() => '');
  const payload = safeJsonParse(text) as any;
  if (!res.ok) {
    const message =
      typeof payload?.error?.message === 'string'
        ? payload.error.message
        : typeof payload?.message === 'string'
          ? payload.message
          : text || `SanFrancisco error (${res.status})`;
    return { ok: false as const, error: 'AI_UPSTREAM_ERROR', message };
  }

  const ops = Array.isArray(payload?.result?.ops) ? payload.result.ops : null;
  if (!ops || ops.length === 0) {
    return { ok: false as const, error: 'AI_UPSTREAM_ERROR', message: 'AI returned no ops' };
  }

  return { ok: true as const, value: ops };
}

export async function POST(req: Request) {
  try {
    const limited = checkRateLimit(req);
    if (limited) {
      return NextResponse.json(
        {
          error: 'RATE_LIMIT',
          message: 'Too many requests. Please wait and try again.',
          retryAfterMs: limited.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const payload = (await req.json()) as FaqAnswerRequest;
    const path = asTrimmedString(payload.path);
    const question = asTrimmedString(payload.question);
    const existingAnswer = asTrimmedString(payload.existingAnswer);
    const instruction = asTrimmedString(payload.instruction);

    const issues: Array<{ path: string; message: string }> = [];
    if (!path) issues.push({ path: 'path', message: 'Path is required' });
    if (path && !/^sections\.\d+\.faqs\.\d+\.answer$/.test(path)) {
      issues.push({ path: 'path', message: 'Path must target an FAQ answer field' });
    }
    if (!question) issues.push({ path: 'question', message: 'Question is required' });
    if (issues.length) {
      return NextResponse.json({ error: 'VALIDATION', issues }, { status: 422 });
    }

    if (!SANFRANCISCO_BASE_URL) {
      return NextResponse.json(
        { error: 'AI_NOT_CONFIGURED', message: 'Missing SANFRANCISCO_BASE_URL' },
        { status: 503 }
      );
    }

    const grantRes = await getAiGrant({ trace: undefined });
    if (!grantRes.ok) {
      return NextResponse.json({ error: grantRes.error, message: grantRes.message }, { status: 502 });
    }

    const executed = await executeFaqAnswer({ grant: grantRes.value, path, question, existingAnswer, instruction });
    if (!executed.ok) {
      return NextResponse.json({ error: executed.error, message: executed.message }, { status: 502 });
    }

    return NextResponse.json({ ops: executed.value });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'BAD_REQUEST', message }, { status: 400 });
  }
}
