import { BuilderDomain } from '../../../../components/builder-domain';
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
      <BuilderDomain initialPublicId={initialPublicId} />
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
