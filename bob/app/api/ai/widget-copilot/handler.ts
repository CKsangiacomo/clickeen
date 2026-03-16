import { NextRequest, NextResponse } from 'next/server';
import { WIDGET_COPILOT_AGENT_ALIAS, WIDGET_COPILOT_AGENT_IDS } from '@clickeen/ck-policy';
import { issueMinibobCopilotGrant, verifyMinibobSessionToken } from '../../../../lib/ai/minibob';

export const runtime = 'edge';

const SANFRANCISCO_BASE_URL =
  process.env.SANFRANCISCO_BASE_URL ||
  process.env.NEXT_PUBLIC_SANFRANCISCO_URL ||
  '';

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

type AiGrantSubject = 'minibob' | 'account';

function normalizeSubject(args: { rawSubject?: string; accountId?: string }): AiGrantSubject | null {
  const raw = (args.rawSubject || '').trim().toLowerCase();
  const hasAccount = Boolean((args.accountId || '').trim());

  if (raw === 'minibob') return 'minibob';
  if (raw === 'account') return hasAccount ? 'account' : null;
  if (raw) return null;
  if (hasAccount) return 'account';
  return 'minibob';
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

type UrlResolution = { baseUrl: string; resolvedAtMs: number; source: 'env' };

const ALLOWED_WIDGET_COPILOT_AGENT_IDS = new Set<string>([
  WIDGET_COPILOT_AGENT_ALIAS,
  WIDGET_COPILOT_AGENT_IDS.sdr,
  WIDGET_COPILOT_AGENT_IDS.cs,
]);

function isWidgetCopilotAgentId(value: string): value is (typeof WIDGET_COPILOT_AGENT_IDS)[keyof typeof WIDGET_COPILOT_AGENT_IDS] {
  return value === WIDGET_COPILOT_AGENT_IDS.sdr || value === WIDGET_COPILOT_AGENT_IDS.cs;
}

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

async function resolveSanFranciscoBaseUrl(): Promise<UrlResolution | null> {
  const envNormalized = (SANFRANCISCO_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!envNormalized) return null;
  const [baseUrl] = uniqStrings([envNormalized]);
  if (!baseUrl) return null;
  return { baseUrl, resolvedAtMs: Date.now(), source: 'env' };
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

async function executeOnSanFrancisco(args: { grant: string; agentId: string; input: unknown; traceClient?: string }) {
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
        trace: { client: args.traceClient || 'bob' },
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

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveSanFranciscoBaseUrl();
    if (!resolved) {
      return NextResponse.json(
        { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail: 'sanfrancisco_base_url_missing' } },
        { status: 500 },
      );
    }

    const limited = checkRateLimit(req);
    if (limited) {
      return NextResponse.json(
        { message: 'Too many Copilot requests. Please wait a moment and try again.' },
        { status: 200, headers: { 'x-retry-after-ms': String(limited.retryAfterMs) } },
      );
    }

    const body = (await req.json().catch(() => null)) as any;
    const prompt = asTrimmedString(body?.prompt);
    const widgetType = asTrimmedString(body?.widgetType);
    const sessionId = asTrimmedString(body?.sessionId);
    const sessionToken = asTrimmedString(body?.sessionToken);
    const rawSubject = asTrimmedString(body?.subject) || undefined;
    const accountId = asTrimmedString(body?.accountId) || undefined;
    const subject = normalizeSubject({ rawSubject, accountId });
    const requestedAgentId = asTrimmedString(body?.agentId) || WIDGET_COPILOT_AGENT_ALIAS;
    const provider = asTrimmedString(body?.provider) || undefined;
    const model = asTrimmedString(body?.model) || undefined;
    const currentConfig = body?.currentConfig;
    const controls = body?.controls;

    const issues: Array<{ path: string; message: string }> = [];
    if (!prompt) issues.push({ path: 'prompt', message: 'prompt is required' });
    if (!widgetType) issues.push({ path: 'widgetType', message: 'widgetType is required' });
    if (!sessionId) issues.push({ path: 'sessionId', message: 'sessionId is required' });
    if (!isRecord(currentConfig)) issues.push({ path: 'currentConfig', message: 'currentConfig must be an object' });
    if (!Array.isArray(controls)) issues.push({ path: 'controls', message: 'controls must be an array' });
    if (!subject) issues.push({ path: 'subject', message: 'subject must be minibob or account' });
    if (!ALLOWED_WIDGET_COPILOT_AGENT_IDS.has(requestedAgentId)) {
      issues.push({ path: 'agentId', message: 'agentId must be widget.copilot.v1, sdr.widget.copilot.v1, or cs.widget.copilot.v1' });
    }
    if (issues.length) return NextResponse.json({ error: 'VALIDATION', issues }, { status: 422 });

    if (subject !== 'minibob') {
      return NextResponse.json(
        { message: 'Account-mode Copilot now runs through Roma. Reopen Builder from Roma and try again.' },
        { status: 409 },
      );
    }

    if (!sessionToken) {
      return NextResponse.json({ error: 'VALIDATION', issues: [{ path: 'sessionToken', message: 'sessionToken is required for Minibob requests' }] }, { status: 422 });
    }

    const verified = await verifyMinibobSessionToken(sessionToken);
    if (!verified.ok) {
      return NextResponse.json({ message: verified.message }, { status: verified.status });
    }

    const grantRes = await issueMinibobCopilotGrant({
      agentId: requestedAgentId,
      requestedProvider: provider,
      requestedModel: model,
      trace: { sessionId },
      budgets: { maxTokens: 650, timeoutMs: 45_000, maxRequests: 2 },
    });
    if (!grantRes.ok) {
      if (grantRes.status === 403) {
        return NextResponse.json(
          {
            message: 'Copilot limit reached. Create a free account to continue.',
            cta: { text: 'Create a free account to continue', action: 'signup' },
            reasonKey: grantRes.reasonKey,
            detail: grantRes.detail,
          },
          { status: 200 },
        );
      }
      return NextResponse.json({ message: grantRes.reasonKey }, { status: grantRes.status });
    }

    const executed = await executeOnSanFrancisco({
      grant: grantRes.grant,
      agentId: grantRes.agentId,
      traceClient: 'minibob',
      input: {
        prompt,
        widgetType,
        currentConfig,
        controls,
        sessionId,
        sessionKey: verified.sessionKey,
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
      return NextResponse.json({ ...(result as Record<string, unknown>), meta: { ...baseMeta, requestId } });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { message: message || 'Copilot failed unexpectedly. Please try again.' },
      { status: 200 },
    );
  }
}
