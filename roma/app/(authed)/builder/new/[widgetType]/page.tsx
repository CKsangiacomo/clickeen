import { BuilderDomain } from '../../../../../components/builder-domain';
import { RomaDomainErrorBoundary } from '../../../../../components/roma-domain-error-boundary';
import { RomaShell } from '../../../../../components/roma-shell';

type NewBuilderPageProps = {
  params: Promise<{ widgetType: string }>;
};

export default async function NewBuilderPage({ params }: NewBuilderPageProps) {
  const { widgetType } = await params;
  const initialWidgetType = String(widgetType || '').trim();

  return (
    <RomaShell activeDomain="builder" title="Builder" fullCanvas>
      <RomaDomainErrorBoundary
        domainLabel="Builder"
        resetKey={`builder:new:${initialWidgetType}`}
      >
        <BuilderDomain initialWidgetType={initialWidgetType} />
      </RomaDomainErrorBoundary>
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
