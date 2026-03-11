import { TeamMemberDomain } from '../../../../components/team-member-domain';
import { DomainPageShell } from '../../domain-page-shell';

type TeamMemberPageProps = {
  params: Promise<{ memberId: string }>;
};

export default async function TeamMemberPage({ params }: TeamMemberPageProps) {
  const { memberId } = await params;

  function TeamMemberPageContent() {
    return <TeamMemberDomain memberId={memberId} />;
  }

  return (
    <DomainPageShell
      activeDomain="team"
      title="Team"
      fallback="Loading team member..."
      Component={TeamMemberPageContent}
    />
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
