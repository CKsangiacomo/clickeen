import {
  accountInstanceL10nOverlayPrefix,
  accountInstanceL10nOverlayKey,
  normalizePublishedWidgetLookupDocument,
  publishedWidgetLookupKey,
} from './render';

type TokyoR2Env = { TOKYO_R2: R2Bucket };

async function loadJson<T>(env: TokyoR2Env, key: string): Promise<T | null> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return null;
  return (await obj.json().catch(() => null)) as T | null;
}

async function handleGetPragueL10nAsset(env: TokyoR2Env, key: string): Promise<Response> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const cacheControl = key.endsWith('/index.json')
    ? 'public, max-age=300, stale-while-revalidate=600'
    : 'public, max-age=31536000, immutable';
  return new Response(obj.body, {
    status: 200,
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/json; charset=utf-8',
      'cache-control': cacheControl,
    },
  });
}

export async function handleGetL10nAsset(env: TokyoR2Env, key: string): Promise<Response> {
  const normalized = key.replace(/^\/+/, '');
  if (normalized.startsWith('l10n/prague/')) {
    return handleGetPragueL10nAsset(env, normalized);
  }

  const indexMatch = normalized.match(/^l10n\/widgets\/([^/]+)\/index\.json$/i);
  if (indexMatch) {
    const instanceId = decodeURIComponent(indexMatch[1]);
    const lookup = normalizePublishedWidgetLookupDocument(
      await loadJson(env, publishedWidgetLookupKey(instanceId)),
    );
    if (!lookup || lookup.status !== 'published') return new Response('Not found', { status: 404 });
    const prefix = accountInstanceL10nOverlayPrefix(lookup.accountId, lookup.widgetType, lookup.id);
    const locales = new Set<string>();
    let cursor: string | undefined;
    do {
      const listed = await env.TOKYO_R2.list({ prefix, cursor });
      listed.objects.forEach((object) => {
        const relative = object.key.slice(prefix.length);
        const match = relative.match(/^([^/]+)\/overlay\.json$/);
        if (match?.[1]) locales.add(decodeURIComponent(match[1]).toLowerCase());
      });
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    return new Response(
      JSON.stringify({
        v: 1,
        instanceId: lookup.id,
        overlays: {
          l10n: {
            locales: Array.from(locales).sort((left, right) => left.localeCompare(right)),
          },
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      },
    );
  }

  const overlayMatch = normalized.match(/^l10n\/widgets\/([^/]+)\/([^/]+)\/overlay\.json$/i);
  if (!overlayMatch) return new Response('Not found', { status: 404 });

  const instanceId = decodeURIComponent(overlayMatch[1]);
  const locale = decodeURIComponent(overlayMatch[2]).toLowerCase();
  const lookup = normalizePublishedWidgetLookupDocument(
    await loadJson(env, publishedWidgetLookupKey(instanceId)),
  );
  if (!lookup || lookup.status !== 'published') return new Response('Not found', { status: 404 });

  const obj = await env.TOKYO_R2.get(
    accountInstanceL10nOverlayKey(lookup.accountId, lookup.widgetType, lookup.id, locale),
  );
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    status: 200,
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
