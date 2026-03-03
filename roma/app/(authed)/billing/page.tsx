import { BillingDomain } from '../../../components/billing-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function BillingPage() {
  return <DomainPageShell activeDomain="billing" title="Billing" fallback="Loading billing context..." Component={BillingDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
