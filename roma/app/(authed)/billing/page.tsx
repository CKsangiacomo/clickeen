import { BillingDomain } from '../../../components/billing-domain';
import { DomainPageShell } from '../domain-page-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../l10n/navigation/en.json';

export default function BillingPage() {
  return <DomainPageShell activeDomain="billing" title={ROMA_NAVIGATION_UI_COPY.domains.billing} Component={BillingDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
