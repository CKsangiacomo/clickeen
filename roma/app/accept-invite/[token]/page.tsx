import { AcceptInviteDomain } from '../../../components/accept-invite-domain';

type AcceptInvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function AcceptInvitePage({ params }: AcceptInvitePageProps) {
  const { token } = await params;
  return <AcceptInviteDomain token={token} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
