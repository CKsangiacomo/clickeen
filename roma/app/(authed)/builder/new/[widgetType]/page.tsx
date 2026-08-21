import { BuilderDomain } from '../../../../../components/builder-domain';
import { RomaDomainErrorBoundary } from '../../../../../components/roma-domain-error-boundary';
import { RomaShell } from '../../../../../components/roma-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../../../l10n/navigation/en.json';

type NewBuilderPageProps = {
  params: Promise<{ widgetType: string }>;
};

export default async function NewBuilderPage({ params }: NewBuilderPageProps) {
  const { widgetType } = await params;
  const initialWidgetType = String(widgetType || '').trim();

  return (
    <RomaShell activeDomain="builder" title={ROMA_NAVIGATION_UI_COPY.domains.builder} fullCanvas>
      <RomaDomainErrorBoundary
        domainLabel={ROMA_NAVIGATION_UI_COPY.domains.builder}
        resetKey={`builder:new:${initialWidgetType}`}
      >
        <BuilderDomain initialWidgetType={initialWidgetType} />
      </RomaDomainErrorBoundary>
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
