import { ControlPlaneShell } from '../../components/control-plane-shell';
import { SettingsPanel } from '../../components/settings-panel';

export default function SettingsPage() {
  return (
    <ControlPlaneShell moduleKey="settings" title="Settings" subtitle="Account and workspace preferences.">
      <SettingsPanel />
    </ControlPlaneShell>
  );
}
