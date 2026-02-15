import { ControlPlaneShell } from '../../components/control-plane-shell';
import { AssetsPanel } from '../../components/assets-panel';

export default function AssetsPage() {
  return (
    <ControlPlaneShell moduleKey="assets" title="Assets" subtitle="Account library and usage mapping.">
      <AssetsPanel />
    </ControlPlaneShell>
  );
}
