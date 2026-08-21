import { UsageDomain } from '../../../components/usage-domain';
import { DomainPageShell } from '../domain-page-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../l10n/navigation/en.json';

export default function UsagePage() {
  return <DomainPageShell activeDomain="usage" title={ROMA_NAVIGATION_UI_COPY.domains.usage} Component={UsageDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
