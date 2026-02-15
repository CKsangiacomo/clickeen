import { ControlPlaneShell } from '../../components/control-plane-shell';
import { BillingPanel } from '../../components/billing-panel';

export default function BillingPage() {
  return (
    <ControlPlaneShell moduleKey="billing" title="Billing" subtitle="Subscription, checkout, and portal sessions.">
      <BillingPanel />
    </ControlPlaneShell>
  );
}
