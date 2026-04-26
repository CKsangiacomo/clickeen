import { HomeDomain } from '../../../components/home-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function HomePage() {
  return <DomainPageShell activeDomain="home" title="Home" Component={HomeDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
