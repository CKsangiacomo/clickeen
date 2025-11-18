import { NextResponse, type NextRequest } from 'next/server';

const DEFAULT_ALLOWED = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
];

function parseAllowed(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return process.env.NODE_ENV === 'development' ? DEFAULT_ALLOWED : [];
  const invalid: string[] = [];
  const allowed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        invalid.push(url);
        return false;
      }
    });
  if (invalid.length > 0) {
    console.warn('[CORS] Ignoring invalid ALLOWED_ORIGINS entries:', invalid.join(', '));
  }
  return allowed;
}

const allowlist = parseAllowed();

export function middleware(req: NextRequest) {
  // Only handle API paths
  const pathname = req.nextUrl.pathname;
  if (!pathname.startsWith('/api/')) return;

  const origin = req.headers.get('origin');
  const method = req.method.toUpperCase();

  // Allow server-to-server requests (no Origin) to pass through.
  // Browser requests include an Origin and are subject to CORS checks below.
  if (!origin) {
    return NextResponse.next();
  }

  const headers = new Headers();
  const isAllowed = origin && allowlist.includes(origin);

  // Preflight
  if (method === 'OPTIONS') {
    if (isAllowed) {
      headers.set('Access-Control-Allow-Origin', origin!);
      headers.set('Vary', 'Origin');
      headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Request-ID,X-Workspace-Id,X-Embed-Token');
      return new Response(null, { status: 204, headers });
    }
    return new Response(null, { status: 403 });
  }

  if (isAllowed) {
    const res = NextResponse.next();
    res.headers.set('Access-Control-Allow-Origin', origin!);
    res.headers.set('Vary', 'Origin');
    return res;
  }

  return new Response(JSON.stringify({ error: 'FORBIDDEN' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export const config = {
  matcher: ['/api/:path*'],
};
