import { defineConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const OPEN_EDITOR_CONTRACT_SOURCE_PATH = path.resolve(
  __dirname,
  '..',
  'packages',
  'ck-contracts',
  'editor',
  'open-editor-lifecycle.v1.json',
);
const OPEN_EDITOR_CONTRACT_ROUTE = '/contracts/open-editor-lifecycle.v1.json';
const CK_DEV_PROFILE = String(process.env.CK_DEV_PROFILE || 'product')
  .trim()
  .toLowerCase();
const IS_SOURCE_PROFILE = CK_DEV_PROFILE === 'source';
const PLATFORM_ACCOUNT_ID = String(
  process.env.CK_PLATFORM_ACCOUNT_ID || '00000000-0000-0000-0000-000000000100',
)
  .trim()
  .toLowerCase();
const DEFAULT_PARIS_BASE_URL = String(
  process.env.PARIS_BASE_URL || 'https://paris.dev.clickeen.com',
)
  .trim()
  .replace(/\/+$/, '');
const DEVSTUDIO_INTERNAL_SERVICE_ID = 'devstudio.local';
const ROOT_ENV_LOCAL_PATH = path.resolve(__dirname, '..', '.env.local');
const DEVSTUDIO_ACCESS_COOKIE = 'ck-access-token';
const DEVSTUDIO_REFRESH_COOKIE = 'ck-refresh-token';

let cachedRootEnvLocal: Map<string, string> | null = null;

function readRootEnvLocal(): Map<string, string> {
  if (cachedRootEnvLocal) return cachedRootEnvLocal;
  const values = new Map<string, string>();
  if (!fs.existsSync(ROOT_ENV_LOCAL_PATH)) {
    cachedRootEnvLocal = values;
    return values;
  }
  const raw = fs.readFileSync(ROOT_ENV_LOCAL_PATH, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) return;
    const [, key, remainder] = match;
    let value = remainder.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  });
  cachedRootEnvLocal = values;
  return values;
}

function resolveRootEnvValue(name: string): string {
  const direct = String(process.env[name] || '').trim();
  if (direct) return direct;
  return String(readRootEnvLocal().get(name) || '').trim();
}

function listLocalWidgetCatalog() {
  const widgetsRoot = path.resolve(__dirname, '..', 'tokyo', 'widgets');
  if (!fs.existsSync(widgetsRoot)) return [];
  return fs
    .readdirSync(widgetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name.trim().toLowerCase())
    .filter(Boolean)
    .filter((widgetType) => fs.existsSync(path.join(widgetsRoot, widgetType, 'spec.json')))
    .sort((a, b) => a.localeCompare(b))
    .map((widgetType) => ({ widgetType }));
}

function readRequestBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function readRequestBuffer(req: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function resolveDevstudioParisBaseUrl() {
  return DEFAULT_PARIS_BASE_URL;
}

function resolveDevstudioTokyoBaseUrl() {
  const raw = String(
    process.env.TOKYO_URL || process.env.NEXT_PUBLIC_TOKYO_URL || 'https://tokyo.dev.clickeen.com',
  )
    .trim()
    .replace(/\/+$/, '');
  if (!raw) {
    throw new Error('Missing TOKYO_URL for local DevStudio asset routes.');
  }
  return raw;
}

function resolveDevstudioPlatformAccountId(): string {
  return PLATFORM_ACCOUNT_ID;
}

function resolveDevstudioBerlinBaseUrl(): string {
  const raw = String(
    process.env.BERLIN_BASE_URL || process.env.NEXT_PUBLIC_BERLIN_URL || process.env.BERLIN_URL || '',
  )
    .trim()
    .replace(/\/+$/, '');
  if (raw) return raw;
  return 'http://localhost:3005';
}

function parseCookieHeader(header: string | string[] | undefined): Map<string, string> {
  const values = new Map<string, string>();
  const raw = Array.isArray(header) ? header.join('; ') : String(header || '');
  if (!raw.trim()) return values;
  raw.split(';').forEach((entry) => {
    const [rawName, ...rest] = entry.trim().split('=');
    if (!rawName) return;
    const joined = rest.join('=').trim();
    if (!joined) return;
    try {
      values.set(rawName, decodeURIComponent(joined));
    } catch {
      values.set(rawName, joined);
    }
  });
  return values;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadPart = parts[1] || '';
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tokenIsExpired(token: string, leewaySeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  const expClaim = payload?.exp;
  const exp =
    typeof expClaim === 'number'
      ? expClaim
      : typeof expClaim === 'string'
        ? Number.parseInt(expClaim, 10)
        : Number.NaN;
  if (!Number.isFinite(exp)) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + leewaySeconds;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

type DevstudioSessionCookieSpec = {
  name: string;
  value: string;
  maxAge: number;
};

type DevstudioBootstrapPayload = {
  user?: {
    id?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  profile?: {
    userId?: string | null;
    primaryEmail?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    primaryLanguage?: string | null;
    country?: string | null;
    timezone?: string | null;
  } | null;
  accounts?: Array<{
    accountId?: string | null;
    role?: string | null;
    name?: string | null;
    slug?: string | null;
    status?: string | null;
    tier?: string | null;
    isPlatform?: boolean | null;
  }> | null;
  defaults?: {
    accountId?: string | null;
  } | null;
};

type DevstudioBerlinAccess =
  | {
      kind: 'ok';
      accessToken: string;
      setCookies?: DevstudioSessionCookieSpec[];
    }
  | {
      kind: 'no-session';
    }
  | {
      kind: 'error';
      status: number;
      body: Record<string, unknown>;
      setCookies?: DevstudioSessionCookieSpec[];
    };

type DevstudioPlatformContext =
  | {
      ok: true;
      accountId: string;
      scope: 'platform';
      mode: 'trusted-local';
    }
  | {
      ok: true;
      accountId: string;
      scope: 'platform';
      mode: 'berlin-session';
      user?: DevstudioBootstrapPayload['user'];
      profile?: DevstudioBootstrapPayload['profile'];
      defaults?: DevstudioBootstrapPayload['defaults'];
      setCookies?: DevstudioSessionCookieSpec[];
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
      setCookies?: DevstudioSessionCookieSpec[];
    };

async function refreshDevstudioBerlinSession(
  refreshToken: string,
): Promise<
  | {
      ok: true;
      accessToken: string;
      setCookies: DevstudioSessionCookieSpec[];
    }
  | { ok: false }
> {
  const response = await fetch(`${resolveDevstudioBerlinBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !payload) return { ok: false };

  const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken.trim() : '';
  const nextRefreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';
  if (!accessToken || !nextRefreshToken) return { ok: false };

  return {
    ok: true,
    accessToken,
    setCookies: [
      {
        name: DEVSTUDIO_ACCESS_COOKIE,
        value: accessToken,
        maxAge: parsePositiveInt(payload.accessTokenMaxAge, 15 * 60),
      },
      {
        name: DEVSTUDIO_REFRESH_COOKIE,
        value: nextRefreshToken,
        maxAge: parsePositiveInt(payload.refreshTokenMaxAge, 30 * 24 * 60 * 60),
      },
    ],
  };
}

async function resolveDevstudioBerlinAccess(req: any): Promise<DevstudioBerlinAccess> {
  const cookies = parseCookieHeader(req.headers.cookie);
  let accessToken = String(cookies.get(DEVSTUDIO_ACCESS_COOKIE) || '').trim();
  const refreshToken = String(cookies.get(DEVSTUDIO_REFRESH_COOKIE) || '').trim();
  let setCookies: DevstudioSessionCookieSpec[] | undefined;

  if (!accessToken && !refreshToken) return { kind: 'no-session' };

  if ((!accessToken || tokenIsExpired(accessToken)) && refreshToken) {
    const refreshed = await refreshDevstudioBerlinSession(refreshToken);
    if (!refreshed.ok) {
      return {
        kind: 'error',
        status: 401,
        body: {
          error: {
            kind: 'AUTH',
            reasonKey: 'coreui.errors.auth.required',
            detail: 'devstudio_berlin_refresh_failed',
          },
        },
      };
    }
    accessToken = refreshed.accessToken;
    setCookies = refreshed.setCookies;
  }

  if (!accessToken) return { kind: 'no-session' };

  return {
    kind: 'ok',
    accessToken,
    ...(setCookies?.length ? { setCookies } : {}),
  };
}

async function fetchDevstudioBerlinBootstrap(args: {
  accessToken: string;
}): Promise<
  | {
      ok: true;
      payload: DevstudioBootstrapPayload;
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    }
> {
  const response = await fetch(`${resolveDevstudioBerlinBaseUrl()}/v1/session/bootstrap`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${args.accessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as
    | (DevstudioBootstrapPayload & { error?: unknown })
    | null;
  if (!response.ok || !payload) {
    return {
      ok: false,
      status: response.status || 502,
      body:
        payload && typeof payload === 'object'
          ? payload
          : {
              error: {
                kind: response.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
                reasonKey:
                  response.status === 401
                    ? 'coreui.errors.auth.required'
                    : 'coreui.errors.auth.contextUnavailable',
                detail: 'devstudio_berlin_bootstrap_failed',
              },
            },
    };
  }

  return {
    ok: true,
    payload,
  };
}

async function resolveDevstudioBerlinBootstrap(req: any): Promise<{
  kind: 'ok';
  payload: DevstudioBootstrapPayload;
  setCookies?: DevstudioSessionCookieSpec[];
} | {
  kind: 'no-session';
} | {
  kind: 'error';
  status: number;
  body: Record<string, unknown>;
  setCookies?: DevstudioSessionCookieSpec[];
}> {
  const access = await resolveDevstudioBerlinAccess(req);
  if (access.kind !== 'ok') return access;

  const bootstrap = await fetchDevstudioBerlinBootstrap({
    accessToken: access.accessToken,
  });
  if (!bootstrap.ok) {
    return {
      kind: 'error',
      status: bootstrap.status,
      body: bootstrap.body,
      ...(access.setCookies?.length ? { setCookies: access.setCookies } : {}),
    };
  }

  return {
    kind: 'ok',
    payload: bootstrap.payload,
    ...(access.setCookies?.length ? { setCookies: access.setCookies } : {}),
  };
}

function findDevstudioPlatformAccount(
  payload: DevstudioBootstrapPayload,
  platformAccountId: string,
) {
  const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
  return accounts.find((entry) => String(entry?.accountId || '').trim() === platformAccountId) || null;
}

function appendDevstudioSessionCookies(res: any, cookies?: DevstudioSessionCookieSpec[]) {
  if (!cookies?.length) return;
  const serialized = cookies.map(
    (cookie) =>
      `${cookie.name}=${encodeURIComponent(cookie.value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cookie.maxAge}`,
  );
  res.setHeader('Set-Cookie', serialized);
}

function readDevstudioContextCookies(context: DevstudioPlatformContext): DevstudioSessionCookieSpec[] | undefined {
  return 'setCookies' in context ? context.setCookies : undefined;
}

async function resolveDevstudioPlatformContext(req: any): Promise<DevstudioPlatformContext> {
  const platformAccountId = resolveDevstudioPlatformAccountId();
  const bootstrap = await resolveDevstudioBerlinBootstrap(req);
  if (bootstrap.kind === 'no-session') {
    return {
      ok: true,
      accountId: platformAccountId,
      scope: 'platform',
      mode: 'trusted-local',
    };
  }
  if (bootstrap.kind === 'error') {
    return {
      ok: false,
      status: bootstrap.status,
      body: bootstrap.body,
      ...(bootstrap.setCookies?.length ? { setCookies: bootstrap.setCookies } : {}),
    };
  }

  const platformAccount = findDevstudioPlatformAccount(bootstrap.payload, platformAccountId);
  if (!platformAccount) {
    return {
      ok: false,
      status: 403,
      body: {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.errors.auth.forbidden',
          detail: 'platform_account_membership_required',
        },
      },
      ...(bootstrap.setCookies?.length ? { setCookies: bootstrap.setCookies } : {}),
    };
  }

  return {
    ok: true,
    accountId: platformAccountId,
    scope: 'platform',
    mode: 'berlin-session',
    user: bootstrap.payload.user ?? null,
    profile: bootstrap.payload.profile ?? null,
    defaults: bootstrap.payload.defaults ?? null,
    ...(bootstrap.setCookies?.length ? { setCookies: bootstrap.setCookies } : {}),
  };
}

async function resolveDevstudioBerlinOperatorAccess(req: any): Promise<
  | {
      ok: true;
      accessToken: string;
      bootstrap: DevstudioBootstrapPayload;
      setCookies?: DevstudioSessionCookieSpec[];
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
      setCookies?: DevstudioSessionCookieSpec[];
    }
> {
  const access = await resolveDevstudioBerlinAccess(req);
  if (access.kind === 'no-session') {
    return {
      ok: false,
      status: 401,
      body: {
        error: {
          kind: 'AUTH',
          reasonKey: 'coreui.errors.auth.required',
          detail: 'devstudio_berlin_session_required',
        },
      },
    };
  }
  if (access.kind === 'error') {
    return {
      ok: false,
      status: access.status,
      body: access.body,
      ...(access.setCookies?.length ? { setCookies: access.setCookies } : {}),
    };
  }

  const bootstrap = await fetchDevstudioBerlinBootstrap({
    accessToken: access.accessToken,
  });
  if (!bootstrap.ok) {
    return {
      ok: false,
      status: bootstrap.status,
      body: bootstrap.body,
      ...(access.setCookies?.length ? { setCookies: access.setCookies } : {}),
    };
  }

  const platformAccount = findDevstudioPlatformAccount(
    bootstrap.payload,
    resolveDevstudioPlatformAccountId(),
  );
  if (!platformAccount) {
    return {
      ok: false,
      status: 403,
      body: {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.errors.auth.forbidden',
          detail: 'platform_account_membership_required',
        },
      },
      ...(access.setCookies?.length ? { setCookies: access.setCookies } : {}),
    };
  }

  return {
    ok: true,
    accessToken: access.accessToken,
    bootstrap: bootstrap.payload,
    ...(access.setCookies?.length ? { setCookies: access.setCookies } : {}),
  };
}

function createDevstudioParisHeaders(initHeaders?: HeadersInit): Headers {
  const token = resolveRootEnvValue('PARIS_DEV_JWT');
  if (!token) {
    throw new Error('Missing PARIS_DEV_JWT for local DevStudio instance routes.');
  }

  const headers = new Headers(initHeaders || {});
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-ck-internal-service', DEVSTUDIO_INTERNAL_SERVICE_ID);
  return headers;
}

function createDevstudioTokyoHeaders(initHeaders?: HeadersInit): Headers {
  const token = resolveRootEnvValue('TOKYO_DEV_JWT') || resolveRootEnvValue('PARIS_DEV_JWT');
  if (!token) {
    throw new Error('Missing TOKYO_DEV_JWT for local DevStudio asset routes.');
  }

  const headers = new Headers(initHeaders || {});
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-ck-internal-service', DEVSTUDIO_INTERNAL_SERVICE_ID);
  return headers;
}

async function proxyDevstudioParisJson(args: {
  req: any;
  res: any;
  pathname: string;
  method?: string;
  body?: string;
  headers?: HeadersInit;
}) {
  const upstream = await fetch(`${resolveDevstudioParisBaseUrl()}${args.pathname}`, {
    method: args.method || args.req.method || 'GET',
    headers: createDevstudioParisHeaders(args.headers),
    body: args.body,
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  args.res.statusCode = upstream.status;
  args.res.setHeader('Content-Type', contentType);
  args.res.setHeader('Cache-Control', 'no-store');
  args.res.end(text);
}

async function proxyDevstudioBerlinJson(args: {
  req: any;
  res: any;
  accessToken: string;
  pathname: string;
  method?: string;
  body?: string;
  headers?: HeadersInit;
}) {
  const upstream = await fetch(`${resolveDevstudioBerlinBaseUrl()}${args.pathname}`, {
    method: args.method || args.req.method || 'GET',
    headers: {
      authorization: `Bearer ${args.accessToken}`,
      accept: 'application/json',
      ...(args.method === 'POST' || args.method === 'PUT' || args.method === 'PATCH'
        ? { 'content-type': 'application/json' }
        : {}),
      ...(args.headers || {}),
    },
    body: args.body,
    cache: 'no-store',
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  args.res.statusCode = upstream.status;
  args.res.setHeader('Content-Type', contentType);
  args.res.setHeader('Cache-Control', 'no-store');
  args.res.end(text);
}

async function proxyDevstudioTokyo(args: {
  req: any;
  res: any;
  pathname: string;
  method?: string;
  body?: Buffer;
  headers?: HeadersInit;
}) {
  const upstream = await fetch(`${resolveDevstudioTokyoBaseUrl()}${args.pathname}`, {
    method: args.method || args.req.method || 'GET',
    headers: createDevstudioTokyoHeaders(args.headers),
    body: args.body,
    cache: 'no-store',
  } as RequestInit);

  const bytes = Buffer.from(await upstream.arrayBuffer());
  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  args.res.statusCode = upstream.status;
  args.res.setHeader('Content-Type', contentType);
  args.res.setHeader('Cache-Control', 'no-store');
  args.res.end(bytes);
}

const DEVSTUDIO_ALLOWED_ASSET_ORIGINS = new Set([
  'https://bob.dev.clickeen.com',
  'https://bob.clickeen.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const DEVSTUDIO_ASSET_ALLOW_HEADERS = [
  'authorization',
  'content-type',
  'x-account-id',
  'x-public-id',
  'x-widget-type',
  'x-filename',
  'x-source',
  'x-clickeen-surface',
  'x-request-id',
].join(', ');

function applyDevstudioAssetCors(req: any, res: any) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (origin && DEVSTUDIO_ALLOWED_ASSET_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin, Access-Control-Request-Private-Network');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', DEVSTUDIO_ASSET_ALLOW_HEADERS);
  if (
    String(req.headers['access-control-request-private-network'] || '')
      .trim()
      .toLowerCase() === 'true'
  ) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 2000,
  },
  resolve: {
    alias: {
      '@dieter': path.resolve(__dirname, '../dieter'),
    },
  },
  server: {
    port: 5173,
    open: true,
    cors: false,
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '..')],
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    },
  },
  plugins: [
    {
      name: 'devstudio-context-route',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || '';
          const pathname = url.split('?')[0] || '';
          if (pathname !== '/api/devstudio/context' || req.method !== 'GET') return next();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          try {
            const context = await resolveDevstudioPlatformContext(req);
            appendDevstudioSessionCookies(res, readDevstudioContextCookies(context));
            if (!context.ok) {
              res.statusCode = context.status;
              res.end(JSON.stringify(context.body));
              return;
            }

            res.statusCode = 200;
            res.end(
              JSON.stringify({
                accountId: context.accountId,
                scope: context.scope,
                mode: context.mode,
                ...(context.mode === 'berlin-session'
                  ? {
                      user: context.user ?? null,
                      profile: context.profile ?? null,
                      defaults: context.defaults ?? null,
                    }
                  : {}),
              }),
            );
          } catch (error) {
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                error: {
                  kind: 'INTERNAL',
                  reasonKey: 'coreui.errors.auth.contextUnavailable',
                  detail: error instanceof Error ? error.message : String(error),
                },
              }),
            );
          }
        });
      },
    },
    {
      name: 'devstudio-account-routes',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const rawUrl = req.url || '';
          const requestUrl = new URL(rawUrl || '/', 'http://localhost:5173');
          const pathname = requestUrl.pathname || '';
          const accountDetailMatch = pathname.match(/^\/api\/devstudio\/accounts\/([^/]+)$/);
          const accountMembersMatch = pathname.match(/^\/api\/devstudio\/accounts\/([^/]+)\/members$/);
          const accountSwitchMatch = pathname.match(/^\/api\/devstudio\/accounts\/([^/]+)\/switch$/);

          const wantsList = pathname === '/api/devstudio/accounts' && req.method === 'GET';
          const wantsCreate = pathname === '/api/devstudio/accounts' && req.method === 'POST';
          const wantsDetail = Boolean(accountDetailMatch && req.method === 'GET');
          const wantsMembers = Boolean(accountMembersMatch && req.method === 'GET');
          const wantsSwitch = Boolean(accountSwitchMatch && req.method === 'POST');

          if (!wantsList && !wantsCreate && !wantsDetail && !wantsMembers && !wantsSwitch) {
            return next();
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');

          try {
            const operatorAccess = await resolveDevstudioBerlinOperatorAccess(req);
            appendDevstudioSessionCookies(res, operatorAccess.ok ? operatorAccess.setCookies : operatorAccess.setCookies);
            if (!operatorAccess.ok) {
              res.statusCode = operatorAccess.status;
              res.end(JSON.stringify(operatorAccess.body));
              return;
            }

            if (wantsList) {
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  user: operatorAccess.bootstrap.user ?? null,
                  profile: operatorAccess.bootstrap.profile ?? null,
                  accounts: Array.isArray(operatorAccess.bootstrap.accounts)
                    ? operatorAccess.bootstrap.accounts
                    : [],
                  defaults: operatorAccess.bootstrap.defaults ?? { accountId: null },
                }),
              );
              return;
            }

            if (wantsCreate) {
              const body = await readRequestBody(req);
              return await proxyDevstudioBerlinJson({
                req,
                res,
                accessToken: operatorAccess.accessToken,
                pathname: '/v1/accounts',
                method: 'POST',
                body,
              });
            }

            if (wantsDetail && accountDetailMatch) {
              const accountId = encodeURIComponent(decodeURIComponent(accountDetailMatch[1] || ''));
              return await proxyDevstudioBerlinJson({
                req,
                res,
                accessToken: operatorAccess.accessToken,
                pathname: `/v1/accounts/${accountId}`,
                method: 'GET',
              });
            }

            if (wantsMembers && accountMembersMatch) {
              const accountId = encodeURIComponent(decodeURIComponent(accountMembersMatch[1] || ''));
              return await proxyDevstudioBerlinJson({
                req,
                res,
                accessToken: operatorAccess.accessToken,
                pathname: `/v1/accounts/${accountId}/members`,
                method: 'GET',
              });
            }

            if (wantsSwitch && accountSwitchMatch) {
              const accountId = encodeURIComponent(decodeURIComponent(accountSwitchMatch[1] || ''));
              return await proxyDevstudioBerlinJson({
                req,
                res,
                accessToken: operatorAccess.accessToken,
                pathname: `/v1/accounts/${accountId}/switch`,
                method: 'POST',
                body: '{}',
              });
            }
          } catch (error) {
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                error: {
                  kind: 'INTERNAL',
                  reasonKey: 'coreui.errors.auth.contextUnavailable',
                  detail: error instanceof Error ? error.message : String(error),
                },
              }),
            );
            return;
          }

          return next();
        });
      },
    },
    {
      name: 'devstudio-widget-catalog',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const pathname = url.split('?')[0] || '';
          if (pathname !== '/api/devstudio/widgets' || req.method !== 'GET') return next();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          try {
            const widgets = listLocalWidgetCatalog();
            res.statusCode = 200;
            res.end(JSON.stringify({ widgets }));
          } catch (error) {
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                error: {
                  kind: 'INTERNAL',
                  reasonKey: 'coreui.errors.widgetCatalog.readFailed',
                  detail: error instanceof Error ? error.message : String(error),
                },
              }),
            );
          }
        });
      },
    },
    {
      name: 'devstudio-instance-routes',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const rawUrl = req.url || '';
          const requestUrl = new URL(rawUrl || '/', 'http://localhost:5173');
          const pathname = requestUrl.pathname || '';
          const accountId = resolveDevstudioPlatformAccountId();

          const statusMatch = pathname.match(
            /^\/api\/devstudio\/instances\/([^/]+)\/l10n\/status$/,
          );
          const wantsList = pathname === '/api/devstudio/instances' && req.method === 'GET';
          const wantsStatus = Boolean(statusMatch && req.method === 'GET');

          if (!wantsList && !wantsStatus) {
            return next();
          }

          try {
            const context = await resolveDevstudioPlatformContext(req);
            appendDevstudioSessionCookies(res, readDevstudioContextCookies(context));
            if (!context.ok) {
              res.statusCode = context.status;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Cache-Control', 'no-store');
              res.end(JSON.stringify(context.body));
              return;
            }

            if (wantsList) {
              return await proxyDevstudioParisJson({
                req,
                res,
                pathname: `/api/roma/widgets?accountId=${encodeURIComponent(accountId)}`,
                method: 'GET',
                headers: { accept: 'application/json' },
              });
            }

            if (wantsStatus && statusMatch) {
              const publicId = decodeURIComponent(statusMatch[1] || '');
              try {
                const upstream = await fetch(
                  `${resolveDevstudioParisBaseUrl()}/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(
                    publicId,
                  )}/l10n/status?subject=account`,
                  {
                    method: 'GET',
                    headers: createDevstudioParisHeaders({ accept: 'application/json' }),
                    cache: 'no-store',
                  },
                );
                const text = await upstream.text();
                if (upstream.ok) {
                  const contentType =
                    upstream.headers.get('content-type') || 'application/json; charset=utf-8';
                  res.statusCode = upstream.status;
                  res.setHeader('Content-Type', contentType);
                  res.setHeader('Cache-Control', 'no-store');
                  res.end(text);
                  return;
                }
              } catch {}

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Cache-Control', 'no-store');
              res.end(
                JSON.stringify({
                  publicId,
                  unavailable: true,
                  locales: [],
                  error: {
                    reasonKey: 'coreui.errors.devstudio.l10nStatusUnavailable',
                    detail: 'Translations status unavailable.',
                  },
                }),
              );
              return;
            }
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(
              JSON.stringify({
                error: {
                  kind: 'INTERNAL',
                  reasonKey: 'coreui.errors.devstudio.instanceProxyFailed',
                  detail: error instanceof Error ? error.message : String(error),
                },
              }),
            );
            return;
          }

          return next();
        });
      },
    },
    {
      name: 'devstudio-asset-routes',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const rawUrl = req.url || '';
          const requestUrl = new URL(rawUrl || '/', 'http://localhost:5173');
          const pathname = requestUrl.pathname || '';

          if (!pathname.startsWith('/api/devstudio/assets')) return next();

          applyDevstudioAssetCors(req, res);

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          const listMatch = pathname.match(/^\/api\/devstudio\/assets\/([^/]+)$/);
          const deleteMatch = pathname.match(/^\/api\/devstudio\/assets\/([^/]+)\/([^/]+)$/);
          const wantsUpload = pathname === '/api/devstudio/assets/upload' && req.method === 'POST';
          const wantsList = Boolean(listMatch && req.method === 'GET');
          const wantsDelete = Boolean(deleteMatch && req.method === 'DELETE');

          if (!wantsUpload && !wantsList && !wantsDelete) return next();

          try {
            if (wantsUpload) {
              const body = await readRequestBuffer(req);
              const headers = new Headers();
              const forwardHeader = (name: string) => {
                const value = req.headers[name];
                if (typeof value === 'string' && value.trim()) headers.set(name, value.trim());
              };
              forwardHeader('content-type');
              forwardHeader('x-account-id');
              forwardHeader('x-filename');
              forwardHeader('x-source');
              forwardHeader('x-clickeen-surface');
              forwardHeader('x-public-id');
              forwardHeader('x-widget-type');
              return await proxyDevstudioTokyo({
                req,
                res,
                pathname: '/assets/upload',
                method: 'POST',
                body,
                headers,
              });
            }

            if (wantsList && listMatch) {
              const accountId = decodeURIComponent(listMatch[1] || '');
              const search = requestUrl.searchParams.toString();
              return await proxyDevstudioTokyo({
                req,
                res,
                pathname: `/assets/account/${encodeURIComponent(accountId)}${search ? `?${search}` : ''}`,
                method: 'GET',
                headers: { accept: 'application/json' },
              });
            }

            if (wantsDelete && deleteMatch) {
              const accountId = decodeURIComponent(deleteMatch[1] || '');
              const assetId = decodeURIComponent(deleteMatch[2] || '');
              return await proxyDevstudioTokyo({
                req,
                res,
                pathname: `/assets/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}`,
                method: 'DELETE',
                headers: { accept: 'application/json' },
              });
            }
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(
              JSON.stringify({
                error: {
                  kind: 'INTERNAL',
                  reasonKey: 'coreui.errors.devstudio.assetProxyFailed',
                  detail: error instanceof Error ? error.message : String(error),
                },
              }),
            );
            return;
          }

          return next();
        });
      },
    },
    {
      name: 'open-editor-lifecycle-contract',
      buildStart() {
        if (!fs.existsSync(OPEN_EDITOR_CONTRACT_SOURCE_PATH)) {
          this.error(`Missing contract artifact: ${OPEN_EDITOR_CONTRACT_SOURCE_PATH}`);
        }
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const pathname = (req.url || '').split('?')[0] || '';
          if (pathname !== OPEN_EDITOR_CONTRACT_ROUTE) return next();
          try {
            const raw = fs.readFileSync(OPEN_EDITOR_CONTRACT_SOURCE_PATH, 'utf8');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(raw);
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                error: {
                  kind: 'INTERNAL',
                  reasonKey: 'coreui.errors.contract.readFailed',
                  detail: error instanceof Error ? error.message : String(error),
                },
              }),
            );
          }
        });
      },
      generateBundle() {
        const raw = fs.readFileSync(OPEN_EDITOR_CONTRACT_SOURCE_PATH, 'utf8');
        this.emitFile({
          type: 'asset',
          fileName: 'contracts/open-editor-lifecycle.v1.json',
          source: raw,
        });
      },
    },
    {
      name: 'local-edit-entitlements-matrix',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const pathname = url.split('?')[0] || '';

          const wantsGet = pathname === '/api/entitlements/matrix' && req.method === 'GET';
          const wantsUpdateCell =
            pathname === '/api/entitlements/matrix/cell' && req.method === 'POST';
          if (!wantsGet && !wantsUpdateCell) return next();

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');

          const matrixPath = path.resolve(__dirname, '..', 'packages', 'ck-policy', 'entitlements.matrix.json');

          const readMatrix = () => {
            if (!fs.existsSync(matrixPath)) {
              res.statusCode = 404;
              res.end(
                JSON.stringify({
                  error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.entitlements.notFound' },
                }),
              );
              return null;
            }
            const raw = fs.readFileSync(matrixPath, 'utf8');
            return JSON.parse(raw);
          };

          if (wantsGet) {
            try {
              const matrix = readMatrix();
              if (!matrix) return;
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, path: matrixPath, matrix }));
            } catch (error) {
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'INTERNAL',
                    reasonKey: 'coreui.errors.db.readFailed',
                    detail: error instanceof Error ? error.message : String(error),
                  },
                }),
              );
            }
            return;
          }

          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            let payload: any;
            try {
              payload = body ? JSON.parse(body) : null;
            } catch (_err) {
              res.statusCode = 422;
              res.end(
                JSON.stringify({
                  error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' },
                }),
              );
              return;
            }

            const capabilityKey = String(payload?.capabilityKey || '').trim();
            const tier = String(payload?.tier || '').trim();
            const value = payload?.value as unknown;

            if (!capabilityKey) {
              res.statusCode = 422;
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'VALIDATION',
                    reasonKey: 'coreui.errors.entitlements.capabilityKey.invalid',
                  },
                }),
              );
              return;
            }

            if (!tier) {
              res.statusCode = 422;
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'VALIDATION',
                    reasonKey: 'coreui.errors.entitlements.tier.invalid',
                  },
                }),
              );
              return;
            }

            try {
              const matrix = readMatrix();
              if (!matrix) return;

              const tiers = Array.isArray(matrix?.tiers) ? (matrix.tiers as string[]) : [];
              if (!tiers.includes(tier)) {
                res.statusCode = 422;
                res.end(
                  JSON.stringify({
                    error: {
                      kind: 'VALIDATION',
                      reasonKey: 'coreui.errors.entitlements.tier.unknown',
                      detail: tier,
                    },
                  }),
                );
                return;
              }

              const cap = matrix?.capabilities?.[capabilityKey];
              if (!cap || typeof cap !== 'object') {
                res.statusCode = 404;
                res.end(
                  JSON.stringify({
                    error: {
                      kind: 'NOT_FOUND',
                      reasonKey: 'coreui.errors.entitlements.capability.notFound',
                    },
                  }),
                );
                return;
              }

              const kind = String((cap as any).kind || '').trim();
              if (kind === 'flag') {
                if (typeof value !== 'boolean') {
                  res.statusCode = 422;
                  res.end(
                    JSON.stringify({
                      error: {
                        kind: 'VALIDATION',
                        reasonKey: 'coreui.errors.entitlements.value.invalid',
                        detail: 'expected boolean',
                      },
                    }),
                  );
                  return;
                }
              } else if (kind === 'cap' || kind === 'budget') {
                if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
                  res.statusCode = 422;
                  res.end(
                    JSON.stringify({
                      error: {
                        kind: 'VALIDATION',
                        reasonKey: 'coreui.errors.entitlements.value.invalid',
                        detail: 'expected number or null',
                      },
                    }),
                  );
                  return;
                }
              } else {
                res.statusCode = 500;
                res.end(
                  JSON.stringify({
                    error: {
                      kind: 'INTERNAL',
                      reasonKey: 'coreui.errors.entitlements.kind.invalid',
                      detail: kind,
                    },
                  }),
                );
                return;
              }

              if (!cap.values || typeof cap.values !== 'object') (cap as any).values = {};
              (cap as any).values[tier] = value;

              fs.writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');

              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, capabilityKey, tier, value }));
            } catch (error) {
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'INTERNAL',
                    reasonKey: 'coreui.errors.db.writeFailed',
                    detail: error instanceof Error ? error.message : String(error),
                  },
                }),
              );
            }
          });
        });
      },
    },
    {
      name: 'tokyo-update-theme',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const pathname = url.split('?')[0] || '';
          const wantsList = pathname === '/api/themes/list' && req.method === 'GET';
          const wantsUpdate = pathname === '/api/themes/update' && req.method === 'POST';
          if (!wantsList && !wantsUpdate) return next();

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          if (!IS_SOURCE_PROFILE) {
            res.statusCode = 404;
            res.end(
              JSON.stringify({
                error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.route.notFound' },
              }),
            );
            return;
          }

          const themesPath = path.resolve(__dirname, '..', 'tokyo', 'themes', 'themes.json');

          if (wantsList) {
            try {
              if (!fs.existsSync(themesPath)) {
                res.statusCode = 404;
                res.end(
                  JSON.stringify({
                    error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.theme.notFound' },
                  }),
                );
                return;
              }

              const raw = fs.readFileSync(themesPath, 'utf8');
              const json = JSON.parse(raw);
              const themes = Array.isArray(json?.themes) ? json.themes : [];
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  themes: themes
                    .map((theme) => ({
                      id: String(theme?.id || '').trim(),
                      label: String(theme?.label || '').trim(),
                    }))
                    .filter((theme) => Boolean(theme.id)),
                }),
              );
            } catch (error) {
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'INTERNAL',
                    reasonKey: 'coreui.errors.db.readFailed',
                    detail: error instanceof Error ? error.message : String(error),
                  },
                }),
              );
            }
            return;
          }

          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            let payload: any;
            try {
              payload = body ? JSON.parse(body) : null;
            } catch (err) {
              res.statusCode = 422;
              res.end(
                JSON.stringify({
                  error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' },
                }),
              );
              return;
            }

            const themeId = String(payload?.themeId || '')
              .trim()
              .toLowerCase();
            if (!themeId || !/^[a-z0-9][a-z0-9_-]*$/.test(themeId) || themeId === 'custom') {
              res.statusCode = 422;
              res.end(
                JSON.stringify({
                  error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.theme.invalid' },
                }),
              );
              return;
            }

            const values = payload?.values;
            if (!values || typeof values !== 'object' || Array.isArray(values)) {
              res.statusCode = 422;
              res.end(
                JSON.stringify({
                  error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' },
                }),
              );
              return;
            }

            const allowedPrefixes = ['stage.', 'pod.', 'appearance.', 'typography.'];
            const invalidKeys = Object.keys(values).filter(
              (key) => !allowedPrefixes.some((prefix) => key.startsWith(prefix)),
            );
            if (invalidKeys.length) {
              res.statusCode = 422;
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'VALIDATION',
                    reasonKey: 'coreui.errors.payload.invalid',
                    detail: `Invalid theme path(s): ${invalidKeys.join(', ')}`,
                  },
                }),
              );
              return;
            }

            const containsNonPersistableUrl = (value: string): boolean => {
              return /(?:^|[\s("'=,])(?:data|blob):/i.test(value);
            };
            const containsLegacyTokyoAssetUrl = (value: string): boolean => {
              const isLegacyPath = (candidate: string): boolean => {
                const trimmed = String(candidate || '').trim();
                if (!trimmed) return false;
                if (/^\/(?:workspace-assets|curated-assets|assets\/accounts)\//i.test(trimmed))
                  return true;
                if (!/^https?:\/\//i.test(trimmed)) return false;
                try {
                  return /^\/(?:workspace-assets|curated-assets|assets\/accounts)\//i.test(
                    new URL(trimmed).pathname,
                  );
                } catch {
                  return false;
                }
              };

              if (isLegacyPath(value)) return true;
              const m = value.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
              return Boolean(m?.[2] && isLegacyPath(m[2]));
            };

            const issues: Array<{ path: string; message: string }> = [];
            const visit = (node: any, nodePath: string) => {
              if (typeof node === 'string') {
                if (containsNonPersistableUrl(node)) {
                  issues.push({
                    path: nodePath,
                    message:
                      'non-persistable URL scheme found (data:/blob:). Persist stable URLs/keys only.',
                  });
                } else if (containsLegacyTokyoAssetUrl(node)) {
                  issues.push({
                    path: nodePath,
                    message:
                      'legacy Tokyo asset URL found. Use canonical /assets/v/{token} URLs only.',
                  });
                }
                return;
              }
              if (!node || typeof node !== 'object') return;
              if (Array.isArray(node)) {
                for (let i = 0; i < node.length; i += 1) visit(node[i], `${nodePath}[${i}]`);
                return;
              }
              for (const [key, value] of Object.entries(node)) {
                const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
                  ? `${nodePath}.${key}`
                  : `${nodePath}[${JSON.stringify(key)}]`;
                visit(value, nextPath);
              }
            };
            visit(values, 'values');

            if (issues.length) {
              res.statusCode = 422;
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'VALIDATION',
                    reasonKey: 'coreui.errors.publish.nonPersistableUrl',
                    detail: issues[0]?.message,
                    paths: issues.map((i) => i.path),
                  },
                }),
              );
              return;
            }

            try {
              if (!fs.existsSync(themesPath)) {
                res.statusCode = 404;
                res.end(
                  JSON.stringify({
                    error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.theme.notFound' },
                  }),
                );
                return;
              }
              const raw = fs.readFileSync(themesPath, 'utf8');
              const json = JSON.parse(raw);
              const themes = Array.isArray(json?.themes) ? json.themes : [];
              const index = themes.findIndex(
                (theme) => String(theme?.id || '').toLowerCase() === themeId,
              );
              if (index < 0) {
                res.statusCode = 404;
                res.end(
                  JSON.stringify({
                    error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.theme.notFound' },
                  }),
                );
                return;
              }
              const current = themes[index] || {};
              const mergedValues = { ...(current.values || {}), ...values };
              themes[index] = { ...current, values: mergedValues };
              json.themes = themes;
              fs.writeFileSync(themesPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, themeId, themesPath }));
            } catch (error) {
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'INTERNAL',
                    reasonKey: 'coreui.errors.db.writeFailed',
                    detail: error instanceof Error ? error.message : String(error),
                  },
                }),
              );
            }
          });
        });
      },
    },
    {
      name: 'rebuild-icons-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/rebuild-icons' && req.method === 'POST') {
            res.setHeader('Content-Type', 'application/json');

            const rebuildScript = path.resolve(__dirname, '..', 'scripts', 'rebuild-icons.js');
            const child = spawn('node', [rebuildScript], {
              cwd: path.resolve(__dirname, '..'),
            });

            let output = '';
            let errorOutput = '';

            child.stdout?.on('data', (data) => {
              output += data.toString();
              console.log(data.toString());
            });

            child.stderr?.on('data', (data) => {
              errorOutput += data.toString();
              console.error(data.toString());
            });

            child.on('close', (code) => {
              if (code === 0) {
                res.end(JSON.stringify({ success: true, output }));
              } else {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: errorOutput || output }));
              }
            });

            child.on('error', (error) => {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: error.message }));
            });
          } else {
            next();
          }
        });
      },
    },
    {
      name: 'tokyo-static-widgets',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          if (!url.startsWith('/tokyo/')) return next();

          const cleanPath = url.split('?')[0];
          const filePath = path.resolve(__dirname, '..', cleanPath.slice(1)); // strip leading "/"

          fs.readFile(filePath, (err, data) => {
            if (err) {
              res.statusCode = 404;
              res.end('Not found');
              return;
            }

            const ext = path.extname(filePath);
            if (ext === '.json') {
              res.setHeader('Content-Type', 'application/json');
            } else if (ext === '.html') {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
            } else if (ext === '.css') {
              res.setHeader('Content-Type', 'text/css; charset=utf-8');
            } else if (ext === '.js') {
              res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
            }

            res.end(data);
          });
        });
      },
    },
  ],
});
