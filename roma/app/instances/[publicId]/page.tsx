import { ControlPlaneShell } from '../../../components/control-plane-shell';
import { ModuleSurface } from '../../../components/module-surface';

type InstancePageProps = {
  params: Promise<{ publicId: string }>;
};

export default async function InstanceDetailPage({ params }: InstancePageProps) {
  const { publicId } = await params;
  return (
    <ControlPlaneShell
      moduleKey="instances"
      title={`Instance ${publicId}`}
      subtitle="Instance detail route contract is mounted and ready for data binding."
    >
      <ModuleSurface
        description="Next step: bind instance summary, publish status, and locale pipeline diagnostics from Paris."
        primaryHref={`/builder/${encodeURIComponent(publicId)}`}
        primaryLabel="Open in builder"
        secondaryHref="/instances"
        secondaryLabel="Back to instances"
      />
    </ControlPlaneShell>
  );
}
