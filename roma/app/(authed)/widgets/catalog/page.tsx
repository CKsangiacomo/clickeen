import { WidgetsPage } from '../../../../components/widgets-domain';

export default function WidgetCatalogPageRoute() {
  return <WidgetsPage view="catalog" />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
