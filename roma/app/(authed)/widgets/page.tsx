import { WidgetsDomain } from '../../../components/widgets-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function WidgetsPage() {
  return <DomainPageShell activeDomain="widgets" title="Widgets" Component={WidgetsDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
