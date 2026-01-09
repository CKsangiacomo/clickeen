import { can, resolvePolicy } from '@clickeen/ck-policy';
import type { Policy, PolicyProfile } from '@clickeen/ck-policy';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PARIS_DEV_JWT: string;
  AI_GRANT_HMAC_SECRET?: string;
  SANFRANCISCO_BASE_URL?: string;
  ENVIRONMENT?: string;
  ENV_STAGE?: string;
};

type InstanceRow = {
  public_id: string;
  status: 'published' | 'unpublished';
  config: Record<string, unknown>;
  created_at: string;
  updated_at?: string | null;
  widget_id: string | null;
  workspace_id?: string | null;
};

type WidgetRow = {
  id: string;
  type: string | null;
  name: string | null;
  catalog?: unknown;
};

type WorkspaceRow = {
  id: string;
  tier: 'free' | 'tier1' | 'tier2' | 'tier3';
  name: string;
  slug: string;
  website_url: string | null;
};

type UpdatePayload = {
  config?: Record<string, unknown>;
  status?: 'published' | 'unpublished';
};

type CreateInstancePayload = {
  widgetType: string;
  publicId: string;
  workspaceId: string;
  config: Record<string, unknown>;
  status?: 'published' | 'unpublished';
  widgetName?: string;
};

type CkErrorKind = 'DENY' | 'VALIDATION' | 'AUTH' | 'NOT_FOUND' | 'INTERNAL';

type CkErrorResponse = {
  error: {
    kind: CkErrorKind;
    reasonKey: string;
    upsell?: 'UP';
    detail?: string;
    paths?: string[];
  };
};

const CK_DEV_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
const CK_DEMO_WORKSPACE_ID = '00000000-0000-0000-0000-000000000002';

type GrantSubject =
  | { kind: 'anon'; sessionId: string }
  | { kind: 'user'; userId: string; workspaceId: string }
  | { kind: 'service'; serviceId: string };

type AIGrant = {
  v: 1;
  iss: 'paris';
  sub: GrantSubject;
  exp: number; // epoch seconds
  caps: string[];
  budgets: {
    maxTokens: number;
    timeoutMs?: number;
    maxCostUsd?: number;
    maxRequests?: number;
  };
  mode: 'editor' | 'ops';
  trace?: {
    sessionId?: string;
    instancePublicId?: string;
    envStage?: string;
  };
};

function json(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!headers.has('Access-Control-Allow-Origin')) headers.set('Access-Control-Allow-Origin', '*');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function ckError(error: CkErrorResponse['error'], status: number) {
  return json({ error } satisfies CkErrorResponse, { status });
}

function requireEnv(env: Env, key: keyof Env) {
  const value = env[key];
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new Error(`[ParisWorker] Missing required env var: ${key}`);
  }
  return value.trim();
}

function asBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  if (!token) return null;
  return token.trim() || null;
}

function assertDevAuth(req: Request, env: Env) {
  const expected = requireEnv(env, 'PARIS_DEV_JWT');
  const token = asBearerToken(req.headers.get('Authorization'));
  if (!token) {
    return { ok: false as const, response: json({ error: 'AUTH_REQUIRED' }, { status: 401 }) };
  }
  if (token !== expected) {
    return { ok: false as const, response: json({ error: 'AUTH_INVALID' }, { status: 403 }) };
  }
  return { ok: true as const };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
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

async function mintGrant(grant: AIGrant, secret: string): Promise<string> {
  const payloadB64 = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(grant)));
  const sigBytes = await hmacSha256(secret, `v1.${payloadB64}`);
  const sigB64 = base64UrlEncodeBytes(sigBytes);
  return `v1.${payloadB64}.${sigB64}`;
}

async function supabaseFetch(env: Env, pathnameWithQuery: string, init?: RequestInit) {
  const baseUrl = requireEnv(env, 'SUPABASE_URL').replace(/\/+$/, '');
  const key = requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');

  const headers = new Headers(init?.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');

  return fetch(`${baseUrl}${pathnameWithQuery}`, {
    ...init,
    headers,
  });
}

async function readJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function assertWorkspaceId(value: unknown) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || !isUuid(trimmed)) {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' }, 422) };
  }
  return { ok: true as const, value: trimmed };
}

async function loadWorkspaceById(env: Env, workspaceId: string): Promise<WorkspaceRow | null> {
  const params = new URLSearchParams({
    select: 'id,tier,name,slug,website_url',
    id: `eq.${workspaceId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load workspace (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as WorkspaceRow[];
  return rows?.[0] ?? null;
}

async function requireWorkspace(env: Env, workspaceId: string) {
  try {
    const workspace = await loadWorkspaceById(env, workspaceId);
    if (!workspace) {
      return { ok: false as const, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.workspace.notFound' }, 404) };
    }
    return { ok: true as const, workspace };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false as const,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500),
    };
  }
}

function resolveEditorPolicyFromRequest(req: Request, workspace: WorkspaceRow) {
  const url = new URL(req.url);
  const subject = (url.searchParams.get('subject') || '').trim().toLowerCase();

  let profile: PolicyProfile;
  let role: Policy['role'];

  if (subject === 'devstudio') {
    profile = 'devstudio';
    role = 'owner';
  } else if (subject === 'minibob') {
    profile = 'minibob';
    role = 'editor';
  } else if (subject === 'workspace') {
    profile = workspace.tier;
    role = 'editor';
  } else {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.subject.invalid' }, 422) };
  }

  const policy = resolvePolicy({ profile, role });
  return { ok: true as const, policy, profile };
}

async function handleHealthz() {
  return json({ up: true });
}

async function handleNotImplemented(req: Request, env: Env, feature: string) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;
  return json({ error: 'NOT_IMPLEMENTED', feature }, { status: 501 });
}

async function handleAiGrant(req: Request, env: Env) {
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

  const agentId = typeof body.agentId === 'string' ? body.agentId.trim() : '';
  const mode = body.mode === 'ops' ? 'ops' : 'editor';

  const allowedAgentIds = new Set(['sdr.copilot', 'sdr.widget.copilot.v1', 'debug.grantProbe']);
  if (!agentId || !allowedAgentIds.has(agentId)) {
    return json([{ path: 'agentId', message: 'unknown agentId' }], { status: 422 });
  }

  const traceRaw = isRecord(body.trace) ? body.trace : null;
  const sessionId = typeof traceRaw?.sessionId === 'string' && traceRaw.sessionId.trim() ? traceRaw.sessionId.trim() : crypto.randomUUID();
  const instancePublicId =
    typeof traceRaw?.instancePublicId === 'string' && traceRaw.instancePublicId.trim()
      ? traceRaw.instancePublicId.trim()
      : undefined;

  const envStage = typeof env.ENV_STAGE === 'string' && env.ENV_STAGE.trim() ? env.ENV_STAGE.trim() : 'cloud-dev';

  const trace: AIGrant['trace'] = {
    sessionId,
    ...(instancePublicId ? { instancePublicId } : {}),
    envStage,
  };

  const budgetsRaw = isRecord(body.budgets) ? body.budgets : null;
  const requestedMaxTokens = budgetsRaw && typeof budgetsRaw.maxTokens === 'number' ? budgetsRaw.maxTokens : null;
  const requestedTimeoutMs = budgetsRaw && typeof budgetsRaw.timeoutMs === 'number' ? budgetsRaw.timeoutMs : null;
  const requestedMaxRequests = budgetsRaw && typeof budgetsRaw.maxRequests === 'number' ? budgetsRaw.maxRequests : null;

  const MAX_TOKENS_CAP = 1200;
  const TIMEOUT_MS_CAP = 25_000;
  const MAX_REQUESTS_CAP = 3;

  const maxTokens =
    requestedMaxTokens && Number.isFinite(requestedMaxTokens) && requestedMaxTokens > 0
      ? Math.min(MAX_TOKENS_CAP, Math.floor(requestedMaxTokens))
      : 280;
  const timeoutMs =
    requestedTimeoutMs && Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
      ? Math.min(TIMEOUT_MS_CAP, Math.floor(requestedTimeoutMs))
      : 15_000;
  const maxRequests =
    requestedMaxRequests && Number.isFinite(requestedMaxRequests) && requestedMaxRequests > 0
      ? Math.min(MAX_REQUESTS_CAP, Math.floor(requestedMaxRequests))
      : 1;

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + 60; // short-lived grant for a single interaction

  const grantPayload: AIGrant = {
    v: 1,
    iss: 'paris',
    sub: { kind: 'anon', sessionId: trace.sessionId || crypto.randomUUID() },
    exp,
    caps: [`agent:${agentId}`],
    budgets: { maxTokens, timeoutMs, maxRequests },
    mode,
    trace,
  };

  const secret = env.AI_GRANT_HMAC_SECRET?.trim();
  if (!secret) {
    return json({ error: 'AI_NOT_CONFIGURED', message: 'Missing AI_GRANT_HMAC_SECRET' }, { status: 503 });
  }

  const grant = await mintGrant(grantPayload, secret);
  return json({ grant, exp, agentId });
}

const OUTCOME_EVENTS = new Set([
  'signup_started',
  'signup_completed',
  'upgrade_clicked',
  'upgrade_completed',
  'cta_clicked',
  'ux_keep',
  'ux_undo',
]);

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

function assertWidgetType(widgetType: unknown) {
  const value = asTrimmedString(widgetType);
  if (!value) return { ok: false as const, issues: [{ path: 'widgetType', message: 'widgetType is required' }] };
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) {
    return { ok: false as const, issues: [{ path: 'widgetType', message: 'invalid widgetType format' }] };
  }
  return { ok: true as const, value };
}

function assertPublicId(publicId: unknown) {
  const value = asTrimmedString(publicId);
  if (!value) return { ok: false as const, issues: [{ path: 'publicId', message: 'publicId is required' }] };
  const okLegacy = /^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*|u_[a-z0-9][a-z0-9_-]*)$/.test(value);
  const okWebsiteCreative =
    // Locale-free website creative instances (canonical). Locale is a runtime parameter, not part of identity.
    /^wgt_web_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/.test(value);
  if (!okLegacy && !okWebsiteCreative) {
    return { ok: false as const, issues: [{ path: 'publicId', message: 'invalid publicId format' }] };
  }
  return { ok: true as const, value };
}

function isOutcomeAttachPayload(value: unknown): value is {
  requestId: string;
  sessionId: string;
  event: string;
  occurredAtMs: number;
  timeToDecisionMs?: number;
  accountIdHash?: string;
  workspaceIdHash?: string;
} {
  if (!isRecord(value)) return false;
  const requestId = asTrimmedString((value as any).requestId);
  const sessionId = asTrimmedString((value as any).sessionId);
  const event = asTrimmedString((value as any).event);
  const occurredAtMs = (value as any).occurredAtMs;
  const timeToDecisionMs = (value as any).timeToDecisionMs;
  const accountIdHash = (value as any).accountIdHash;
  const workspaceIdHash = (value as any).workspaceIdHash;

  if (!requestId) return false;
  if (!sessionId) return false;
  if (!event || !OUTCOME_EVENTS.has(event)) return false;
  if (typeof occurredAtMs !== 'number' || !Number.isFinite(occurredAtMs)) return false;
  if (timeToDecisionMs !== undefined && (typeof timeToDecisionMs !== 'number' || !Number.isFinite(timeToDecisionMs) || timeToDecisionMs < 0)) return false;
  if (accountIdHash !== undefined && (typeof accountIdHash !== 'string' || !accountIdHash.trim())) return false;
  if (workspaceIdHash !== undefined && (typeof workspaceIdHash !== 'string' || !workspaceIdHash.trim())) return false;
  return true;
}

async function handleAiOutcome(req: Request, env: Env) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }

  if (!isOutcomeAttachPayload(body)) {
    return json([{ path: 'body', message: 'expected { requestId, sessionId, event, occurredAtMs }' }], { status: 422 });
  }

  const sfBaseUrl = asTrimmedString(env.SANFRANCISCO_BASE_URL);
  if (!sfBaseUrl) {
    return json({ error: 'MISCONFIGURED', message: 'Missing SANFRANCISCO_BASE_URL' }, { status: 503 });
  }

  const secret = env.AI_GRANT_HMAC_SECRET?.trim();
  if (!secret) {
    return json({ error: 'AI_NOT_CONFIGURED', message: 'Missing AI_GRANT_HMAC_SECRET' }, { status: 503 });
  }

  const bodyText = JSON.stringify(body);
  const signature = await hmacSha256Base64Url(secret, `outcome.v1.${bodyText}`);
  const outcomeUrl = new URL('/v1/outcome', sfBaseUrl).toString();

  const res = await fetch(outcomeUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paris-signature': signature,
    },
    body: bodyText,
  });

  if (!res.ok) {
    const details = await readJson(res);
    return json({ error: 'UPSTREAM_ERROR', upstream: 'sanfrancisco', status: res.status, details }, { status: 502 });
  }

  const data = await readJson(res);
  return json({ ok: true, upstream: data });
}

async function handleInstances(req: Request, env: Env) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const workspaceIdResult = assertWorkspaceId(url.searchParams.get('workspaceId'));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const params = new URLSearchParams({
    select: 'public_id,status,config,created_at,updated_at,widget_id,workspace_id',
    order: 'created_at.desc',
    limit: '50',
    workspace_id: `eq.${workspaceId}`,
  });

  const instRes = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, { method: 'GET' });
  if (!instRes.ok) {
    const details = await readJson(instRes);
    return json({ error: 'DB_ERROR', details }, { status: 500 });
  }

  const rows = ((await instRes.json()) as InstanceRow[]).filter(Boolean);
  const widgetIds = Array.from(
    new Set(rows.map((row) => row.widget_id).filter((id): id is string => typeof id === 'string' && id.length > 0)),
  );

  const widgetLookup = new Map<string, { type: string | null; name: string | null }>();
  if (widgetIds.length > 0) {
    const widgetParams = new URLSearchParams({
      select: 'id,type,name',
      id: `in.(${widgetIds.join(',')})`,
    });
    const widgetRes = await supabaseFetch(env, `/rest/v1/widgets?${widgetParams.toString()}`, { method: 'GET' });
    if (!widgetRes.ok) {
      const details = await readJson(widgetRes);
      return json({ error: 'DB_ERROR', details }, { status: 500 });
    }
    const widgets = ((await widgetRes.json()) as WidgetRow[]).filter(Boolean);
    widgets.forEach((w) => {
      if (!w?.id) return;
      widgetLookup.set(String(w.id), { type: w.type ?? null, name: w.name ?? null });
    });
  }

  const instances = rows.map((row) => {
    const widget = row.widget_id ? widgetLookup.get(row.widget_id) : undefined;
    return {
      publicId: row.public_id,
      widgetname: widget?.type ?? 'unknown',
      displayName: row.public_id,
      config: row.config,
    };
  });

  return json({ instances });
}

async function loadInstanceByPublicId(env: Env, publicId: string): Promise<InstanceRow | null> {
  const params = new URLSearchParams({
    select: 'public_id,status,config,created_at,updated_at,widget_id,workspace_id',
    public_id: `eq.${publicId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load instance (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as InstanceRow[];
  return rows?.[0] ?? null;
}

async function loadInstanceByWorkspaceAndPublicId(env: Env, workspaceId: string, publicId: string): Promise<InstanceRow | null> {
  const params = new URLSearchParams({
    select: 'public_id,status,config,created_at,updated_at,widget_id,workspace_id',
    public_id: `eq.${publicId}`,
    workspace_id: `eq.${workspaceId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load instance (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as InstanceRow[];
  return rows?.[0] ?? null;
}

async function loadWidget(env: Env, widgetId: string): Promise<WidgetRow | null> {
  const params = new URLSearchParams({
    select: 'id,type,name',
    id: `eq.${widgetId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/widgets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load widget (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as WidgetRow[];
  return rows?.[0] ?? null;
}

async function loadWidgetByType(env: Env, widgetType: string): Promise<WidgetRow | null> {
  const params = new URLSearchParams({
    select: 'id,type,name,catalog',
    type: `eq.${widgetType}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/widgets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load widget by type (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as WidgetRow[];
  return rows?.[0] ?? null;
}

async function handleListWidgets(req: Request, env: Env) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const params = new URLSearchParams({
    select: 'type,name',
    order: 'type.asc',
  });
  const res = await supabaseFetch(env, `/rest/v1/widgets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
  }
  const rows = (await res.json().catch(() => [])) as Array<{ type?: string | null; name?: string | null }>;
  return json(
    {
      widgets: rows
        .map((row) => ({ type: typeof row.type === 'string' ? row.type : null, name: typeof row.name === 'string' ? row.name : null }))
        .filter((row) => Boolean(row.type)),
    },
    { status: 200 },
  );
}

const WEBSITE_CREATIVE_PAGES = new Set(['overview', 'templates', 'examples', 'features']);

function assertWebsiteCreativePage(value: unknown) {
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!trimmed || !WEBSITE_CREATIVE_PAGES.has(trimmed)) {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.page.invalid' }, 422) };
  }
  return { ok: true as const, value: trimmed };
}

function assertWebsiteCreativeSlot(value: unknown) {
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : '';
  // Website creative block ids are dot-separated slot keys (e.g. "feature.left.50").
  // Lock: lowercase segments matching [a-z0-9][a-z0-9_-]*, separated by dots.
  if (!trimmed || !/^[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)*$/.test(trimmed)) {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.slot.invalid' }, 422) };
  }
  return { ok: true as const, value: trimmed };
}

type WebsiteCreativeEnsurePayload = {
  widgetType: string;
  page: string;
  slot: string;
  baselineConfig?: Record<string, unknown>;
  overwrite?: boolean;
};

async function handleWorkspaceEnsureWebsiteCreative(req: Request, env: Env, workspaceId: string) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  if ((env.ENV_STAGE || '').toLowerCase() !== 'local') {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.superadmin.localOnly' }, 403);
  }

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;
  if (policyResult.profile !== 'devstudio') {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.subject.invalid' }, 422);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }
  if (!isRecord(payload)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const widgetTypeResult = assertWidgetType((payload as any).widgetType);
  if (!widgetTypeResult.ok) return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);

  const pageResult = assertWebsiteCreativePage((payload as any).page);
  if (!pageResult.ok) return pageResult.response;

  const slotResult = assertWebsiteCreativeSlot((payload as any).slot);
  if (!slotResult.ok) return slotResult.response;

  const overwrite = (payload as any).overwrite === true;

  const widgetType = widgetTypeResult.value;
  const page = pageResult.value;
  const slot = slotResult.value;
  const creativeKey = `${widgetType}.${page}.${slot}`;
  const publicId = `wgt_web_${creativeKey}`;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok) return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422);

  // 1) Ensure instance exists (and optionally reset config to baseline).
  const existing = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (existing && !overwrite) {
    // No-op open path: do not validate or mutate baseline config if we're only opening an existing creative.
    return json({ creativeKey, publicId }, { status: 200 });
  }

  const baselineConfigResult = assertConfig((payload as any).baselineConfig);
  if (!baselineConfigResult.ok) return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  const baselineConfig = baselineConfigResult.value;

  const issues = configNonPersistableUrlIssues(baselineConfig);
  if (issues.length) {
    return ckError(
      {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.publish.nonPersistableUrl',
        detail: issues[0]?.message,
        paths: issues.map((i) => `baselineConfig.${i.path}`),
      },
      422,
    );
  }

  const denyByPolicy = enforceConfigAgainstPolicy(policyResult.policy, baselineConfig);
  if (denyByPolicy) return denyByPolicy;
  const denyFaqCaps = enforceFaqCaps(policyResult.policy, widgetType, baselineConfig);
  if (denyFaqCaps) return denyFaqCaps;

  if (!existing) {
    let widget = await loadWidgetByType(env, widgetType);
    if (!widget) {
      const insertRes = await supabaseFetch(env, `/rest/v1/widgets`, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          type: widgetType,
          name: titleCase(widgetType) || widgetType,
        }),
      });
      if (!insertRes.ok) {
        const details = await readJson(insertRes);
        return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500);
      }
      const created = (await insertRes.json().catch(() => null)) as WidgetRow[] | null;
      widget = created?.[0] ?? null;
    }

    if (!widget?.id) {
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'Failed to resolve widget row' }, 500);
    }

    const instanceInsert = await supabaseFetch(env, `/rest/v1/widget_instances`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        widget_id: widget.id,
        public_id: publicId,
        status: 'unpublished',
        config: baselineConfig,
      }),
    });
    if (!instanceInsert.ok) {
      const details = await readJson(instanceInsert);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500);
    }
  } else {
    const patchRes = await supabaseFetch(
      env,
      `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(publicId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ config: baselineConfig }),
      },
    );
    if (!patchRes.ok) {
      const details = await readJson(patchRes);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500);
    }
  }

  return json({ creativeKey, publicId }, { status: 200 });
}

async function handleGetInstance(req: Request, env: Env, publicId: string) {
  // This is the legacy "publicId-only" instance endpoint.
  // It is used by Venice (public embed runtime) and must be readable without dev auth,
  // but it must never leak drafts.
  //
  // If a valid dev bearer token is provided, allow reading draft/unpublished for dev workflows.
  // Otherwise, treat the request as public and only return published instances.
  const expected = requireEnv(env, 'PARIS_DEV_JWT');
  const token = asBearerToken(req.headers.get('Authorization'));
  const isDev = Boolean(token && token === expected);

  const instance = await loadInstanceByPublicId(env, publicId);
  if (!instance) return json({ error: 'NOT_FOUND' }, { status: 404 });

  if (!isDev && instance.status !== 'published') {
    // Treat unpublished as not-found for public surfaces (Venice, marketing pages, etc).
    return json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const widgetId = instance.widget_id;
  const widget = widgetId ? await loadWidget(env, widgetId) : null;
  if (!widget) return json({ error: 'WIDGET_NOT_FOUND' }, { status: 500 });

  if (!isDev) {
    return json({
      publicId: instance.public_id,
      status: instance.status,
      widgetType: widget.type ?? null,
      config: instance.config,
      updatedAt: instance.updated_at ?? null,
    });
  }

  return json({
    publicId: instance.public_id,
    status: instance.status,
    widgetType: widget.type ?? null,
    config: instance.config,
    updatedAt: instance.updated_at ?? null,
    workspaceId: instance.workspace_id ?? null,
  });
}

async function handleWorkspaceInstances(req: Request, env: Env, workspaceId: string) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;

  // Reuse the legacy shape for now (DevStudio tooling consumes it), but scope it to a workspace.
  const url = new URL(req.url);
  url.searchParams.set('workspaceId', workspaceId);
  return handleInstances(new Request(url.toString(), { method: 'GET', headers: req.headers }), env);
}

async function handleWorkspaceGetInstance(req: Request, env: Env, workspaceId: string, publicId: string) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const widgetId = instance.widget_id;
  const widget = widgetId ? await loadWidget(env, widgetId) : null;
  if (!widget) return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  return json({
    publicId: instance.public_id,
    status: instance.status,
    widgetType: widget.type ?? null,
    config: instance.config,
    updatedAt: instance.updated_at ?? null,
    policy: policyResult.policy,
    workspace: {
      id: workspace.id,
      tier: workspace.tier,
      websiteUrl: workspace.website_url,
    },
  });
}

function enforceConfigAgainstPolicy(policy: Policy, config: Record<string, unknown>) {
  const seoGeoEnabled = Boolean((config as any)?.seoGeo?.enabled === true);
  if (seoGeoEnabled && policy.flags['embed.seoGeo.enabled'] !== true) {
    return ckError(
      {
        kind: 'DENY',
        reasonKey: 'coreui.upsell.reason.embed.seoGeo',
        upsell: 'UP',
        paths: ['config.seoGeo.enabled'],
      },
      403
    );
  }
  return null;
}

function enforceFaqCaps(policy: Policy, widgetType: string | null, config: Record<string, unknown>) {
  if (widgetType !== 'faq') return null;

  const sections = Array.isArray((config as any).sections) ? ((config as any).sections as unknown[]) : [];
  const sectionCount = sections.length;
  const faqCounts = sections.map((section) => (Array.isArray((section as any)?.faqs) ? (section as any).faqs.length : 0));
  const qaTotal = faqCounts.reduce((sum, n) => sum + n, 0);
  const qaMaxInSection = faqCounts.reduce((max, n) => Math.max(max, n), 0);

  const denyCap = (capKey: keyof Policy['caps'], current: number, path: string) => {
    const max = policy.caps[capKey];
    if (max == null) return null;
    if (current <= max) return null;
    return ckError(
      {
        kind: 'DENY',
        reasonKey: 'coreui.upsell.reason.capReached',
        upsell: 'UP',
        detail: `${String(capKey)} exceeded (max=${max}, current=${current}).`,
        paths: [path],
      },
      403
    );
  };

  return (
    denyCap('widget.faq.sections.max', sectionCount, 'config.sections') ||
    denyCap('widget.faq.qa.max', qaTotal, 'config.sections[*].faqs') ||
    denyCap('widget.faq.qaPerSection.max', qaMaxInSection, 'config.sections[*].faqs')
  );
}

async function handleWorkspaceUpdateInstance(req: Request, env: Env, workspaceId: string, publicId: string) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const publishGate = can(policyResult.policy, 'instance.publish');
  if (!publishGate.allow) {
    return ckError(
      { kind: 'DENY', reasonKey: publishGate.reasonKey, upsell: 'UP', detail: publishGate.detail },
      403
    );
  }

  let payload: UpdatePayload;
  try {
    payload = (await req.json()) as UpdatePayload;
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }

  const configResult = payload.config !== undefined ? assertConfig(payload.config) : { ok: true as const, value: undefined };
  if (!configResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.config.invalid' }, 422);
  }

  const statusResult = assertStatus(payload.status);
  if (!statusResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.status.invalid' }, 422);
  }

  const config = configResult.value;
  const status = statusResult.value;

  if (config === undefined && status === undefined) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' }, 422);
  }

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const widgetId = instance.widget_id;
  const widget = widgetId ? await loadWidget(env, widgetId) : null;
  if (!widget) return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  if (config !== undefined) {
    const issues = configNonPersistableUrlIssues(config);
    if (issues.length) {
      return ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.publish.nonPersistableUrl',
          detail: issues[0]?.message,
          paths: issues.map((i) => i.path),
        },
        422
      );
    }

    const denyByPolicy = enforceConfigAgainstPolicy(policyResult.policy, config);
    if (denyByPolicy) return denyByPolicy;

    const denyByCaps = enforceFaqCaps(policyResult.policy, widget.type ?? null, config);
    if (denyByCaps) return denyByCaps;
  }

  const update: Record<string, unknown> = {};
  if (config !== undefined) update.config = config;
  if (status !== undefined) update.status = status;

  const patchRes = await supabaseFetch(
    env,
    `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(publicId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(update),
    }
  );
  if (!patchRes.ok) {
    const details = await readJson(patchRes);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500);
  }

  return handleWorkspaceGetInstance(req, env, workspaceId, publicId);
}

async function handleWorkspaceCreateInstance(req: Request, env: Env, workspaceId: string) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const createGate = can(policyResult.policy, 'instance.create');
  if (!createGate.allow) {
    return ckError({ kind: 'DENY', reasonKey: createGate.reasonKey, upsell: 'UP', detail: createGate.detail }, 403);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }

  if (!isRecord(payload)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const widgetTypeResult = assertWidgetType((payload as any).widgetType);
  const publicIdResult = assertPublicId((payload as any).publicId);
  const configResult = assertConfig((payload as any).config);
  const statusResult = assertStatus((payload as any).status);

  if (!widgetTypeResult.ok || !publicIdResult.ok || !configResult.ok || !statusResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const widgetType = widgetTypeResult.value;
  const publicId = publicIdResult.value;
  const config = configResult.value;
  const status = statusResult.value ?? 'unpublished';

  const existing = await loadInstanceByPublicId(env, publicId);
  if (existing) {
    if (existing.workspace_id && existing.workspace_id !== workspaceId) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.conflict' }, 409);
    }
    return handleWorkspaceGetInstance(req, env, workspaceId, publicId);
  }

  const issues = configNonPersistableUrlIssues(config);
  if (issues.length) {
    return ckError(
      {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.publish.nonPersistableUrl',
        detail: issues[0]?.message,
        paths: issues.map((i) => i.path),
      },
      422
    );
  }

  const denyByPolicy = enforceConfigAgainstPolicy(policyResult.policy, config);
  if (denyByPolicy) return denyByPolicy;

  let widget = await loadWidgetByType(env, widgetType);
  if (!widget) {
    const widgetName = asTrimmedString((payload as any).widgetName);
    const insertRes = await supabaseFetch(env, `/rest/v1/widgets`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        type: widgetType,
        name: widgetName ?? (titleCase(widgetType) || widgetType),
      }),
    });
    if (!insertRes.ok) {
      const details = await readJson(insertRes);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500);
    }
    const created = (await insertRes.json().catch(() => null)) as WidgetRow[] | null;
    widget = created?.[0] ?? null;
  }

  if (!widget?.id) {
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: 'Failed to resolve widget row' }, 500);
  }

  const instanceInsert = await supabaseFetch(env, `/rest/v1/widget_instances`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      widget_id: widget.id,
      public_id: publicId,
      status,
      config,
    }),
  });
  if (!instanceInsert.ok) {
    const details = await readJson(instanceInsert);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500);
  }

  return handleWorkspaceGetInstance(req, env, workspaceId, publicId);
}

function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ');
}

async function handleCreateInstance(req: Request, env: Env) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }

  if (!isRecord(payload)) {
    return json([{ path: 'body', message: 'body must be an object' }], { status: 422 });
  }

  const issues: Array<{ path: string; message: string }> = [];

  const widgetTypeResult = assertWidgetType((payload as any).widgetType);
  if (!widgetTypeResult.ok) issues.push(...widgetTypeResult.issues);

  const publicIdResult = assertPublicId((payload as any).publicId);
  if (!publicIdResult.ok) issues.push(...publicIdResult.issues);

  const workspaceIdRaw = asTrimmedString((payload as any).workspaceId);
  if (!workspaceIdRaw) {
    issues.push({ path: 'workspaceId', message: 'workspaceId is required' });
  } else if (!isUuid(workspaceIdRaw)) {
    issues.push({ path: 'workspaceId', message: 'workspaceId must be a uuid' });
  }

  const configResult = assertConfig((payload as any).config);
  if (!configResult.ok) issues.push(...configResult.issues);
  if (configResult.ok) issues.push(...configNonPersistableUrlIssues(configResult.value));

  const statusResult = assertStatus((payload as any).status);
  if (!statusResult.ok) issues.push(...statusResult.issues);

  const widgetName = asTrimmedString((payload as any).widgetName);

  if (issues.length) return json(issues, { status: 422 });

  const widgetType = widgetTypeResult.value!;
  const publicId = publicIdResult.value!;
  const workspaceId = workspaceIdRaw as string;
  const config = configResult.value!;
  const status = statusResult.value ?? 'unpublished';

  const existing = await loadInstanceByPublicId(env, publicId);
  if (existing) {
    if (existing.workspace_id && existing.workspace_id !== workspaceId) {
      return json({ error: 'WORKSPACE_MISMATCH' }, { status: 409 });
    }
    return handleGetInstance(req, env, publicId);
  }

  let widget = await loadWidgetByType(env, widgetType);
  if (!widget) {
    const insertRes = await supabaseFetch(env, `/rest/v1/widgets`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        type: widgetType,
        name: widgetName ?? (titleCase(widgetType) || widgetType),
      }),
    });
    if (!insertRes.ok) {
      const details = await readJson(insertRes);
      return json({ error: 'DB_ERROR', details }, { status: 500 });
    }
    const created = (await insertRes.json().catch(() => null)) as WidgetRow[] | null;
    widget = created?.[0] ?? null;
  }

  if (!widget?.id) {
    return json({ error: 'DB_ERROR', message: 'Failed to resolve widget row' }, { status: 500 });
  }

  const instanceInsert = await supabaseFetch(env, `/rest/v1/widget_instances`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      widget_id: widget.id,
      public_id: publicId,
      workspace_id: workspaceId,
      status,
      config,
    }),
  });
  if (!instanceInsert.ok) {
    const details = await readJson(instanceInsert);
    return json({ error: 'DB_ERROR', details }, { status: 500 });
  }

  return handleGetInstance(req, env, publicId);
}

function assertConfig(config: unknown) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { ok: false as const, issues: [{ path: 'config', message: 'config must be an object' }] };
  }
  return { ok: true as const, value: config as Record<string, unknown> };
}

function containsNonPersistableUrl(value: string): boolean {
  // Reject any persisted reference to data/blob URLs.
  // Avoid false positives like "metadata:" by requiring string-start or a delimiter.
  return /(?:^|[\s("'=,])(?:data|blob):/i.test(value);
}

function configNonPersistableUrlIssues(config: unknown): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];

  const visit = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (containsNonPersistableUrl(node)) {
        issues.push({
          path,
          message: 'non-persistable URL scheme found (data:/blob:). Persist stable URLs/keys only.',
        });
      }
      return;
    }

    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], `${path}[${i}]`);
      }
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
      visit(value, nextPath);
    }
  };

  visit(config, 'config');
  return issues;
}

function assertStatus(status: unknown) {
  if (status === undefined) return { ok: true as const, value: undefined };
  if (status !== 'published' && status !== 'unpublished') {
    return { ok: false as const, issues: [{ path: 'status', message: 'invalid status' }] };
  }
  return { ok: true as const, value: status as 'published' | 'unpublished' };
}

async function handleUpdateInstance(req: Request, env: Env, publicId: string) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const workspaceIdResult = assertWorkspaceId(url.searchParams.get('workspaceId'));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  let payload: UpdatePayload;
  try {
    payload = (await req.json()) as UpdatePayload;
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }

  const issues: Array<{ path: string; message: string }> = [];

  const configResult =
    payload.config !== undefined ? assertConfig(payload.config) : { ok: true as const, value: undefined };
  if (!configResult.ok) issues.push(...configResult.issues);
  if (configResult.ok && configResult.value !== undefined) {
    issues.push(...configNonPersistableUrlIssues(configResult.value));
  }

  const statusResult = assertStatus(payload.status);
  if (!statusResult.ok) issues.push(...statusResult.issues);

  if (issues.length) return json(issues, { status: 422 });

  const config = configResult.value;
  const status = statusResult.value;

  if (config === undefined && status === undefined) {
    return json([{ path: 'body', message: 'At least one field (config, status) required' }], {
      status: 422,
    });
  }

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance) return json({ error: 'NOT_FOUND' }, { status: 404 });
  const widgetId = instance.widget_id;
  if (!widgetId) return json({ error: 'WIDGET_NOT_FOUND' }, { status: 500 });

  if (config !== undefined || status !== undefined) {
    const update: Record<string, unknown> = {};
    if (config !== undefined) update.config = config;
    if (status !== undefined) update.status = status;

    const patchRes = await supabaseFetch(
      env,
      `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(publicId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(update),
      },
    );
    if (!patchRes.ok) {
      const details = await readJson(patchRes);
      return json({ error: 'DB_ERROR', details }, { status: 500 });
    }
  }

  return handleGetInstance(req, env, publicId);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (pathname === '/api/healthz') return handleHealthz();

      if (pathname === '/api/usage') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleNotImplemented(req, env, 'usage');
      }

      const submitMatch = pathname.match(/^\/api\/submit\/([^/]+)$/);
      if (submitMatch) {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleNotImplemented(req, env, 'submit');
      }

      if (pathname === '/api/ai/grant') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleAiGrant(req, env);
      }

      if (pathname === '/api/ai/outcome') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleAiOutcome(req, env);
      }

      const workspaceInstancesMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/instances$/);
      if (workspaceInstancesMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceInstancesMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        if (req.method === 'GET') return handleWorkspaceInstances(req, env, workspaceIdResult.value);
        if (req.method === 'POST') return handleWorkspaceCreateInstance(req, env, workspaceIdResult.value);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceInstanceMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/instance\/([^/]+)$/);
      if (workspaceInstanceMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceInstanceMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        const publicId = decodeURIComponent(workspaceInstanceMatch[2]);
        if (req.method === 'GET') return handleWorkspaceGetInstance(req, env, workspaceIdResult.value, publicId);
        if (req.method === 'PUT') return handleWorkspaceUpdateInstance(req, env, workspaceIdResult.value, publicId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      const workspaceWebsiteCreativeMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/website-creative$/);
      if (workspaceWebsiteCreativeMatch) {
        const workspaceIdResult = assertWorkspaceId(decodeURIComponent(workspaceWebsiteCreativeMatch[1]));
        if (!workspaceIdResult.ok) return workspaceIdResult.response;
        if (req.method === 'POST') return handleWorkspaceEnsureWebsiteCreative(req, env, workspaceIdResult.value);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      if (pathname === '/api/widgets') {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleListWidgets(req, env);
      }

      if (pathname === '/api/instances') {
        if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleInstances(req, env);
      }

      if (pathname === '/api/instance') {
        if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
        return handleCreateInstance(req, env);
      }

      const instanceMatch = pathname.match(/^\/api\/instance\/([^/]+)$/);
      if (instanceMatch) {
        const publicId = decodeURIComponent(instanceMatch[1]);
        if (req.method === 'GET') return handleGetInstance(req, env, publicId);
        if (req.method === 'PUT') return handleUpdateInstance(req, env, publicId);
        return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }

      return json({ error: 'NOT_FOUND' }, { status: 404 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: 'SERVER_ERROR', message }, { status: 500 });
    }
  },
};
