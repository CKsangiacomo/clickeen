'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRomaMe } from './use-roma-me';

const AUTH_REQUIRED_REASON_KEY = 'coreui.errors.auth.required';

type RomaAuthRedirectProps = {
  children: ReactNode;
};

export function RomaAuthRedirect({ children }: RomaAuthRedirectProps) {
  const me = useRomaMe();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (me.error !== AUTH_REQUIRED_REASON_KEY) return;
    if (!pathname || pathname === '/login') return;
    if (pathname.startsWith('/api/')) return;

    const search = searchParams.toString();
    const next = search ? `${pathname}?${search}` : pathname;
    window.location.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [me.error, pathname, searchParams]);

  if (me.error === AUTH_REQUIRED_REASON_KEY) {
    return <section className="roma-module-surface body-m">Redirecting to sign in...</section>;
  }

  return <>{children}</>;
}
