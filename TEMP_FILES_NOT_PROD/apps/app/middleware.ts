import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/confirm',
  '/auth/magic',
  '/invites/accept',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/_next', // static assets
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Create a single pass-through response for the lifetime of this request
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Always allow public paths through
  if (isPublic(pathname)) return response;

  // Never break the site if envs are missing in Preview
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // Soft-allow: do not block, but don't crash middleware
    return response;
  }

  // Single response instance is created above

  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      // Don't throw from middleware – just allow and log
      console.error('supabase.auth.getUser error in middleware:', error);
      return response;
    }

    if (!user) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  } catch (err) {
    // Last-resort guard: never 500 the app from middleware
    console.error('Middleware fatal guard:', err);
    return NextResponse.next();
  }
}

// Only run on real app routes, skip assets and the auth callback
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
};
