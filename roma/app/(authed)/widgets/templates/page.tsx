import { WidgetsPage } from '../../../../components/widgets-domain';

export default function WidgetTemplatesPageRoute() {
  return <WidgetsPage view="templates" />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
