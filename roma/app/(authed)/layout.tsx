import type { ReactNode } from 'react';
import { RomaAuthRedirect } from '../../components/roma-auth-redirect';

export default function AuthedLayout({ children }: { children: ReactNode }) {
  return <RomaAuthRedirect>{children}</RomaAuthRedirect>;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
