import { NextResponse } from 'next/server';

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
        const normalizeLocaleToken = (raw) => {
          const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
          return value || '';
        };

        const parsePublicIdFromPath = () => {
          const parts = String(window.location.pathname || '').split('/').filter(Boolean);
          const last = parts[parts.length - 1] || '';
          try { return decodeURIComponent(last); } catch { return last; }
        };

        const parseGeoCountry = (response) => {
          const raw = response && response.headers ? (response.headers.get('x-ck-geo-country') || response.headers.get('X-Ck-Geo-Country')) : '';
          const normalized = String(raw || '').trim().toUpperCase();
          return /^[A-Z]{2}$/.test(normalized) ? normalized : 'ZZ';
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

        const injectLocaleSwitcher = (html, localePolicy) => {
          const enabled = localePolicy && localePolicy.switcher && localePolicy.switcher.enabled === true;
          if (!enabled) return html;
          const readyLocales = Array.isArray(localePolicy.readyLocales) ? localePolicy.readyLocales : [];
          const locales = Array.isArray(localePolicy.switcher && localePolicy.switcher.locales)
            ? localePolicy.switcher.locales
            : readyLocales;
          if (locales.length <= 1) return html;
          const script = \`<script>(function(){try{var policy=window.CK_LOCALE_POLICY||null;var enabled=policy&&policy.switcher&&policy.switcher.enabled===true;if(!enabled)return;var readyLocales=Array.isArray(policy.readyLocales)?policy.readyLocales:[];var locales=Array.isArray(policy.switcher&&policy.switcher.locales)?policy.switcher.locales:readyLocales;if(locales.length<=1)return;var current=(window.CK_WIDGET&&typeof window.CK_WIDGET.locale==='string')?window.CK_WIDGET.locale:'';var wrap=document.createElement('div');wrap.setAttribute('data-ck-locale-switcher','1');wrap.style.position='fixed';wrap.style.top='12px';wrap.style.right='12px';wrap.style.zIndex='2147483647';wrap.style.background='rgba(248,250,252,0.98)';wrap.style.border='1px solid rgba(148,163,184,0.6)';wrap.style.borderRadius='12px';wrap.style.padding='8px 10px';wrap.style.boxShadow='0 10px 30px rgba(15,23,42,0.12)';wrap.style.fontFamily='ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';var label=document.createElement('div');label.textContent='Language';label.style.fontSize='12px';label.style.opacity='0.85';label.style.marginBottom='6px';var select=document.createElement('select');select.style.fontSize='13px';select.style.padding='6px 8px';select.style.borderRadius='10px';select.style.border='1px solid rgba(148,163,184,0.8)';select.style.background='white';locales.forEach(function(loc){var opt=document.createElement('option');opt.value=loc;opt.textContent=loc;select.appendChild(opt);});if(current&&locales.indexOf(current)>=0)select.value=current;select.addEventListener('change',function(){try{var url=new URL(window.location.href);url.searchParams.set('locale',select.value);window.location.href=url.toString();}catch(e){}});wrap.appendChild(label);wrap.appendChild(select);document.body.appendChild(wrap);}catch(e){}})();<\\/script>\`;
          return html.replace(/<\/body>/i, script + '</body>');
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
          const policy = pointer.localePolicy || null;
          const baseLocale = normalizeLocaleToken(policy && policy.baseLocale) || 'en';
          const readyLocales = Array.isArray(policy && policy.readyLocales)
            ? Array.from(new Set(policy.readyLocales.map(normalizeLocaleToken).filter(Boolean)))
            : [baseLocale];
          const ipEnabled =
            policy &&
            typeof policy === 'object' &&
            policy.ip &&
            typeof policy.ip === 'object' &&
            policy.ip.enabled === true;
          const switcherEnabled =
            policy &&
            typeof policy === 'object' &&
            policy.switcher &&
            typeof policy.switcher === 'object' &&
            policy.switcher.enabled === true;
          const mapping =
            policy && typeof policy === 'object' && policy.ip && typeof policy.ip === 'object' && policy.ip.countryToLocale
              ? policy.ip.countryToLocale
              : null;
          const geoCountry = parseGeoCountry(pointerRes);

          let locale = baseLocale;
          if (fixedLocale && readyLocales.indexOf(fixedLocale) >= 0) {
            locale = fixedLocale;
          } else if (ipEnabled) {
            const mapped = mapping && typeof mapping[geoCountry] === 'string' ? normalizeLocaleToken(mapping[geoCountry]) : '';
            if (mapped && readyLocales.indexOf(mapped) >= 0) locale = mapped;
          }

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
          window.CK_LOCALE_POLICY = {
            baseLocale,
            readyLocales,
            ip: {
              enabled: Boolean(ipEnabled),
              countryToLocale: mapping && typeof mapping === 'object' ? mapping : {},
            },
            switcher: {
              enabled: Boolean(switcherEnabled),
              ...(Array.isArray(policy && policy.switcher && policy.switcher.locales)
                ? { locales: policy.switcher.locales }
                : {}),
            },
          };

          const widgetRes = await fetch('/widgets/' + encodeURIComponent(widgetType) + '/widget.html', {
            method: 'GET',
            cache: 'force-cache',
            credentials: 'omit',
          });
          const widgetHtml = await widgetRes.text().catch(() => '');
          if (!widgetRes.ok || !widgetHtml) {
            showError('Widget unavailable', 'Widget template missing.', 'widgetType=' + widgetType);
            return;
          }

          let html = injectBaseHref(widgetHtml, widgetType);
          html = injectLocaleSwitcher(html, window.CK_LOCALE_POLICY);
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
