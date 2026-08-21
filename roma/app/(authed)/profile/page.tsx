import { ProfileDomain } from '../../../components/profile-domain';
import { DomainPageShell } from '../domain-page-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../l10n/navigation/en.json';

export default function ProfilePage() {
  return <DomainPageShell activeDomain="profile" title={ROMA_NAVIGATION_UI_COPY.domains.profile} Component={ProfileDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
