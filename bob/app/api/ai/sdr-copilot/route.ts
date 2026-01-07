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

type UrlResolution = { baseUrl: string; resolvedAtMs: number; source: 'env' | 'fallback' };

const SANFRANCISCO_FALLBACKS =
  process.env.NODE_ENV === 'development'
    ? ['http://localhost:3002', 'http://localhost:8787', 'https://sanfrancisco.dev.clickeen.com']
    : ['https://sanfrancisco.dev.clickeen.com'];

let cachedSanFrancisco: UrlResolution | null = null;

function uniqStrings(values: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) continue;
    const normalized = s.replace(/\/+$/, '');
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

async function probeHealthz(baseUrl: string, timeoutMs = 800): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/healthz`, {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'application/json, text/plain;q=0.9, */*;q=0.1' },
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) return false;
    if (looksLikeHtml(text)) return false;
    const parsed = safeJsonParse(text) as any;
    if (parsed && typeof parsed === 'object' && parsed.ok === true) return true;
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveSanFranciscoBaseUrl(): Promise<UrlResolution | null> {
  const now = Date.now();
  if (cachedSanFrancisco && now - cachedSanFrancisco.resolvedAtMs < 5 * 60_000) return cachedSanFrancisco;

  const envNormalized = (SANFRANCISCO_BASE_URL || '').trim().replace(/\/+$/, '');
  const candidates = uniqStrings([SANFRANCISCO_BASE_URL, ...SANFRANCISCO_FALLBACKS]);

  for (const baseUrl of candidates) {
    if (await probeHealthz(baseUrl)) {
      cachedSanFrancisco = { baseUrl, resolvedAtMs: now, source: baseUrl === envNormalized ? 'env' : 'fallback' };
      return cachedSanFrancisco;
    }
  }

  return null;
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
    let message =
      typeof payload?.message === 'string'
        ? payload.message
        : looksLikeHtml(text)
          ? `Paris returned an HTML error page (HTTP ${res.status}). Check PARIS_BASE_URL (currently: ${PARIS_BASE_URL.replace(/\/$/, '')}).`
          : text || `Grant request failed (${res.status})`;
    if (looksLikeHtml(message)) {
      message = summarizeUpstreamError({ serviceName: 'Paris', baseUrl: PARIS_BASE_URL, status: res.status, bodyText: message });
    }
    return { ok: false as const, error: 'AI_UPSTREAM_ERROR', message };
  }

  const grant = asTrimmedString(payload?.grant);
  if (!grant) return { ok: false as const, error: 'AI_UPSTREAM_ERROR', message: 'Grant service returned an invalid response' };
  return { ok: true as const, value: grant };
}

async function executeOnSanFrancisco(args: { grant: string; agentId: string; input: unknown }) {
  const resolved = await resolveSanFranciscoBaseUrl();
  if (!resolved) return { ok: false as const, error: 'AI_NOT_CONFIGURED', message: 'SanFrancisco is not reachable' };

  const url = `${resolved.baseUrl.replace(/\/$/, '')}/v1/execute`;
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
    let message =
      typeof payload?.error?.message === 'string'
        ? payload.error.message
        : typeof payload?.message === 'string'
          ? payload.message
          : summarizeUpstreamError({ serviceName: 'SanFrancisco', baseUrl: resolved.baseUrl, status: res.status, bodyText: text });
    if (looksLikeHtml(message)) {
      message = summarizeUpstreamError({ serviceName: 'SanFrancisco', baseUrl: resolved.baseUrl, status: res.status, bodyText: message });
    }
    return { ok: false as const, error: 'AI_UPSTREAM_ERROR', message };
  }

  return { ok: true as const, value: { requestId: asTrimmedString(payload?.requestId), result: payload?.result } };
}

export async function POST(req: Request) {
  try {
    const resolved = await resolveSanFranciscoBaseUrl();
    if (!resolved) {
      // Return 200 so the UI can display a friendly message without triggering noisy console "Failed to load resource" logs.
      return NextResponse.json({ message: 'Copilot is temporarily unavailable (SanFrancisco is not reachable). Please try again in a moment.' }, { status: 200 });
    }

    const limited = checkRateLimit(req);
    if (limited) {
      // Return 200 so the UI can show this inline (no red console errors).
      return NextResponse.json(
        { message: 'Too many Copilot requests. Please wait a moment and try again.' },
        { status: 200, headers: { 'x-retry-after-ms': String(limited.retryAfterMs) } },
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
      // Website-based content edits may require a single-page fetch + an LLM call. Keep this generous in local dev.
      budgets: { maxTokens: 650, timeoutMs: 45_000, maxRequests: 2 },
    });
    if (!grantRes.ok) {
      return NextResponse.json(
        { message: grantRes.message || 'Copilot is temporarily unavailable. Please try again.' },
        { status: 200 },
      );
    }

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
    if (!executed.ok) {
      return NextResponse.json(
        { message: executed.message || 'Copilot is temporarily unavailable. Please try again.' },
        { status: 200 },
      );
    }

    const requestId = asTrimmedString(executed.value?.requestId);
    const result = executed.value?.result ?? null;
    if (requestId && isRecord(result)) {
      const baseMeta = isRecord((result as any).meta) ? ((result as any).meta as Record<string, unknown>) : {};
      const meta = { ...baseMeta, requestId };
      return NextResponse.json({ ...(result as Record<string, unknown>), meta });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Return 200 so UI can surface the message inline without a console error spam.
    return NextResponse.json(
      { message: message || 'Copilot failed unexpectedly. Please try again.' },
      { status: 200 },
    );
  }
}
