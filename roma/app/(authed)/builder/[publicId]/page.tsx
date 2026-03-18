import { BuilderDomain } from '../../../../components/builder-domain';
import { RomaDomainErrorBoundary } from '../../../../components/roma-domain-error-boundary';
import { RomaShell, RomaShellDefaultActions } from '../../../../components/roma-shell';

type BuilderPageProps = {
  params: Promise<{ publicId: string }>;
};

export default async function BuilderPage({ params }: BuilderPageProps) {
  const { publicId } = await params;
  const initialPublicId = String(publicId || '').trim();

  return (
    <RomaShell
      activeDomain="builder"
      title="Builder"
      canvasClassName="rd-canvas rd-canvas--builder"
      headerRight={<RomaShellDefaultActions />}
    >
      <RomaDomainErrorBoundary
        domainLabel="Builder"
        resetKey={`builder:${initialPublicId || 'default'}`}
      >
        <BuilderDomain initialPublicId={initialPublicId} />
      </RomaDomainErrorBoundary>
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
