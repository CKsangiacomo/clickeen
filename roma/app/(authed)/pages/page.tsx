import { notFound } from 'next/navigation';
import { PagesDomain, type PagesView } from '../../../components/pages-domain';

function resolvePagesView(view: string | string[] | undefined): PagesView {
  if (view === undefined) return 'your-pages';
  if (view === 'templates' || view === 'catalog') return view;
  notFound();
}

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  return <PagesDomain view={resolvePagesView(view)} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
