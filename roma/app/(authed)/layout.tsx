import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

const CACHE_HEADERS = {
  accept: 'application/json',
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

function resolveRequestOrigin(host: string, forwardedProto: string | null): string | null {
  const normalizedHost = String(host || '').trim();
  if (!normalizedHost) return null;
  const protocol = (String(forwardedProto || '').trim().toLowerCase() || 'https') === 'http' ? 'http' : 'https';
  return `${protocol}://${normalizedHost}`;
}

async function ensureAuthenticatedSession(): Promise<void> {
  const incoming = await headers();
  const host = incoming.get('x-forwarded-host') || incoming.get('host') || '';
  const origin = resolveRequestOrigin(host, incoming.get('x-forwarded-proto'));
  if (!origin) {
    redirect('/login?error=roma.errors.auth.config_missing');
  }

  const cookie = incoming.get('cookie') || '';
  const response = await fetch(`${origin}/api/bootstrap`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      ...CACHE_HEADERS,
      ...(cookie ? { cookie } : {}),
    },
  });

  if (response.status === 401 || response.status === 403) {
    redirect('/login?error=coreui.errors.auth.required');
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { reasonKey?: string } | string } | null;
    const reasonKey =
      typeof payload?.error === 'string'
        ? payload.error
        : payload?.error && typeof payload.error === 'object' && typeof payload.error.reasonKey === 'string'
          ? payload.error.reasonKey
          : 'roma.errors.proxy.paris_unavailable';
    redirect(`/login?error=${encodeURIComponent(reasonKey)}`);
  }
}

export default async function AuthedLayout({ children }: { children: ReactNode }) {
  await ensureAuthenticatedSession();
  return <>{children}</>;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
