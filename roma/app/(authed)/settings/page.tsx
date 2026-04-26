import { SettingsDomain } from '../../../components/settings-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function SettingsPage() {
  return <DomainPageShell activeDomain="settings" title="Settings" Component={SettingsDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
