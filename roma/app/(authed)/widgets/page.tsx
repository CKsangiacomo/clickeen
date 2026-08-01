import { WidgetsPage } from '../../../components/widgets-domain';

export default function WidgetsPageRoute() {
  return <WidgetsPage view="your-widgets" />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
