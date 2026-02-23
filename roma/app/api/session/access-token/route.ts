import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionBearer } from '../../../../lib/auth/session';

export const runtime = 'edge';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

export async function GET(request: NextRequest) {
  const auth = await resolveSessionBearer(request);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error: {
          kind: 'AUTH',
          reasonKey: 'coreui.errors.auth.required',
        },
      },
      { status: 401, headers: CACHE_HEADERS },
    );
  }

  const response = NextResponse.json(
    {
      accessToken: auth.accessToken,
    },
    { headers: CACHE_HEADERS },
  );

  if (auth.setCookies?.length) {
    const secure = request.nextUrl.protocol === 'https:';
    for (const cookie of auth.setCookies) {
      response.cookies.set({
        name: cookie.name,
        value: cookie.value,
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: cookie.maxAge,
      });
    }
  }

  return response;
}
