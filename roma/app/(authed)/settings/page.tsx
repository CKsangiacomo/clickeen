import { SettingsDomain } from '../../../components/settings-domain';
import { DomainPageShell } from '../domain-page-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../l10n/navigation/en.json';

export default function SettingsPage() {
  return <DomainPageShell activeDomain="settings" title={ROMA_NAVIGATION_UI_COPY.variants.account} Component={SettingsDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
