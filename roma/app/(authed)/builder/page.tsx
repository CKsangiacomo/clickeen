import { BuilderDomain } from '../../../components/builder-domain';
import { RomaShell, RomaShellDefaultActions } from '../../../components/roma-shell';

export default function BuilderLandingPage() {
  return (
    <RomaShell
      activeDomain="builder"
      title="Builder"
      canvasClassName="rd-canvas rd-canvas--builder"
      headerRight={<RomaShellDefaultActions />}
    >
      <BuilderDomain />
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
