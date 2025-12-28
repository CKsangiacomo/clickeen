import { NextResponse } from 'next/server';

export const runtime = 'edge';

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

async function generateFaqAnswer(args: { question: string; existingAnswer: string; instruction: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false as const,
      error: 'AI_NOT_CONFIGURED',
      message: 'Missing OPENAI_API_KEY',
    };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');

  const system = [
    'You write concise FAQ answers for an embeddable website FAQ widget.',
    'Output must be a single string suitable for direct insertion into the widget config.',
    'Allowed inline HTML tags: <strong>, <b>, <em>, <i>, <u>, <s>, <a>, <br>.',
    'Do not use any other HTML tags.',
    'If you include links, they must be absolute and start with https://.',
    'Keep it helpful, simple, and scannable (1–3 short sentences).',
  ].join('\n');

  const user = [
    `Question: ${args.question}`,
    args.existingAnswer ? `Existing answer: ${args.existingAnswer}` : '',
    args.instruction ? `Instruction: ${args.instruction}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      max_tokens: 220,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const details = await res.text().catch(() => '');
    return {
      ok: false as const,
      error: 'AI_UPSTREAM_ERROR',
      message: details || `Upstream error (${res.status})`,
    };
  }

  const data = (await res.json()) as any;
  const content = asTrimmedString(data?.choices?.[0]?.message?.content);
  if (!content) {
    return {
      ok: false as const,
      error: 'AI_EMPTY_RESPONSE',
      message: 'Model returned an empty response',
    };
  }

  return { ok: true as const, value: content };
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

    const generated = await generateFaqAnswer({ question, existingAnswer, instruction });
    if (!generated.ok) {
      return NextResponse.json(
        { error: generated.error, message: generated.message },
        { status: generated.error === 'AI_NOT_CONFIGURED' ? 503 : 502 }
      );
    }

    return NextResponse.json({
      ops: [{ op: 'set', path, value: generated.value }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'BAD_REQUEST', message }, { status: 400 });
  }
}
