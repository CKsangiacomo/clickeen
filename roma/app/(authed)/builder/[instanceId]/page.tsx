import { BuilderDomain } from '../../../../components/builder-domain';
import { RomaDomainErrorBoundary } from '../../../../components/roma-domain-error-boundary';
import { RomaShell } from '../../../../components/roma-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../../l10n/navigation/en.json';

type BuilderPageProps = {
  params: Promise<{ instanceId: string }>;
};

export default async function BuilderPage({ params }: BuilderPageProps) {
  const { instanceId } = await params;
  const initialInstanceId = String(instanceId || '').trim();

  return (
    <RomaShell
      activeDomain="builder"
      title={ROMA_NAVIGATION_UI_COPY.domains.builder}
      fullCanvas
    >
      <RomaDomainErrorBoundary
        domainLabel={ROMA_NAVIGATION_UI_COPY.domains.builder}
        resetKey={`builder:${initialInstanceId || 'default'}`}
      >
        <BuilderDomain initialInstanceId={initialInstanceId} />
      </RomaDomainErrorBoundary>
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
