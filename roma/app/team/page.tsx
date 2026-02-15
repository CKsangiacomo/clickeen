import { ControlPlaneShell } from '../../components/control-plane-shell';
import { TeamPanel } from '../../components/team-panel';

export default function TeamPage() {
  return (
    <ControlPlaneShell moduleKey="team" title="Team" subtitle="Workspace and account membership controls.">
      <TeamPanel />
    </ControlPlaneShell>
  );
}
