import { guessContentTypeFromExt } from '../../asset-utils';
import type { Env } from '../../types';

export async function handleGetR2Object(
  env: Env,
  key: string,
  cacheControl: string,
): Promise<Response> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  const ext = key.split('.').pop() || '';
  const contentType = obj.httpMetadata?.contentType || guessContentTypeFromExt(ext);
  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', cacheControl);
  return new Response(obj.body, { status: 200, headers });
}
