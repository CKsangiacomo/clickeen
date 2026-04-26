import { TeamDomain } from '../../../components/team-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function TeamPage() {
  return <DomainPageShell activeDomain="team" title="Team" Component={TeamDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
