import { NextResponse } from 'next/server';
import { INSTANCE_ID_RE, isRecord } from '@clickeen/ck-contracts';
import { normalizeLocaleToken } from '@clickeen/l10n';
import {
  createVeniceRequestContext,
  finalizeVeniceObservedResponse,
  withVeniceRequestId,
} from '@venice/lib/request-ops';
import { tokyoFetch } from '@venice/lib/tokyo';
import { escapeHtml } from '@venice/lib/html';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const SHELL_CACHE_CONTROL = 'public, max-age=60, s-maxage=86400';

type LocaleRuntimePolicy = {
  baseLocale: string;
  readyLocales: string[];
  ipEnabled: boolean;
  alwaysShowLocale: string;
  mapping: Record<string, string>;
  switcherEnabled: boolean;
};

function parseGeoCountry(response: Response): string {
  const normalized = String(response.headers.get('x-ck-geo-country') || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : 'ZZ';
}

function resolveLocaleRuntimePolicy(pointer: Record<string, unknown>): LocaleRuntimePolicy {
  const policy = isRecord(pointer.localePolicy) ? pointer.localePolicy : null;
  const baseLocale = normalizeLocaleToken(policy?.baseLocale) ?? 'en';
  const readyLocales = Array.isArray(policy?.readyLocales)
    ? Array.from(
        new Set(policy.readyLocales.map((entry) => normalizeLocaleToken(entry)).filter((entry): entry is string => Boolean(entry))),
      )
    : [baseLocale];
  const ip = isRecord(policy?.ip) ? policy.ip : null;
  const switcher = isRecord(policy?.switcher) ? policy.switcher : null;
  const rawMapping = isRecord(ip?.countryToLocale) ? ip.countryToLocale : {};
  const mapping: Record<string, string> = {};
  for (const [country, locale] of Object.entries(rawMapping)) {
    const normalizedCountry = country.trim().toUpperCase();
    const normalizedLocale = normalizeLocaleToken(locale);
    if (/^[A-Z]{2}$/.test(normalizedCountry) && normalizedLocale) {
      mapping[normalizedCountry] = normalizedLocale;
    }
  }

  return {
    baseLocale,
    readyLocales,
    ipEnabled: ip?.enabled === true,
    alwaysShowLocale: normalizeLocaleToken(switcher?.alwaysShowLocale) ?? '',
    mapping,
    switcherEnabled: switcher?.enabled === true,
  };
}

function computeEffectiveLocale(policy: LocaleRuntimePolicy, geoCountry: string, fixedLocaleOverride: string | null): string {
  if (fixedLocaleOverride && policy.readyLocales.includes(fixedLocaleOverride)) return fixedLocaleOverride;
  if (policy.ipEnabled) {
    const mapped = policy.mapping[geoCountry];
    if (mapped && policy.readyLocales.includes(mapped)) return mapped;
  }
  if (policy.alwaysShowLocale && policy.readyLocales.includes(policy.alwaysShowLocale)) return policy.alwaysShowLocale;
  return policy.baseLocale;
}

function parsePathParts(path: string): string[] {
  const out: string[] = [];
  const raw = path.trim();
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
}

function applyTextOverrides(state: unknown, textPack: Record<string, unknown>): void {
  if (!isRecord(state)) return;
  nextEntry:
  for (const [path, value] of Object.entries(textPack)) {
    if (typeof value !== 'string') continue;
    const parts = parsePathParts(path);
    if (!parts.length) continue;
    let cur: unknown = state;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (/^[0-9]+$/.test(part)) {
        if (!Array.isArray(cur)) continue nextEntry;
        cur = cur[Number(part)];
        continue;
      }
      if (!isRecord(cur)) continue nextEntry;
      cur = cur[part];
    }
    const last = parts[parts.length - 1];
    if (/^[0-9]+$/.test(last)) {
      if (!Array.isArray(cur)) continue;
      const idx = Number(last);
      if (typeof cur[idx] === 'string') cur[idx] = value;
      continue;
    }
    if (isRecord(cur) && typeof cur[last] === 'string') cur[last] = value;
  }
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function extractBaseState(configPack: unknown): Record<string, unknown> | null {
  if (!isRecord(configPack)) return null;
  if (isRecord(configPack.config)) return configPack.config;
  if (isRecord(configPack.state)) return configPack.state;
  return configPack;
}

function cloneJsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function injectBaseAndRuntime(html: string, widgetType: string, runtimeScript: string, locale: string): string {
  const baseTag = /<base\b/i.test(html) ? '' : `<base href="/widgets/${encodeURIComponent(widgetType)}/" />`;
  const headInsert = `${baseTag}<script>${runtimeScript}</script>`;
  const withRuntime = /<head(\b[^>]*)>/i.test(html)
    ? html.replace(/<head(\b[^>]*)>/i, `<head$1>${headInsert}`)
    : `${headInsert}${html}`;
  return withRuntime.replace(/<html(\b[^>]*)\blang=(["']).*?\2/i, `<html$1 lang="${escapeHtml(locale)}"`);
}

function buildRuntimeScript(args: {
  instanceId: string;
  locale: string;
  state: Record<string, unknown>;
  localeLabels: Record<string, unknown>;
  localePolicy: LocaleRuntimePolicy;
}): string {
  const policy = args.localePolicy;
  return [
    `window.CK_WIDGET=${inlineJson({ instanceId: args.instanceId, locale: args.locale, state: args.state })};`,
    `window.CK_LOCALE_LABELS=${inlineJson(args.localeLabels)};`,
    `window.CK_LOCALE_POLICY=${inlineJson({
      baseLocale: policy.baseLocale,
      readyLocales: policy.readyLocales,
      ip: { enabled: policy.ipEnabled, countryToLocale: policy.mapping },
      switcher: {
        enabled: policy.switcherEnabled,
        ...(policy.alwaysShowLocale ? { alwaysShowLocale: policy.alwaysShowLocale } : {}),
      },
    })};`,
  ].join('');
}

function errorDocument(title: string, body: string, detail: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
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
    <div class="ck-shell">
      <div class="ck-error">
        <h1 class="ck-error__title">${escapeHtml(title)}</h1>
        <p class="ck-error__body">${escapeHtml(body)}</p>
        ${detail ? `<pre class="ck-error__detail">${escapeHtml(detail)}</pre>` : ''}
      </div>
    </div>
  </body>
</html>`;
}

function htmlResponse(html: string, status = 200): NextResponse {
  return new NextResponse(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': SHELL_CACHE_CONTROL,
      'X-Venice-Render-Mode': 'snapshot',
    },
  });
}

function errorResponse(title: string, body: string, detail: string, status: number): NextResponse {
  return htmlResponse(errorDocument(title, body, detail), status);
}

export async function GET(req: Request, ctx: { params: Promise<{ instanceId: string }> }) {
  const context = createVeniceRequestContext(req);
  const { instanceId } = await ctx.params;
  const requestUrl = new URL(req.url);

  const finish = (response: Response, reasonKey?: string | null, detail?: string | null) =>
    finalizeVeniceObservedResponse({
      context,
      response,
      boundary: 'widget.shell',
      reasonKey,
      detail,
      instanceId,
    });

  if (!INSTANCE_ID_RE.test(instanceId)) {
    return finish(
      errorResponse('Clickeen embed error', 'Invalid instanceId in URL.', `instanceId=${instanceId}`, 400),
      'coreui.errors.instanceId.invalid',
      'invalid_instance_id',
    );
  }

  const upstreamHeaders = withVeniceRequestId(context);
  const pointerRes = await tokyoFetch(`/renders/widgets/${encodeURIComponent(instanceId)}/live/r.json`, {
    method: 'GET',
    headers: upstreamHeaders,
  });
  const pointer = await readJson(pointerRes);
  if (!pointerRes.ok) {
    return finish(
      errorResponse('Widget unavailable', 'This widget is not live.', `instanceId=${instanceId}`, pointerRes.status),
      `HTTP_${pointerRes.status}`,
      'pointer_unavailable',
    );
  }
  if (!isRecord(pointer)) {
    return finish(
      errorResponse('Widget unavailable', 'Invalid runtime pointer.', `instanceId=${instanceId}`, 502),
      'coreui.errors.widget.compiled.invalid',
      'pointer_invalid',
    );
  }

  const widgetType = typeof pointer.widgetType === 'string' ? pointer.widgetType.trim() : '';
  const configFp = typeof pointer.configFp === 'string' ? pointer.configFp.trim() : '';
  if (!widgetType || !configFp) {
    return finish(
      errorResponse('Widget unavailable', 'Missing widget metadata.', `instanceId=${instanceId}`, 502),
      'coreui.errors.widget.compiled.invalid',
      'widget_metadata_missing',
    );
  }

  const policy = resolveLocaleRuntimePolicy(pointer);
  const fixedLocale = normalizeLocaleToken(requestUrl.searchParams.get('locale'));
  const locale = computeEffectiveLocale(policy, parseGeoCountry(pointerRes), fixedLocale);
  const configRes = await tokyoFetch(`/renders/widgets/${encodeURIComponent(instanceId)}/config.json`, {
    method: 'GET',
    headers: upstreamHeaders,
  });
  const configPack = await readJson(configRes);
  const baseState = extractBaseState(configPack);
  if (!configRes.ok || !baseState) {
    return finish(
      errorResponse('Widget unavailable', configRes.ok ? 'Config invalid.' : 'Config missing.', `instanceId=${instanceId}`, 502),
      configRes.ok ? 'coreui.errors.widget.compiled.invalid' : `HTTP_${configRes.status}`,
      configRes.ok ? 'config_invalid' : 'config_missing',
    );
  }

  const state = cloneJsonRecord(baseState);
  const overlayRes = await tokyoFetch(
    `/l10n/widgets/${encodeURIComponent(instanceId)}/${encodeURIComponent(locale)}/overlay.json`,
    { method: 'GET', headers: upstreamHeaders },
  );
  const overlay = await readJson(overlayRes);
  const textPack = isRecord(overlay) && isRecord(overlay.textPack) ? overlay.textPack : locale === policy.baseLocale ? {} : null;
  if (!overlayRes.ok && locale !== policy.baseLocale) {
    return finish(
      errorResponse('Widget unavailable', 'Text overlay missing.', `instanceId=${instanceId} locale=${locale}`, overlayRes.status),
      `HTTP_${overlayRes.status}`,
      'overlay_missing',
    );
  }
  if (!textPack) {
    return finish(
      errorResponse('Widget unavailable', 'Text overlay invalid.', `instanceId=${instanceId} locale=${locale}`, 502),
      'coreui.errors.widget.compiled.invalid',
      'overlay_invalid',
    );
  }
  applyTextOverrides(state, textPack);

  const widgetRes = await tokyoFetch(`/widgets/${encodeURIComponent(widgetType)}/widget.html`, {
    method: 'GET',
    headers: upstreamHeaders,
  });
  const widgetHtml = await widgetRes.text().catch(() => '');
  if (!widgetRes.ok || !widgetHtml) {
    return finish(
      errorResponse('Widget unavailable', 'Widget software missing.', `widgetType=${widgetType}`, widgetRes.status || 502),
      widgetRes.ok ? 'coreui.errors.widget.compiled.invalid' : `HTTP_${widgetRes.status}`,
      'widget_html_missing',
    );
  }

  const localeLabels = isRecord(pointer.localeLabels) ? pointer.localeLabels : {};
  const runtimeScript = buildRuntimeScript({ instanceId, locale, state, localeLabels, localePolicy: policy });
  return finish(htmlResponse(injectBaseAndRuntime(widgetHtml, widgetType, runtimeScript, locale)));
}
