import { WidgetDefaultsDomain } from '../../../../components/widget-defaults-domain';
import { DomainPageShell } from '../../domain-page-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../../l10n/navigation/en.json';

export default function WidgetDefaultsPage() {
  return <DomainPageShell activeDomain="widgetDefaults" title={ROMA_NAVIGATION_UI_COPY.domains.widgetDefaults} Component={WidgetDefaultsDomain} />;
}
