import { ControlPlaneShell } from '../../components/control-plane-shell';
import { UsagePanel } from '../../components/usage-panel';

export default function UsagePage() {
  return (
    <ControlPlaneShell moduleKey="usage" title="Usage" subtitle="Entitlements, quotas, and metering diagnostics.">
      <UsagePanel />
    </ControlPlaneShell>
  );
}
