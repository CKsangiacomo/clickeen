import { NextResponse } from 'next/server';
import { EMBED_LOCALE_RUNTIME_SOURCE } from '../../embed/runtime-locale';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const SHELL_CACHE_CONTROL = 'public, max-age=60, s-maxage=86400';

const EMBED_SHELL_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Clickeen embed</title>
    <style>
      html, body { margin: 0; padding: 0; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
      .ck-shell { min-height: 200px; display: flex; align-items: center; justify-content: center; padding: 16px; color: rgba(15, 23, 42, 0.85); }
      .ck-error { max-width: 720px; text-align: left; background: rgba(248, 250, 252, 0.98); border: 1px solid rgba(148, 163, 184, 0.6); border-radius: 14px; padding: 14px 14px 12px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12); }
      .ck-error__title { font-size: 14px; font-weight: 650; margin: 0 0 6px; }
      .ck-error__body { font-size: 13px; line-height: 1.4; margin: 0; opacity: 0.92; }
      .ck-error__detail { margin-top: 10px; padding: 10px 12px; background: rgba(15, 23, 42, 0.04); border-radius: 12px; overflow-x: auto; font-size: 12px; line-height: 1.35; }
    </style>
  </head>
  <body>
    <div class="ck-shell" data-role="shell">Loading…</div>
    <script>
      (() => {
${EMBED_LOCALE_RUNTIME_SOURCE}

        const parsePublicIdFromPath = () => {
          const parts = String(window.location.pathname || '').split('/').filter(Boolean);
          const last = parts[parts.length - 1] || '';
          try { return decodeURIComponent(last); } catch { return last; }
        };

        const showError = (title, body, detail) => {
          const shell = document.querySelector('[data-role=\"shell\"]');
          if (!shell) return;
          shell.innerHTML = '';
          const card = document.createElement('div');
          card.className = 'ck-error';
          const h = document.createElement('h1');
          h.className = 'ck-error__title';
          h.textContent = title;
          const p = document.createElement('p');
          p.className = 'ck-error__body';
          p.textContent = body;
          card.appendChild(h);
          card.appendChild(p);
          if (detail) {
            const pre = document.createElement('pre');
            pre.className = 'ck-error__detail';
            pre.textContent = detail;
            card.appendChild(pre);
          }
          shell.appendChild(card);
        };

        const parsePathParts = (path) => {
          const out = [];
          const raw = String(path || '').trim();
          if (!raw) return out;
          let buf = '';
          for (let i = 0; i < raw.length; i += 1) {
            const ch = raw[i];
            if (ch === '.') {
              if (buf) out.push(buf);
              buf = '';
              continue;
            }
            if (ch === '[') {
              if (buf) out.push(buf);
              buf = '';
              const close = raw.indexOf(']', i + 1);
              if (close < 0) break;
              const inside = raw.slice(i + 1, close).trim();
              if (inside) out.push(inside);
              i = close;
              continue;
            }
            buf += ch;
          }
          if (buf) out.push(buf);
          return out;
        };

        const applyTextOverrides = (state, textPack) => {
          if (!state || typeof state !== 'object') return;
          if (!textPack || typeof textPack !== 'object' || Array.isArray(textPack)) return;
          Object.entries(textPack).forEach(([path, value]) => {
            if (typeof value !== 'string') return;
            const parts = parsePathParts(path);
            if (!parts.length) return;
            let cur = state;
            for (let i = 0; i < parts.length - 1; i += 1) {
              const part = parts[i];
              const isIndex = /^[0-9]+$/.test(part);
              if (isIndex) {
                const idx = Number(part);
                if (!Array.isArray(cur)) return;
                cur = cur[idx];
                continue;
              }
              if (!cur || typeof cur !== 'object') return;
              cur = cur[part];
            }
            const last = parts[parts.length - 1];
            if (!cur || typeof cur !== 'object') return;
            if (/^[0-9]+$/.test(last)) {
              const idx = Number(last);
              if (!Array.isArray(cur)) return;
              if (typeof cur[idx] !== 'string') return;
              cur[idx] = value;
              return;
            }
            if (typeof cur[last] !== 'string') return;
            cur[last] = value;
          });
        };

        const injectBaseHref = (html, widgetType) => {
          const baseTag = '<base href=\"/widgets/' + encodeURIComponent(widgetType) + '/\" />';
          if (/<base\\b/i.test(html)) return html;
          return html.replace(/<head(\\b[^>]*)>/i, '<head$1>' + baseTag);
        };

        const boot = async () => {
          const publicId = parsePublicIdFromPath();
          if (!publicId) {
            showError('Clickeen embed error', 'Missing publicId in URL.', window.location.pathname);
            return;
          }

          const url = new URL(window.location.href);
          const fixedLocale = normalizeLocaleToken(url.searchParams.get('locale'));

          const pointerRes = await fetch('/r/' + encodeURIComponent(publicId), {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit',
          });
          if (!pointerRes.ok) {
            showError('Widget unavailable', 'This widget is not live.', 'publicId=' + publicId);
            return;
          }

          const pointer = await pointerRes.json().catch(() => null);
          if (!pointer || typeof pointer !== 'object') {
            showError('Widget unavailable', 'Invalid runtime pointer.', 'publicId=' + publicId);
            return;
          }

          const widgetType = typeof pointer.widgetType === 'string' ? pointer.widgetType.trim() : '';
          const configFp = typeof pointer.configFp === 'string' ? pointer.configFp.trim() : '';
          const localePolicyState = resolveLocaleRuntimePolicy(pointer);
          const { baseLocale, readyLocales, ipEnabled, alwaysShowLocale, mapping } = localePolicyState;
          const geoCountry = parseGeoCountry(pointerRes);
          const locale = computeEffectiveLocale(localePolicyState, geoCountry, fixedLocale);

          if (!widgetType || !configFp) {
            showError('Widget unavailable', 'Missing widget metadata.', 'publicId=' + publicId);
            return;
          }

          const configRes = await fetch(
            '/renders/instances/' +
              encodeURIComponent(publicId) +
              '/config/' +
              encodeURIComponent(configFp) +
              '/config.json',
            {
              method: 'GET',
              cache: 'force-cache',
              credentials: 'omit',
            },
          );
          const configPack = await configRes.json().catch(() => null);
          if (!configRes.ok || !configPack) {
            showError('Widget unavailable', 'Config pack missing.', 'publicId=' + publicId + ' configFp=' + configFp);
            return;
          }

          const baseState =
            configPack && typeof configPack === 'object' && configPack.config && typeof configPack.config === 'object' && !Array.isArray(configPack.config)
              ? configPack.config
              : configPack && typeof configPack === 'object' && configPack.state && typeof configPack.state === 'object' && !Array.isArray(configPack.state)
                ? configPack.state
                : configPack && typeof configPack === 'object' && !Array.isArray(configPack)
                  ? configPack
                  : null;

          if (!baseState) {
            showError('Widget unavailable', 'Config pack invalid.', 'publicId=' + publicId);
            return;
          }

          const textPointerRes = await fetch(
            '/l10n/instances/' + encodeURIComponent(publicId) + '/live/' + encodeURIComponent(locale) + '.json',
            { method: 'GET', cache: 'no-store', credentials: 'omit' },
          );
          const textPointer = await textPointerRes.json().catch(() => null);
          const textFp = textPointer && typeof textPointer.textFp === 'string' ? textPointer.textFp.trim() : '';
          if (!textPointerRes.ok || !textFp) {
            showError('Widget unavailable', 'Text pack missing.', 'publicId=' + publicId + ' locale=' + locale);
            return;
          }

          const textRes = await fetch(
            '/l10n/instances/' +
              encodeURIComponent(publicId) +
              '/packs/' +
              encodeURIComponent(locale) +
              '/' +
              encodeURIComponent(textFp) +
              '.json',
            { method: 'GET', cache: 'force-cache', credentials: 'omit' },
          );
          const textPack = await textRes.json().catch(() => null);
          if (!textRes.ok || !textPack) {
            showError('Widget unavailable', 'Text pack invalid.', 'publicId=' + publicId + ' textFp=' + textFp);
            return;
          }

          applyTextOverrides(baseState, textPack);

          window.CK_WIDGET = { publicId, locale, state: baseState };
          window.CK_LOCALE_LABELS =
            pointer && typeof pointer === 'object' && pointer.localeLabels && typeof pointer.localeLabels === 'object'
              ? pointer.localeLabels
              : {};
          window.CK_LOCALE_POLICY = {
            baseLocale,
            readyLocales,
            ip: {
              enabled: Boolean(ipEnabled),
              countryToLocale: mapping && typeof mapping === 'object' ? mapping : {},
            },
            switcher: {
              enabled:
                Boolean(
                  pointer &&
                    typeof pointer === 'object' &&
                    pointer.localePolicy &&
                    typeof pointer.localePolicy === 'object' &&
                    pointer.localePolicy.switcher &&
                    typeof pointer.localePolicy.switcher === 'object' &&
                    pointer.localePolicy.switcher.enabled === true,
                ),
              ...(alwaysShowLocale ? { alwaysShowLocale } : {}),
            },
          };

          const widgetRes = await fetch('/widgets/' + encodeURIComponent(widgetType) + '/widget.html', {
            method: 'GET',
            cache: 'force-cache',
            credentials: 'omit',
          });
          const widgetHtml = await widgetRes.text().catch(() => '');
          if (!widgetRes.ok || !widgetHtml) {
            showError('Widget unavailable', 'Widget software missing.', 'widgetType=' + widgetType);
            return;
          }

          let html = injectBaseHref(widgetHtml, widgetType);
          document.open();
          document.write(html);
          document.close();
        };

        boot().catch((err) => {
          const message = err && err.message ? String(err.message) : String(err);
          showError('Widget unavailable', 'Failed to boot embed.', message);
        });
      })();
    </script>
  </body>
</html>`;

export async function GET(_req: Request, _ctx: { params: Promise<{ publicId: string }> }) {
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': SHELL_CACHE_CONTROL,
    'X-Venice-Render-Mode': 'snapshot',
  };
  return new NextResponse(EMBED_SHELL_HTML, { status: 200, headers });
}
