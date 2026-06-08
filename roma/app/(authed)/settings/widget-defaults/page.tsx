import { WidgetDefaultsDomain } from '../../../../components/widget-defaults-domain';
import { DomainPageShell } from '../../domain-page-shell';

export default function WidgetDefaultsPage() {
  return <DomainPageShell activeDomain="widgetDefaults" title="Widget Defaults" Component={WidgetDefaultsDomain} />;
}
