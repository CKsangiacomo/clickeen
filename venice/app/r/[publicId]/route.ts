import { NextResponse } from 'next/server';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { tokyoFetch } from '@venice/lib/tokyo';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function resolveGeoCountry(request: Request): string {
  const raw = request.headers.get('cf-ipcountry') ?? request.headers.get('CF-IPCountry') ?? '';
  const normalized = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return 'ZZ';
  return normalized;
}

export async function GET(req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId: rawPublicId } = await ctx.params;
  const publicId = String(rawPublicId || '').trim();
  const url = new URL(req.url);
  const metaOnly = (url.searchParams.get('meta') || '').trim() === '1';
  const rawLocale = metaOnly ? (url.searchParams.get('locale') || '').trim() : '';
  const locale = metaOnly ? normalizeLocaleToken(rawLocale) : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'X-Ck-Geo-Country, X-Ck-L10n-Requested-Locale, X-Venice-Render-Mode',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'X-Venice-Render-Mode': 'snapshot',
    'X-Ck-Geo-Country': resolveGeoCountry(req),
  };

  if (metaOnly) {
    if (!locale) {
      return new NextResponse(JSON.stringify({ ok: false, reason: 'LOCALE_REQUIRED' }), { status: 422, headers });
    }
    headers['X-Ck-L10n-Requested-Locale'] = locale;
  }

  const tokyoPath = metaOnly
    ? `/renders/instances/${encodeURIComponent(publicId)}/live/meta/${encodeURIComponent(locale || '')}.json`
    : `/renders/instances/${encodeURIComponent(publicId)}/live/r.json`;

  const upstream = await tokyoFetch(tokyoPath, { method: 'GET', cache: 'no-store' });
  if (upstream.status === 404) {
    return new NextResponse(
      JSON.stringify({ ok: false, reason: metaOnly ? 'SEO_NOT_AVAILABLE' : 'NOT_PUBLISHED' }),
      { status: 404, headers },
    );
  }

  if (!upstream.ok) {
    return new NextResponse(JSON.stringify({ ok: false, reason: `UPSTREAM_${upstream.status}` }), {
      status: 502,
      headers,
    });
  }

  const contentType = upstream.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  return new NextResponse(upstream.body, { status: 200, headers });
}
