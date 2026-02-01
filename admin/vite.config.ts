import { defineConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

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
      name: 'devstudio-promote-instance',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const pathname = url.split('?')[0] || '';
          if (pathname !== '/api/promote-instance' || req.method !== 'POST') return next();

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');

          const host = String(req.headers.host || '').trim().toLowerCase();
          const allowHosts = new Set(['localhost:5173', '127.0.0.1:5173']);
          if (!allowHosts.has(host)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: { kind: 'DENY', reasonKey: 'devstudio.errors.promote.localOnly' } }));
            return;
          }

          // Local-only DevStudio: no superadmin auth gate for promote.
          // This endpoint is already locked to localhost:5173; keep it frictionless for solo local dev.

          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            let payload: any;
            try {
              payload = body ? JSON.parse(body) : null;
            } catch {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } }));
              return;
            }

            const workspaceId = String(payload?.workspaceId || '').trim();
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId)) {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } }));
              return;
            }

            const publicId = String(payload?.publicId || '').trim();
            if (!publicId || publicId.length > 200 || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(publicId)) {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } }));
              return;
            }
            // Curated instances are locale-free. Locale is a runtime parameter and must not be encoded into publicId.
            // This prevents accidental fan-out (wgt_curated_*.<locale>) when promoting to shared cloud-dev.
            if (publicId.startsWith('wgt_curated_')) {
              const okCuratedPublicId = /^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/i.test(publicId);
              if (!okCuratedPublicId) {
                res.statusCode = 422;
                res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } }));
                return;
              }
            }

            const widgetType = String(payload?.widgetType || '').trim().toLowerCase();
            if (!widgetType || !/^[a-z0-9][a-z0-9_-]*$/.test(widgetType)) {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } }));
              return;
            }

            const status = String(payload?.status || 'unpublished').trim();
            if (status !== 'unpublished' && status !== 'published') {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.status.invalid' } }));
              return;
            }

            const config = payload?.config;
            if (!config || typeof config !== 'object' || Array.isArray(config)) {
              res.statusCode = 422;
              res.end(JSON.stringify({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.config.invalid' } }));
              return;
            }

            const containsNonPersistableUrl = (value: string): boolean => {
              return /(?:^|[\s("'=,])(?:data|blob):/i.test(value);
            };
            const containsLocalOnlyUrl = (value: string): boolean => {
              return /(?:^|[\s("'=,])https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::\d+)?\//i.test(value);
            };

            const issues: Array<{ path: string; message: string }> = [];
            const localUrlRefs: Array<{ path: string; raw: string; primaryUrl: string }> = [];

            const extractPrimaryUrl = (raw: string): string | null => {
              const v = String(raw || '').trim();
              if (!v) return null;
              if (/^(?:data|blob):/i.test(v) || /^https?:\/\//i.test(v)) return v;
              const m = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
              if (m && m[2]) return m[2];
              return null;
            };

            const replacePrimaryUrl = (raw: string, nextUrl: string): string => {
              const v = String(raw || '');
              const m = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
              if (m && m[2]) return v.replace(m[2], nextUrl);
              return nextUrl;
            };

            const isLocalPromotableUrl = (candidate: string): boolean => {
              try {
                const u = new URL(candidate);
                const host = u.host.toLowerCase();
                if (host !== 'localhost:4000' && host !== '127.0.0.1:4000') return false;
                return (
                  u.pathname.startsWith('/workspace-assets/') ||
                  u.pathname.startsWith('/curated-assets/') ||
                  u.pathname.startsWith('/widgets/')
                );
              } catch {
                return false;
              }
            };

            const filenameFromUrl = (candidate: string): string => {
              try {
                const u = new URL(candidate);
                const parts = u.pathname.split('/').filter(Boolean);
                const last = parts[parts.length - 1] || '';
                return last && last.includes('.') ? last : 'upload.bin';
              } catch {
                return 'upload.bin';
              }
            };

            const readJson = async (response: globalThis.Response) => {
              const text = await response.text().catch(() => '');
              try {
                return text ? JSON.parse(text) : null;
              } catch {
                return null;
              }
            };

            const visit = (node: any, nodePath: string) => {
              if (typeof node === 'string') {
                if (containsNonPersistableUrl(node)) {
                  issues.push({
                    path: nodePath,
                    message: 'non-persistable URL scheme found (data:/blob:). Persist stable URLs/keys only.',
                  });
                  return;
                }
                if (containsLocalOnlyUrl(node)) {
                  const primaryUrl = extractPrimaryUrl(node);
                  if (primaryUrl && isLocalPromotableUrl(primaryUrl)) {
                    localUrlRefs.push({ path: nodePath, raw: node, primaryUrl });
                    return;
                  }
                  issues.push({
                    path: nodePath,
                    message:
                      'local-only URL found (localhost/127.0.0.1). Promotion requires local Tokyo URLs (http://localhost:4000/workspace-assets/*, /curated-assets/*, or /widgets/*).',
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
            visit(config, 'config');

            if (issues.length) {
              res.statusCode = 422;
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'VALIDATION',
                    reasonKey: 'devstudio.errors.promote.nonPortableUrl',
                    detail: issues[0]?.message,
                    paths: issues.map((i) => i.path),
                  },
                }),
              );
              return;
            }

            // If the config references local Tokyo assets, upload them to cloud Tokyo and rewrite URLs.
            let configToPromote: Record<string, unknown> = config;
            if (localUrlRefs.length) {
              const cloudTokyoBase = (process.env.CK_CLOUD_TOKYO_BASE_URL || 'https://tokyo.dev.clickeen.com').trim().replace(/\/+$/, '');
              const tokyoJwt = (process.env.TOKYO_DEV_JWT || '').trim();
              const requiresUpload = localUrlRefs.some((ref) => {
                try {
                  const u = new URL(ref.primaryUrl);
                  return u.pathname.startsWith('/workspace-assets/') || u.pathname.startsWith('/curated-assets/');
                } catch {
                  return true;
                }
              });
              if (requiresUpload && !tokyoJwt) {
                res.statusCode = 500;
                res.end(
                  JSON.stringify({
                    error: {
                      kind: 'INTERNAL',
                      reasonKey: 'devstudio.errors.promote.missingCloudTokyoAuth',
                      detail: 'Missing TOKYO_DEV_JWT in DevStudio Local env (required to promote instances that reference local assets).',
                      paths: localUrlRefs.map((r) => r.path),
                    },
                  }),
                );
                return;
              }

              // Config is JSON-only; clone before rewriting.
              configToPromote = JSON.parse(JSON.stringify(config));

              const cache = new Map<string, string>();

              const uploadToCloudTokyo = async (sourceUrl: string): Promise<string> => {
                if (cache.has(sourceUrl)) return cache.get(sourceUrl)!;
                const source = new URL(sourceUrl);

                if (source.pathname.startsWith('/widgets/')) {
                  const rewritten = `${cloudTokyoBase}${source.pathname}`;
                  cache.set(sourceUrl, rewritten);
                  return rewritten;
                }

                const localRes = await fetch(sourceUrl);
                if (!localRes.ok) {
                  throw new Error(`Failed to fetch local asset (HTTP ${localRes.status}): ${sourceUrl}`);
                }
                const contentType = (localRes.headers.get('content-type') || '').trim() || 'application/octet-stream';
                const bytes = await localRes.arrayBuffer();

                let endpoint = '';
                const headers: Record<string, string> = {
                  authorization: `Bearer ${tokyoJwt}`,
                  'content-type': contentType,
                  'x-filename': filenameFromUrl(sourceUrl),
                  'x-variant': 'original',
                };

                if (source.pathname.startsWith('/workspace-assets/')) {
                  endpoint = '/workspace-assets/upload';
                  headers['x-workspace-id'] = workspaceId;
                } else if (source.pathname.startsWith('/curated-assets/')) {
                  endpoint = '/curated-assets/upload';
                  headers['x-public-id'] = publicId;
                  headers['x-widget-type'] = widgetType;
                } else {
                  throw new Error(`Unsupported local Tokyo asset path: ${source.pathname}`);
                }

                const uploadRes = await fetch(`${cloudTokyoBase}${endpoint}?_t=${Date.now()}`, {
                  method: 'POST',
                  headers,
                  body: bytes,
                });
                if (!uploadRes.ok) {
                  const text = await uploadRes.text().catch(() => '');
                  throw new Error(text || `Cloud Tokyo upload failed (HTTP ${uploadRes.status})`);
                }
                const json = await readJson(uploadRes);
                const url = typeof json?.url === 'string' ? json.url.trim() : '';
                if (!url) throw new Error('Cloud Tokyo upload response missing url');
                cache.set(sourceUrl, url);
                return url;
              };

              const rewrite = async (node: any): Promise<void> => {
                if (typeof node === 'string') {
                  const primaryUrl = extractPrimaryUrl(node);
                  if (!primaryUrl || !isLocalPromotableUrl(primaryUrl)) return;
                  const uploadedUrl = await uploadToCloudTokyo(primaryUrl);
                  return uploadedUrl as any;
                }
                if (!node || typeof node !== 'object') return;
                if (Array.isArray(node)) {
                  for (let i = 0; i < node.length; i += 1) {
                    const v = node[i];
                    if (typeof v === 'string') {
                      const primaryUrl = extractPrimaryUrl(v);
                      if (primaryUrl && isLocalPromotableUrl(primaryUrl)) {
                        const uploadedUrl = await uploadToCloudTokyo(primaryUrl);
                        node[i] = replacePrimaryUrl(v, uploadedUrl);
                      }
                    } else {
                      await rewrite(v);
                    }
                  }
                  return;
                }
                for (const [k, v] of Object.entries(node)) {
                  if (typeof v === 'string') {
                    const primaryUrl = extractPrimaryUrl(v);
                    if (primaryUrl && isLocalPromotableUrl(primaryUrl)) {
                      const uploadedUrl = await uploadToCloudTokyo(primaryUrl);
                      (node as any)[k] = replacePrimaryUrl(v, uploadedUrl);
                    }
                  } else {
                    await rewrite(v);
                  }
                }
              };

              try {
                await rewrite(configToPromote);
              } catch (error) {
                res.statusCode = 502;
                res.end(
                  JSON.stringify({
                    error: {
                      kind: 'UPSTREAM',
                      reasonKey: 'devstudio.errors.promote.assetUploadFailed',
                      detail: error instanceof Error ? error.message : String(error),
                      paths: localUrlRefs.map((r) => r.path),
                    },
                  }),
                );
                return;
              }
            }

            const cloudParisBase = (process.env.CK_CLOUD_PARIS_BASE_URL || 'https://paris.dev.clickeen.com').trim().replace(/\/+$/, '');
            const jwt = (process.env.CK_CLOUD_PARIS_DEV_JWT || process.env.PARIS_DEV_JWT || '').trim();
            if (!jwt) {
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'INTERNAL',
                    reasonKey: 'devstudio.errors.promote.missingCloudAuth',
                    detail: 'Missing CK_CLOUD_PARIS_DEV_JWT (or PARIS_DEV_JWT) in DevStudio Local env.',
                  },
                }),
              );
              return;
            }

            const headers = {
              'content-type': 'application/json',
              Authorization: `Bearer ${jwt}`,
            } as Record<string, string>;

            const subject = 'devstudio';
            const updateUrl = `${cloudParisBase}/api/workspaces/${encodeURIComponent(workspaceId)}/instance/${encodeURIComponent(publicId)}?subject=${encodeURIComponent(subject)}`;
            const createUrl = `${cloudParisBase}/api/workspaces/${encodeURIComponent(workspaceId)}/instances?subject=${encodeURIComponent(subject)}`;

            const readText = async (response: globalThis.Response) => response.text().catch(() => '');

            try {
              const updateRes = await fetch(updateUrl, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ config: configToPromote, status }),
              });
              const updateText = await readText(updateRes);
              if (updateRes.ok) {
                res.statusCode = 200;
                res.end(JSON.stringify({ ok: true, target: 'cloud-dev', action: 'updated', cloudParisBase }));
                return;
              }

              // Cloud Paris update path is authoritative. If the instance doesn't exist, create it.
              // Do not attempt to overwrite in cross-workspace conflict scenarios.
              if (updateRes.status !== 404) {
                res.statusCode = 502;
                res.end(
                  JSON.stringify({
                    error: {
                      kind: 'UPSTREAM',
                      reasonKey: 'devstudio.errors.promote.updateFailed',
                      detail: updateText || `Cloud Paris update failed (HTTP ${updateRes.status})`,
                    },
                  }),
                );
                return;
              }

              const createRes = await fetch(createUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ widgetType, publicId, config: configToPromote, status }),
              });

              const createText = await readText(createRes);
              if (!createRes.ok) {
                if (createRes.status === 409) {
                  res.statusCode = 409;
                  res.end(
                    JSON.stringify({
                      error: {
                        kind: 'VALIDATION',
                        reasonKey: 'coreui.errors.publicId.conflict',
                        detail: createText || 'publicId exists in a different workspace',
                      },
                    }),
                  );
                  return;
                }
                res.statusCode = 502;
                res.end(
                  JSON.stringify({
                    error: {
                      kind: 'UPSTREAM',
                      reasonKey: 'devstudio.errors.promote.createFailed',
                      detail: createText || `Cloud Paris create failed (HTTP ${createRes.status})`,
                    },
                  }),
                );
                return;
              }

              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, target: 'cloud-dev', action: 'created', cloudParisBase }));
            } catch (error) {
              res.statusCode = 502;
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'UPSTREAM',
                    reasonKey: 'devstudio.errors.promote.networkFailed',
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
