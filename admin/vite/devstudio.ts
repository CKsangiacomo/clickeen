import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

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

type DevstudioPluginOptions = {
  rootDir: string;
  internalServiceId: string;
  platformAccountId: string;
};

type DevstudioPlatformContext =
  | {
      ok: true;
      accountId: string;
      scope: 'platform';
      mode: 'local-tool';
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    };

export function createDevstudioPlugins(options: DevstudioPluginOptions): Plugin[] {
  const rootEnvLocalPath = path.resolve(options.rootDir, '.env.local');
  const widgetsRoot = path.resolve(options.rootDir, 'tokyo', 'widgets');
  let cachedRootEnvLocal: Map<string, string> | null = null;

  function readRootEnvLocal(): Map<string, string> {
    if (cachedRootEnvLocal) return cachedRootEnvLocal;
    const values = new Map<string, string>();
    if (!fs.existsSync(rootEnvLocalPath)) {
      cachedRootEnvLocal = values;
      return values;
    }
    const raw = fs.readFileSync(rootEnvLocalPath, 'utf8');
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

  async function readRequestText(req: NodeJS.ReadableStream): Promise<string> {
    return (await readRequestBuffer(req)).toString('utf8');
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

  async function resolveDevstudioPlatformContext(_req: any): Promise<DevstudioPlatformContext> {
    return {
      ok: true,
      accountId: options.platformAccountId,
      scope: 'platform',
      mode: 'local-tool',
    };
  }

  function createDevstudioTokyoHeaders(initHeaders?: HeadersInit): Headers {
    const token =
      resolveRootEnvValue('TOKYO_DEV_JWT') || resolveRootEnvValue('CK_INTERNAL_SERVICE_JWT');
    if (!token) {
      throw new Error('Missing TOKYO_DEV_JWT for local DevStudio asset routes.');
    }

    const headers = new Headers(initHeaders || {});
    headers.set('authorization', `Bearer ${token}`);
    headers.set('x-ck-internal-service', options.internalServiceId);
    return headers;
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

  return [
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
      name: 'devstudio-route-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const pathname = url.split('?')[0] || '';
          if (!pathname.startsWith('/api/devstudio/')) return next();

          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(
            JSON.stringify({
              error: {
                kind: 'NOT_FOUND',
                reasonKey: 'coreui.errors.route.notFound',
                detail: pathname,
              },
            }),
          );
        });
      },
    },
  ];
}
