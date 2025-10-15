export const dynamic = 'force-dynamic';

function getParisBase() {
  const env = process.env.PARIS_URL || process.env.NEXT_PUBLIC_PARIS_URL || 'http://localhost:3001';
  return env.replace(/\/$/, '');
}

function pickAuth(req: Request) {
  const hdr = req.headers.get('authorization') || req.headers.get('Authorization');
  if (hdr && hdr.trim().length > 0) return hdr;
  // Hardcode for debugging - env var not loading
  const dev = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
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
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try { controller.abort(); } catch {}
    }, 5000);
    const res = await fetch(url, { method, headers, body, cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    const txt = await res.text();
    return new Response(txt, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = (err as Error).message || String(err);
    const status = msg && msg.toUpperCase().includes('ABORT') ? 504 : 502;
    return new Response(JSON.stringify({ error: status === 504 ? 'GATEWAY_TIMEOUT' : 'UPSTREAM_ERROR', details: msg }), {
      status,
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
