import { NextResponse } from 'next/server';
import { isRecord } from '@clickeen/ck-contracts';
import {
  isCompactInstanceId,
} from '@clickeen/ck-contracts/overlay-identity';
import {
  resolveLanguageOverlayCode,
  resolveLocaleForLanguageOverlayCode,
} from '@clickeen/ck-contracts/overlay-codebooks';
import { resolveOverlay } from '@clickeen/ck-contracts/overlay-primitives';
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
  availableLocales: string[];
  overlayIdsByLocale: Record<string, string>;
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
  const overlayIdsByLocale: Record<string, string> = {};
  const overlays = isRecord(pointer.overlays) ? pointer.overlays : null;
  const languageOverlays = isRecord(overlays?.languages) ? overlays.languages : {};
  for (const [languageCode, overlayId] of Object.entries(languageOverlays)) {
    if (typeof overlayId !== 'string') continue;
    const locale = resolveLocaleForLanguageOverlayCode(languageCode);
    if (locale) overlayIdsByLocale[locale] = overlayId;
  }
  const availableLocales = Array.from(new Set([baseLocale, ...Object.keys(overlayIdsByLocale)]));
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
    availableLocales,
    overlayIdsByLocale,
    ipEnabled: ip?.enabled === true,
    alwaysShowLocale: normalizeLocaleToken(switcher?.alwaysShowLocale) ?? '',
    mapping,
    switcherEnabled: switcher?.enabled === true,
  };
}

function computeEffectiveLocale(policy: LocaleRuntimePolicy, geoCountry: string, fixedLocaleOverride: string | null): string {
  if (fixedLocaleOverride && policy.availableLocales.includes(fixedLocaleOverride)) return fixedLocaleOverride;
  if (policy.ipEnabled) {
    const mapped = policy.mapping[geoCountry];
    if (mapped && policy.availableLocales.includes(mapped)) return mapped;
  }
  if (policy.alwaysShowLocale && policy.availableLocales.includes(policy.alwaysShowLocale)) return policy.alwaysShowLocale;
  return policy.baseLocale;
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
      languages: policy.availableLocales,
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

  if (!isCompactInstanceId(instanceId)) {
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

  let state = cloneJsonRecord(baseState);
  if (locale !== policy.baseLocale) {
    const languageCode = resolveLanguageOverlayCode(locale);
    const overlayId = languageCode ? policy.overlayIdsByLocale[locale] : null;
    if (!languageCode || !overlayId) {
      return finish(
        errorResponse('Widget unavailable', 'Text overlay missing.', `instanceId=${instanceId} locale=${locale}`, 404),
        'coreui.errors.overlay.missing',
        'overlay_missing',
      );
    }

    const overlayRes = await tokyoFetch(
      `/renders/widgets/${encodeURIComponent(instanceId)}/overlays/${encodeURIComponent(overlayId)}.json`,
      { method: 'GET', headers: upstreamHeaders },
    );
    const overlay = await readJson(overlayRes);
    const overlayValues = isRecord(overlay) && isRecord(overlay.values) ? (overlay.values as Record<string, string>) : null;
    if (!overlayRes.ok || !overlayValues) {
      return finish(
        errorResponse('Widget unavailable', 'Text overlay invalid.', `instanceId=${instanceId} locale=${locale}`, overlayRes.status || 502),
        overlayRes.ok ? 'coreui.errors.widget.compiled.invalid' : `HTTP_${overlayRes.status}`,
        overlayRes.ok ? 'overlay_invalid' : 'overlay_missing',
      );
    }

    try {
      state = resolveOverlay(state, overlayValues);
    } catch (error) {
      return finish(
        errorResponse(
          'Widget unavailable',
          'Text overlay invalid.',
          error instanceof Error ? error.message : String(error),
          502,
        ),
        'coreui.errors.widget.compiled.invalid',
        'overlay_resolve_invalid',
      );
    }
  }

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
