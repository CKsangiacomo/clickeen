type TokyoR2Env = { TOKYO_R2: R2Bucket };

export async function handleGetL10nAsset(env: TokyoR2Env, key: string): Promise<Response> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('content-type', obj.httpMetadata?.contentType || 'application/json; charset=utf-8');

  const isLivePointer = /^l10n\/instances\/[^/]+\/live\/[^/]+\.json$/i.test(key);
  if (isLivePointer) headers.set('cache-control', 'no-store');
  else if (key.endsWith('/index.json')) headers.set('cache-control', 'public, max-age=60');
  else headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(obj.body, { status: 200, headers });
}
