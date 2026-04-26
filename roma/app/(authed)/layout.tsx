import type { ReactNode } from 'react';
import { RomaAccountBoundary } from '../../components/roma-account-context';

export default function AuthedLayout({ children }: { children: ReactNode }) {
  return <RomaAccountBoundary>{children}</RomaAccountBoundary>;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
