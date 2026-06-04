import { PagesDomain } from '../../../components/pages-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function PagesPage() {
  return <DomainPageShell activeDomain="pages" title="Pages" Component={PagesDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
