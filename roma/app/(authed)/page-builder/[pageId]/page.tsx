import { PageBuilder } from '../../../../components/page-builder';
import { RomaShell } from '../../../../components/roma-shell';

export default async function SavedPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  return <RomaShell activeDomain="pages" title="Page Builder" fullCanvas pageHeader={false}><PageBuilder pageId={pageId} /></RomaShell>;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
