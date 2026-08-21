import { AiDomain } from '../../../components/ai-domain';
import { DomainPageShell } from '../domain-page-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../l10n/navigation/en.json';

export default function AiPage() {
  return <DomainPageShell activeDomain="ai" title={ROMA_NAVIGATION_UI_COPY.domains.ai} Component={AiDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
