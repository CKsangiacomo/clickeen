import { defineConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const OPEN_EDITOR_CONTRACT_SOURCE_PATH = path.resolve(
  __dirname,
  '..',
  'tooling',
  'contracts',
  'open-editor-lifecycle.v1.json',
);
const OPEN_EDITOR_CONTRACT_ROUTE = '/tooling/contracts/open-editor-lifecycle.v1.json';

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
          fileName: 'tooling/contracts/open-editor-lifecycle.v1.json',
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
          const wantsUpdateCell = pathname === '/api/entitlements/matrix/cell' && req.method === 'POST';
          if (!wantsGet && !wantsUpdateCell) return next();

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');

          const matrixPath = path.resolve(__dirname, '..', 'config', 'entitlements.matrix.json');

          const readMatrix = () => {
            if (!fs.existsSync(matrixPath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.entitlements.notFound' } }));
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
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } }));
              return;
            }

            const capabilityKey = String(payload?.capabilityKey || '').trim();
            const tier = String(payload?.tier || '').trim();
            const value = payload?.value as unknown;

            if (!capabilityKey) {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.entitlements.capabilityKey.invalid' } }));
              return;
            }

            if (!tier) {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.entitlements.tier.invalid' } }));
              return;
            }

            try {
              const matrix = readMatrix();
              if (!matrix) return;

              const tiers = Array.isArray(matrix?.tiers) ? (matrix.tiers as string[]) : [];
              if (!tiers.includes(tier)) {
                res.statusCode = 422;
                res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.entitlements.tier.unknown', detail: tier } }));
                return;
              }

              const cap = matrix?.capabilities?.[capabilityKey];
              if (!cap || typeof cap !== 'object') {
                res.statusCode = 404;
                res.end(
                  JSON.stringify({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.entitlements.capability.notFound' } }),
                );
                return;
              }

              const kind = String((cap as any).kind || '').trim();
              if (kind === 'flag') {
                if (typeof value !== 'boolean') {
                  res.statusCode = 422;
                  res.end(
                    JSON.stringify({
                      error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.entitlements.value.invalid', detail: 'expected boolean' },
                    }),
                  );
                  return;
                }
              } else if (kind === 'cap' || kind === 'budget') {
                if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
                  res.statusCode = 422;
                  res.end(
                    JSON.stringify({
                      error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.entitlements.value.invalid', detail: 'expected number or null' },
                    }),
                  );
                  return;
                }
              } else {
                res.statusCode = 500;
                res.end(
                  JSON.stringify({
                    error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.entitlements.kind.invalid', detail: kind },
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

            const defaultPlatformAccountId = (
              process.env.CK_PLATFORM_ACCOUNT_ID || '00000000-0000-0000-0000-000000000100'
            ).trim();
            const ownerAccountId = String(payload?.ownerAccountId || defaultPlatformAccountId).trim();
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerAccountId)) {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } }));
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
            const containsLegacyTokyoAssetUrl = (value: string): boolean => {
              const isLegacyPath = (candidate: string): boolean => {
                const trimmed = String(candidate || '').trim();
                if (!trimmed) return false;
                if (/^\/(?:workspace-assets|curated-assets|assets\/accounts)\//i.test(trimmed)) return true;
                if (!/^https?:\/\//i.test(trimmed)) return false;
                try {
                  return /^\/(?:workspace-assets|curated-assets|assets\/accounts)\//i.test(new URL(trimmed).pathname);
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
                    message: 'non-persistable URL scheme found (data:/blob:). Persist stable URLs/keys only.',
                  });
                } else if (containsLegacyTokyoAssetUrl(node)) {
                  issues.push({
                    path: nodePath,
                    message: 'legacy Tokyo asset URL found. Use canonical /arsenale/o/{accountId}/{assetId}/... URLs only.',
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

	          const themesPath = path.resolve(__dirname, '..', 'tokyo', 'themes', 'themes.json');

	          if (wantsList) {
	            try {
	              if (!fs.existsSync(themesPath)) {
	                res.statusCode = 404;
	                res.end(JSON.stringify({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.theme.notFound' } }));
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
	                })
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
	                })
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
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } }));
              return;
            }

            const themeId = String(payload?.themeId || '').trim().toLowerCase();
            if (!themeId || !/^[a-z0-9][a-z0-9_-]*$/.test(themeId) || themeId === 'custom') {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.theme.invalid' } }));
              return;
            }

            const values = payload?.values;
            if (!values || typeof values !== 'object' || Array.isArray(values)) {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } }));
              return;
            }

            const allowedPrefixes = ['stage.', 'pod.', 'appearance.', 'typography.'];
            const invalidKeys = Object.keys(values).filter(
              (key) => !allowedPrefixes.some((prefix) => key.startsWith(prefix))
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
                })
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
                if (/^\/(?:workspace-assets|curated-assets|assets\/accounts)\//i.test(trimmed)) return true;
                if (!/^https?:\/\//i.test(trimmed)) return false;
                try {
                  return /^\/(?:workspace-assets|curated-assets|assets\/accounts)\//i.test(new URL(trimmed).pathname);
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
                    message: 'non-persistable URL scheme found (data:/blob:). Persist stable URLs/keys only.',
                  });
                } else if (containsLegacyTokyoAssetUrl(node)) {
                  issues.push({
                    path: nodePath,
                    message: 'legacy Tokyo asset URL found. Use canonical /arsenale/o/{accountId}/{assetId}/... URLs only.',
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
                })
              );
	              return;
	            }

	            try {
	              if (!fs.existsSync(themesPath)) {
	                res.statusCode = 404;
	                res.end(JSON.stringify({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.theme.notFound' } }));
	                return;
              }
              const raw = fs.readFileSync(themesPath, 'utf8');
              const json = JSON.parse(raw);
              const themes = Array.isArray(json?.themes) ? json.themes : [];
              const index = themes.findIndex((theme) => String(theme?.id || '').toLowerCase() === themeId);
              if (index < 0) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.theme.notFound' } }));
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
                })
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
