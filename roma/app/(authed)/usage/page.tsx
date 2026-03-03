import { UsageDomain } from '../../../components/usage-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function UsagePage() {
  return <DomainPageShell activeDomain="usage" title="Usage" fallback="Loading usage context..." Component={UsageDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
