import type { ReactNode } from 'react';
import { RomaAccountProvider } from '../../components/roma-account-context';

export default function AuthedLayout({ children }: { children: ReactNode }) {
  return <RomaAccountProvider>{children}</RomaAccountProvider>;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
