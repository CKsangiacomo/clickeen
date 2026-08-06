import { PagesDomain } from '../../../../components/pages-domain';

export default function PageCatalogPageRoute() {
  return <PagesDomain view="catalog" />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
