import { TeamMemberDomain } from '../../../../components/team-member-domain';
import { DomainPageShell } from '../../domain-page-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../../l10n/navigation/en.json';

type TeamMemberPageProps = {
  params: Promise<{ memberId: string }>;
};

export default async function TeamMemberPage({ params }: TeamMemberPageProps) {
  const { memberId } = await params;

  function TeamMemberPageContent() {
    return <TeamMemberDomain memberId={memberId} />;
  }

  return <DomainPageShell activeDomain="team" title={ROMA_NAVIGATION_UI_COPY.domains.team} Component={TeamMemberPageContent} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
