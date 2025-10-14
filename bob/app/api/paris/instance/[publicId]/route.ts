export const dynamic = 'force-dynamic';

function getParisBase() {
  const env = process.env.PARIS_URL || process.env.NEXT_PUBLIC_PARIS_URL || 'http://localhost:3001';
  return env.replace(/\/$/, '');
}

function pickAuth(req: Request) {
  const hdr = req.headers.get('authorization') || req.headers.get('Authorization');
  if (hdr && hdr.trim().length > 0) return hdr;
  const dev = process.env.PARIS_DEV_JWT;
  if (dev && dev.trim().length > 0) return `Bearer ${dev.trim()}`;
  return undefined;
}

async function forwardToParis(req: Request, publicId: string) {
  const base = getParisBase();
  const url = `${base}/api/instance/${encodeURIComponent(publicId)}`;
  const method = req.method.toUpperCase();
  const headers: HeadersInit = { 'Content-Type': 'application/json; charset=utf-8', 'X-Request-ID': crypto.randomUUID() };
  const auth = pickAuth(req);
  if (auth) (headers as any)['Authorization'] = auth;

  let body: string | undefined = undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await req.text();
  }
  try {
    const res = await fetch(url, { method, headers, body, cache: 'no-store' });
    const txt = await res.text();
    return new Response(txt, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'UPSTREAM_ERROR', details: (err as Error).message || String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

export async function GET(_req: Request, { params }: { params: { publicId: string } }) {
  return forwardToParis(_req, params.publicId);
}

export async function PUT(_req: Request, { params }: { params: { publicId: string } }) {
  return forwardToParis(_req, params.publicId);
}

