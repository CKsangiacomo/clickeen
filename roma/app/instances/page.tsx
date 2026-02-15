import { ControlPlaneShell } from '../../components/control-plane-shell';
import { InstancesPanel } from '../../components/instances-panel';

export default function InstancesPage() {
  return (
    <ControlPlaneShell moduleKey="instances" title="Instances" subtitle="List, create, duplicate, publish, and archive.">
      <InstancesPanel />
    </ControlPlaneShell>
  );
}
