import {
  publicProjectionL10nLivePointerKey,
  publicProjectionL10nTextPackKey,
} from './render';

type TokyoR2Env = { TOKYO_R2: R2Bucket };

function resolvePublicProjectionL10nKey(key: string): string {
  const liveMatch = key.match(/^l10n\/instances\/([^/]+)\/live\/([^/]+)\.json$/i);
  if (liveMatch) {
    return publicProjectionL10nLivePointerKey(
      decodeURIComponent(liveMatch[1]),
      decodeURIComponent(liveMatch[2]),
    );
  }

  const packMatch = key.match(/^l10n\/instances\/([^/]+)\/packs\/([^/]+)\/([a-f0-9]{64})\.json$/i);
  if (packMatch) {
    return publicProjectionL10nTextPackKey(
      decodeURIComponent(packMatch[1]),
      decodeURIComponent(packMatch[2]),
      decodeURIComponent(packMatch[3]),
    );
  }

  return key;
}

export async function handleGetL10nAsset(env: TokyoR2Env, key: string): Promise<Response> {
  const projectionKey = resolvePublicProjectionL10nKey(key);
  const obj = await env.TOKYO_R2.get(projectionKey);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('content-type', obj.httpMetadata?.contentType || 'application/json; charset=utf-8');

  const isLivePointer = /^l10n\/instances\/[^/]+\/live\/[^/]+\.json$/i.test(key);
  if (isLivePointer) headers.set('cache-control', 'no-store');
  else if (key.endsWith('/index.json')) headers.set('cache-control', 'public, max-age=60');
  else headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(obj.body, { status: 200, headers });
}
