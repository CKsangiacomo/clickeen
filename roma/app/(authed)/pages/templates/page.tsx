import { PagesDomain } from '../../../../components/pages-domain';

export default function PageTemplatesPageRoute() {
  return <PagesDomain view="templates" />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
