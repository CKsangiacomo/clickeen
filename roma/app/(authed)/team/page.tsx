import { TeamDomain } from '../../../components/team-domain';
import { DomainPageShell } from '../domain-page-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../l10n/navigation/en.json';

export default function TeamPage() {
  return <DomainPageShell activeDomain="team" title={ROMA_NAVIGATION_UI_COPY.domains.team} Component={TeamDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
