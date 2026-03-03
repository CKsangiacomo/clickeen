import { WidgetsDomain } from '../../../components/widgets-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function WidgetsPage() {
  return <DomainPageShell activeDomain="widgets" title="Widgets" fallback="Loading widgets context..." Component={WidgetsDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
