import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionCookieNames } from './lib/auth/session';

const PUBLIC_PATHS = new Set<string>(['/', '/login']);

const AUTHED_PREFIXES = [
  '/home',
  '/builder',
  '/assets',
  '/billing',
  '/settings',
  '/team',
  '/usage',
  '/widgets',
  '/ai',
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname === '/favicon.ico') return true;
  return false;
}

function isAuthedPath(pathname: string): boolean {
  return AUTHED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function buildNextPath(req: NextRequest): string {
  const { pathname, search } = req.nextUrl;
  const next = `${pathname}${search || ''}`;
  if (!next.startsWith('/')) return '/home';
  if (next.startsWith('//')) return '/home';
  return next;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  if (!isAuthedPath(pathname)) return NextResponse.next();

  const cookieNames = resolveSessionCookieNames();
  const accessToken = req.cookies.get(cookieNames.access)?.value?.trim() || '';
  const refreshToken = req.cookies.get(cookieNames.refresh)?.value?.trim() || '';
  if (accessToken || refreshToken) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('error', 'coreui.errors.auth.required');
  loginUrl.searchParams.set('next', buildNextPath(req));

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
