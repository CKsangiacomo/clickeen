import { AiDomain } from '../../../components/ai-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function AiPage() {
  return <DomainPageShell activeDomain="ai" title="AI" fallback="Loading AI context..." Component={AiDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
