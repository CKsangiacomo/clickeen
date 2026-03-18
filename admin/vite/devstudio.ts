import type { Plugin } from 'vite';

type DevstudioPluginOptions = {
  rootDir: string;
  internalServiceId: string;
  platformAccountId: string;
};

function writeJson(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function createDevstudioPlugins(_options: DevstudioPluginOptions): Plugin[] {
  return [
    {
      name: 'devstudio-route-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const pathname = url.split('?')[0] || '';
          if (!pathname.startsWith('/api/devstudio/')) return next();

          writeJson(res, 404, {
            error: {
              kind: 'NOT_FOUND',
              reasonKey: 'coreui.errors.route.notFound',
              detail: pathname,
            },
          });
        });
      },
    },
  ];
}
