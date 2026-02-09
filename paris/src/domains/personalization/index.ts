import { normalizeLocaleToken } from '@clickeen/l10n';
import { resolvePolicy } from '@clickeen/ck-policy';
import type { Policy } from '@clickeen/ck-policy';
import type { Env } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { assertDevAuth } from '../../shared/auth';
import { asTrimmedString, isRecord } from '../../shared/validation';
import { requireWorkspace } from '../../shared/workspaces';
import { consumeBudget, currentUtcBudgetPeriodKey } from '../../shared/budgets';
import { issueAiGrant } from '../ai';

const PREVIEW_DEFAULT_OVERRIDES = ['heroTitle', 'heroSubtitle', 'sectionTitle', 'ctaText'];
// Allow reasonably deep widget config paths (e.g. `sections.0.faqs.3.answer`) without letting
// arbitrary characters through (proto pollution safety happens when applying overrides).
const PREVIEW_OVERRIDE_KEY_RE = /^[a-zA-Z0-9._-]{1,160}$/;

function resolveWebsiteDepthCap(policy: Policy): number {
  const capRaw = policy.caps['personalization.sources.website.depth.max'];
  if (capRaw == null) return 5;
  if (typeof capRaw !== 'number' || !Number.isFinite(capRaw)) return 1;
  return Math.min(Math.max(1, Math.floor(capRaw)), 5);
}

function headerValue(headers: Headers, name: string, fallback = ''): string {
  const raw = headers.get(name);
  return raw && raw.trim() ? raw.trim() : fallback;
}

function getClientIp(req: Request): string {
  const cfIp = headerValue(req.headers, 'cf-connecting-ip');
  if (cfIp) return cfIp;
  const forwarded = headerValue(req.headers, 'x-forwarded-for');
  if (!forwarded) return 'local';
  return forwarded.split(',')[0]?.trim() || 'local';
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  return base64UrlEncodeBytes(await hmacSha256(secret, message));
}

function normalizePreviewOverrideKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return PREVIEW_DEFAULT_OVERRIDES.slice();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || !PREVIEW_OVERRIDE_KEY_RE.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= 12) break;
  }
  return out.length ? out : PREVIEW_DEFAULT_OVERRIDES.slice();
}

async function dispatchPersonalizationPreviewJob(args: {
  env: Env;
  job: {
    agentId: string;
    grant: string;
    url: string;
    locale?: string;
    templateContext?: Record<string, unknown>;
    allowedOverrides: string[];
  };
}): Promise<{ ok: true; jobId: string } | { ok: false; response: Response }> {
  const sfBaseUrl = asTrimmedString(args.env.SANFRANCISCO_BASE_URL);
  if (!sfBaseUrl) {
    return { ok: false, response: json({ error: 'MISCONFIGURED', message: 'Missing SANFRANCISCO_BASE_URL' }, { status: 503 }) };
  }
  const token = asTrimmedString(args.env.PARIS_DEV_JWT);
  if (!token) {
    return { ok: false, response: json({ error: 'MISCONFIGURED', message: 'Missing PARIS_DEV_JWT' }, { status: 503 }) };
  }

  const res = await fetch(new URL('/v1/personalization/preview', sfBaseUrl).toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(args.job),
  });

  const payload = await readJson(res);
  if (!res.ok) {
    return { ok: false, response: json({ error: 'UPSTREAM_ERROR', upstream: 'sanfrancisco', status: res.status, details: payload }, { status: 502 }) };
  }

  const jobId = asTrimmedString((payload as any)?.jobId);
  if (!jobId) {
    return { ok: false, response: json({ error: 'UPSTREAM_ERROR', upstream: 'sanfrancisco', message: 'Missing jobId' }, { status: 502 }) };
  }

  return { ok: true, jobId };
}

export async function handlePersonalizationPreviewCreate(req: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }

  if (!isRecord(body)) {
    return json([{ path: 'body', message: 'body must be an object' }], { status: 422 });
  }

  const url = asTrimmedString((body as any).url);
  if (!url) {
    return json([{ path: 'url', message: 'url is required' }], { status: 422 });
  }

  const localeRaw = normalizeLocaleToken((body as any).locale);
  const locale = localeRaw ? localeRaw : undefined;
  if ((body as any).locale && !localeRaw) {
    return json([{ path: 'locale', message: 'invalid locale' }], { status: 422 });
  }

  const templateContext = isRecord((body as any).templateContext) ? ((body as any).templateContext as Record<string, unknown>) : undefined;
  const allowedOverrides = normalizePreviewOverrideKeys((body as any).allowedOverrides);
  const sessionId = asTrimmedString((body as any).sessionId) || crypto.randomUUID();

  const minibobPolicy = resolvePolicy({ profile: 'minibob', role: 'editor' });
  const stage = asTrimmedString(env.ENV_STAGE)?.toLowerCase() || 'cloud-dev';
  // Local dev should never get blocked by monthly budgets (iteration speed > metering).
  const maxRuns = stage === 'local' ? null : (minibobPolicy.budgets['budget.personalization.runs']?.max ?? null);
  const secret = maxRuns != null ? asTrimmedString(env.AI_GRANT_HMAC_SECRET) : null;
  const previewBudgetFingerprint =
    maxRuns != null && secret
      ? await hmacSha256Base64Url(
          secret,
          `personalization.preview.session.v1|${currentUtcBudgetPeriodKey()}|${sessionId}`,
        )
      : null;

  const issued = await issueAiGrant({
    env,
    agentId: 'agent.personalization.preview.v1',
    subject: 'minibob',
    trace: { sessionId },
  });
  if (!issued.ok) return issued.response;

  if (maxRuns != null && previewBudgetFingerprint) {
    const consumed = await consumeBudget({
      env,
      scope: { kind: 'anon', fingerprint: previewBudgetFingerprint },
      budgetKey: 'budget.personalization.runs',
      max: maxRuns,
      amount: 1,
    });
    if (!consumed.ok) {
      return json({ error: { kind: 'DENY', reasonKey: consumed.reasonKey, upsell: 'UP', detail: consumed.detail } }, { status: 403 });
    }
  }

  const dispatch = await dispatchPersonalizationPreviewJob({
    env,
    job: {
      agentId: issued.agentId,
      grant: issued.grant,
      url,
      ...(locale ? { locale } : {}),
      ...(templateContext ? { templateContext } : {}),
      allowedOverrides,
    },
  });
  if (!dispatch.ok) return dispatch.response;

  return json({ jobId: dispatch.jobId });
}

export async function handlePersonalizationPreviewStatus(req: Request, env: Env, jobId: string): Promise<Response> {
  const sfBaseUrl = asTrimmedString(env.SANFRANCISCO_BASE_URL);
  if (!sfBaseUrl) {
    return json({ error: 'MISCONFIGURED', message: 'Missing SANFRANCISCO_BASE_URL' }, { status: 503 });
  }
  const token = asTrimmedString(env.PARIS_DEV_JWT);
  if (!token) {
    return json({ error: 'MISCONFIGURED', message: 'Missing PARIS_DEV_JWT' }, { status: 503 });
  }

  const res = await fetch(new URL(`/v1/personalization/preview/${encodeURIComponent(jobId)}`, sfBaseUrl).toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const payload = await readJson(res);
  if (!res.ok) {
    return json({ error: 'UPSTREAM_ERROR', upstream: 'sanfrancisco', status: res.status, details: payload }, { status: 502 });
  }

  return json(payload);
}

async function dispatchPersonalizationOnboardingJob(args: {
  env: Env;
  job: {
    agentId: string;
    grant: string;
    workspaceId: string;
    url: string;
    locale?: string;
    websiteDepth: number;
    gbpPlaceId?: string;
    facebookPageId?: string;
    instagramHandle?: string;
  };
}): Promise<{ ok: true; jobId: string } | { ok: false; response: Response }> {
  const sfBaseUrl = asTrimmedString(args.env.SANFRANCISCO_BASE_URL);
  if (!sfBaseUrl) {
    return { ok: false, response: json({ error: 'MISCONFIGURED', message: 'Missing SANFRANCISCO_BASE_URL' }, { status: 503 }) };
  }
  const token = asTrimmedString(args.env.PARIS_DEV_JWT);
  if (!token) {
    return { ok: false, response: json({ error: 'MISCONFIGURED', message: 'Missing PARIS_DEV_JWT' }, { status: 503 }) };
  }

  const res = await fetch(new URL('/v1/personalization/onboarding', sfBaseUrl).toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(args.job),
  });

  const payload = await readJson(res);
  if (!res.ok) {
    return { ok: false, response: json({ error: 'UPSTREAM_ERROR', upstream: 'sanfrancisco', status: res.status, details: payload }, { status: 502 }) };
  }

  const jobId = asTrimmedString((payload as any)?.jobId);
  if (!jobId) {
    return { ok: false, response: json({ error: 'UPSTREAM_ERROR', upstream: 'sanfrancisco', message: 'Missing jobId' }, { status: 502 }) };
  }

  return { ok: true, jobId };
}

export async function handlePersonalizationOnboardingCreate(req: Request, env: Env): Promise<Response> {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }
  if (!isRecord(body)) {
    return json([{ path: 'body', message: 'body must be an object' }], { status: 422 });
  }

  const workspaceId = asTrimmedString((body as any).workspaceId);
  const url = asTrimmedString((body as any).url);
  if (!workspaceId || !url) {
    return json([{ path: 'workspaceId', message: 'workspaceId and url are required' }], { status: 422 });
  }

  const workspaceRes = await requireWorkspace(env, workspaceId);
  if (!workspaceRes.ok) return workspaceRes.response;
  const workspace = workspaceRes.workspace;

  const policy = resolvePolicy({ profile: workspace.tier, role: 'editor' });
  const websiteDepth = resolveWebsiteDepthCap(policy);

  const localeRaw = normalizeLocaleToken((body as any).locale);
  if ((body as any).locale && !localeRaw) {
    return json([{ path: 'locale', message: 'invalid locale' }], { status: 422 });
  }

  const gbpPlaceId = asTrimmedString((body as any).gbpPlaceId) || '';
  const facebookPageId = asTrimmedString((body as any).facebookPageId) || '';
  const instagramHandle = asTrimmedString((body as any).instagramHandle) || '';

  const sessionId = asTrimmedString((body as any).sessionId) || crypto.randomUUID();
  const issued = await issueAiGrant({
    env,
    agentId: 'agent.personalization.onboarding.v1',
    subject: 'workspace',
    workspaceId,
    workspace,
    trace: { sessionId },
  });
  if (!issued.ok) return issued.response;

  const dispatch = await dispatchPersonalizationOnboardingJob({
    env,
    job: {
      agentId: issued.agentId,
      grant: issued.grant,
      workspaceId,
      url,
      websiteDepth,
      ...(localeRaw ? { locale: localeRaw } : {}),
      ...(gbpPlaceId ? { gbpPlaceId } : {}),
      ...(facebookPageId ? { facebookPageId } : {}),
      ...(instagramHandle ? { instagramHandle } : {}),
    },
  });
  if (!dispatch.ok) return dispatch.response;

  return json({ jobId: dispatch.jobId });
}

export async function handlePersonalizationOnboardingStatus(req: Request, env: Env, jobId: string): Promise<Response> {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const sfBaseUrl = asTrimmedString(env.SANFRANCISCO_BASE_URL);
  if (!sfBaseUrl) {
    return json({ error: 'MISCONFIGURED', message: 'Missing SANFRANCISCO_BASE_URL' }, { status: 503 });
  }
  const token = asTrimmedString(env.PARIS_DEV_JWT);
  if (!token) {
    return json({ error: 'MISCONFIGURED', message: 'Missing PARIS_DEV_JWT' }, { status: 503 });
  }

  const res = await fetch(new URL(`/v1/personalization/onboarding/${encodeURIComponent(jobId)}`, sfBaseUrl).toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const payload = await readJson(res);
  if (!res.ok) {
    return json({ error: 'UPSTREAM_ERROR', upstream: 'sanfrancisco', status: res.status, details: payload }, { status: 502 });
  }

  return json(payload);
}
