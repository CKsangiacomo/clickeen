export const dynamic = 'force-dynamic';

function getVeniceBase() {
  const env = process.env.NEXT_PUBLIC_VENICE_URL || process.env.VENICE_URL || 'http://localhost:3002';
  return env.replace(/\/$/, '');
}

export async function GET(req: Request, { params }: { params: { publicId: string } }) {
  try {
    const base = getVeniceBase();
    const inUrl = new URL(req.url);
    // Build downstream URL, preserving theme/device and ts; ensure preview=1 for builder context
    const outUrl = new URL(`${base}/e/${encodeURIComponent(params.publicId)}`);
    inUrl.searchParams.forEach((v, k) => outUrl.searchParams.set(k, v));
    if (!outUrl.searchParams.has('preview')) outUrl.searchParams.set('preview', '1');
    if (!outUrl.searchParams.has('cache')) outUrl.searchParams.set('cache', 'no-store');

    const headers: HeadersInit = {
      'Cache-Control': 'no-store',
      'X-Request-ID': crypto.randomUUID(),
    };

    // Forward server-known auth headers if present (draft/embed); do not rely on client JS to supply them
    const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (auth) (headers as any)['Authorization'] = auth;
    const embed = req.headers.get('x-embed-token') ?? req.headers.get('X-Embed-Token');
    if (embed) (headers as any)['X-Embed-Token'] = embed;

    const res = await fetch(outUrl.toString(), { method: 'GET', headers, cache: 'no-store' });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(`<html><body><pre>Preview proxy error: ${String((err as Error)?.message || err)}</pre></body></html>`, {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

