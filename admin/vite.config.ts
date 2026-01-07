import { defineConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

export default defineConfig({
  resolve: {
    alias: {
      '@dieter': path.resolve(__dirname, '../dieter'),
    },
  },
  server: {
    port: 5173,
    open: true,
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
      name: 'tokyo-update-widget-spec-defaults',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const pathname = url.split('?')[0] || '';
          if (pathname !== '/api/widget-spec-defaults' || req.method !== 'POST') return next();

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');

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
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } }));
              return;
            }

            const widgetType = String(payload?.widgetType || '').trim().toLowerCase();
            if (!widgetType || !/^[a-z0-9][a-z0-9_-]*$/.test(widgetType)) {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } }));
              return;
            }

            const defaults = payload?.defaults;
            if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } }));
              return;
            }

            const containsNonPersistableUrl = (value: string): boolean => {
              return /(?:^|[\s("'=,])(?:data|blob):/i.test(value);
            };

            const issues: Array<{ path: string; message: string }> = [];
            const visit = (node: any, nodePath: string) => {
              if (typeof node === 'string') {
                if (containsNonPersistableUrl(node)) {
                  issues.push({
                    path: nodePath,
                    message: 'non-persistable URL scheme found (data:/blob:). Persist stable URLs/keys only.',
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
            visit(defaults, 'defaults');

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

            const specPath = path.resolve(__dirname, '..', 'tokyo', 'widgets', widgetType, 'spec.json');
            try {
              if (!fs.existsSync(specPath)) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.widget.notFound' } }));
                return;
              }
              const raw = fs.readFileSync(specPath, 'utf8');
              const spec = JSON.parse(raw);
              if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed' } }));
                return;
              }
              spec.defaults = defaults;
              fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, widgetType, specPath }));
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
