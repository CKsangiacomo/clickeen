import { ControlPlaneShell } from '../../../components/control-plane-shell';
import { ModuleSurface } from '../../../components/module-surface';

export const runtime = 'edge';

type AssetPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetDetailPage({ params }: AssetPageProps) {
  const { assetId } = await params;
  return (
    <ControlPlaneShell
      moduleKey="assets"
      title={`Asset ${assetId}`}
      subtitle="Asset detail contract route for usage and restore/delete operations."
    >
      <ModuleSurface
        description="Next step: connect used-by graph and guard destructive actions through policy-aware endpoint contracts."
        primaryHref="/assets"
        primaryLabel="Back to assets"
      />
    </ControlPlaneShell>
  );
}
