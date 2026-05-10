import { BuilderDomain } from '../../../../components/builder-domain';
import { RomaDomainErrorBoundary } from '../../../../components/roma-domain-error-boundary';
import { RomaShell, RomaShellDefaultActions } from '../../../../components/roma-shell';

type BuilderPageProps = {
  params: Promise<{ instanceId: string }>;
};

export default async function BuilderPage({ params }: BuilderPageProps) {
  const { instanceId } = await params;
  const initialInstanceId = String(instanceId || '').trim();

  return (
    <RomaShell
      activeDomain="builder"
      title="Builder"
      canvasClassName="rd-canvas rd-canvas--builder"
      headerRight={<RomaShellDefaultActions />}
    >
      <RomaDomainErrorBoundary
        domainLabel="Builder"
        resetKey={`builder:${initialInstanceId || 'default'}`}
      >
        <BuilderDomain initialInstanceId={initialInstanceId} />
      </RomaDomainErrorBoundary>
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
