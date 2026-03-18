import { BuilderDomain } from '../../../components/builder-domain';
import { RomaDomainErrorBoundary } from '../../../components/roma-domain-error-boundary';
import { RomaShell, RomaShellDefaultActions } from '../../../components/roma-shell';

export default function BuilderLandingPage() {
  return (
    <RomaShell
      activeDomain="builder"
      title="Builder"
      canvasClassName="rd-canvas rd-canvas--builder"
      headerRight={<RomaShellDefaultActions />}
    >
      <RomaDomainErrorBoundary domainLabel="Builder" resetKey="builder">
        <BuilderDomain />
      </RomaDomainErrorBoundary>
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
