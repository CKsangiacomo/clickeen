import { ControlPlaneShell } from '../../components/control-plane-shell';
import { AiPanel } from '../../components/ai-panel';

export default function AIPage() {
  return (
    <ControlPlaneShell moduleKey="ai" title="AI" subtitle="Policy profile, limits, and outcomes.">
      <AiPanel />
    </ControlPlaneShell>
  );
}
