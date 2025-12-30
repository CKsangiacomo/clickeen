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

type RateLimitEntry = { count: number; resetAt: number };

const RATE_LIMIT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 30);
const rateLimit = new Map<string, RateLimitEntry>();

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function looksLikeHtml(text: string): boolean {
  const s = (text || '').trim().slice(0, 2000).toLowerCase();
  if (!s) return false;
  return (
    s.startsWith('<!doctype html') ||
    s.startsWith('<html') ||
    s.includes('<html') ||
    s.includes('id="cf-wrapper"') ||
    s.includes("id='cf-wrapper'") ||
    s.includes('cloudflare.com/5xx-error-landing')
  );
}

function summarizeUpstreamError(args: { serviceName: string; baseUrl: string; status: number; bodyText: string }): string {
  const base = args.baseUrl ? args.baseUrl.replace(/\/$/, '') : '(missing)';
  if (looksLikeHtml(args.bodyText)) {
    return `${args.serviceName} returned an HTML error page (HTTP ${args.status}). This usually means ${args.serviceName} is down or ${args.serviceName.toLowerCase()} base URL is misconfigured. Check that ${args.serviceName.toUpperCase()}_BASE_URL points to the correct service (currently: ${base}).`;
  }
  return args.bodyText || `${args.serviceName} error (${args.status})`;
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

async function getAiGrant(args: {
  agentId: string;
  mode: 'editor' | 'ops';
  sessionId: string;
  instancePublicId?: string;
  budgets?: { maxTokens?: number; timeoutMs?: number; maxRequests?: number };
}) {
  const url = `${PARIS_BASE_URL.replace(/\/$/, '')}/api/ai/grant`;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (PARIS_DEV_JWT) headers['Authorization'] = `Bearer ${PARIS_DEV_JWT}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: args.agentId,
        mode: args.mode,
        trace: { sessionId: args.sessionId, ...(args.instancePublicId ? { instancePublicId: args.instancePublicId } : {}) },
        budgets: args.budgets,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: 'AI_UPSTREAM_ERROR', message: `Grant request failed: ${message}` };
  }

  const text = await res.text().catch(() => '');
  const payload = safeJsonParse(text) as any;
  if (!res.ok) {
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : looksLikeHtml(text)
          ? `Paris returned an HTML error page (HTTP ${res.status}). Check PARIS_BASE_URL (currently: ${PARIS_BASE_URL.replace(/\/$/, '')}).`
          : text || `Grant request failed (${res.status})`;
    return { ok: false as const, error: 'AI_UPSTREAM_ERROR', message };
  }

  const grant = asTrimmedString(payload?.grant);
  if (!grant) return { ok: false as const, error: 'AI_UPSTREAM_ERROR', message: 'Grant service returned an invalid response' };
  return { ok: true as const, value: grant };
}

async function executeOnSanFrancisco(args: { grant: string; agentId: string; input: unknown }) {
  const url = `${SANFRANCISCO_BASE_URL.replace(/\/$/, '')}/v1/execute`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant: args.grant,
        agentId: args.agentId,
        input: args.input,
        trace: { client: 'minibob' },
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
          : summarizeUpstreamError({ serviceName: 'SanFrancisco', baseUrl: SANFRANCISCO_BASE_URL, status: res.status, bodyText: text });
    return { ok: false as const, error: 'AI_UPSTREAM_ERROR', message };
  }

  return { ok: true as const, value: payload?.result };
}

export async function POST(req: Request) {
  try {
    if (!SANFRANCISCO_BASE_URL) {
      return NextResponse.json({ error: 'AI_NOT_CONFIGURED', message: 'Missing SANFRANCISCO_BASE_URL' }, { status: 503 });
    }

    const limited = checkRateLimit(req);
    if (limited) {
      return NextResponse.json(
        { error: 'RATE_LIMIT', message: 'Too many requests. Please wait and try again.', retryAfterMs: limited.retryAfterMs },
        { status: 429 },
      );
    }

    const body = (await req.json().catch(() => null)) as any;
    const prompt = asTrimmedString(body?.prompt);
    const widgetType = asTrimmedString(body?.widgetType);
    const sessionId = asTrimmedString(body?.sessionId);
    const instancePublicId = asTrimmedString(body?.instancePublicId) || undefined;
    const currentConfig = body?.currentConfig;
    const controls = body?.controls;

    const issues: Array<{ path: string; message: string }> = [];
    if (!prompt) issues.push({ path: 'prompt', message: 'prompt is required' });
    if (!widgetType) issues.push({ path: 'widgetType', message: 'widgetType is required' });
    if (!sessionId) issues.push({ path: 'sessionId', message: 'sessionId is required' });
    if (!isRecord(currentConfig)) issues.push({ path: 'currentConfig', message: 'currentConfig must be an object' });
    if (!Array.isArray(controls)) issues.push({ path: 'controls', message: 'controls must be an array' });
    if (issues.length) return NextResponse.json({ error: 'VALIDATION', issues }, { status: 422 });

    const agentId = 'sdr.widget.copilot.v1';
    const grantRes = await getAiGrant({
      agentId,
      mode: 'ops',
      sessionId,
      instancePublicId,
      budgets: { maxTokens: 420, timeoutMs: 15_000, maxRequests: 1 },
    });
    if (!grantRes.ok) return NextResponse.json({ error: grantRes.error, message: grantRes.message }, { status: 502 });

    const executed = await executeOnSanFrancisco({
      grant: grantRes.value,
      agentId,
      input: {
        prompt,
        widgetType,
        currentConfig,
        controls,
        sessionId,
      },
    });
    if (!executed.ok) return NextResponse.json({ error: executed.error, message: executed.message }, { status: 502 });

    return NextResponse.json(executed.value ?? null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'BAD_REQUEST', message }, { status: 400 });
  }
}
