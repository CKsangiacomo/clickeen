import { PageBuilder } from '../../../../components/page-builder';
import { RomaShell } from '../../../../components/roma-shell';

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function NewPage({ searchParams }: { searchParams: Promise<{ template?: string | string[]; catalog?: string | string[] }> }) {
  const query = await searchParams;
  const accountTemplateId = firstQueryValue(query.template).trim();
  const catalogTemplateId = firstQueryValue(query.catalog).trim();
  const templateDraft = accountTemplateId
    ? { kind: 'account' as const, pageId: accountTemplateId }
    : catalogTemplateId
      ? { kind: 'catalog' as const, pageId: catalogTemplateId }
      : null;
  return <RomaShell activeDomain="pages" title="New page" fullCanvas pageHeader={false}><PageBuilder templateDraft={templateDraft} /></RomaShell>;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
