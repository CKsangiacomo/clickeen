import { ProfileDomain } from '../../../components/profile-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function ProfilePage() {
  return <DomainPageShell activeDomain="profile" title="My Profile" fallback="Loading profile context..." Component={ProfileDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
