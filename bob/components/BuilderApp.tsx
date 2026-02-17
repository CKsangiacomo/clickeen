'use client';

import { TopDrawer } from './TopDrawer';
import { ToolDrawer } from './ToolDrawer';
import { UpsellPopup } from './UpsellPopup';
import { Workspace } from './Workspace';
import { WidgetSessionProvider } from '../lib/session/useWidgetSession';
import { useWidgetSession } from '../lib/session/useWidgetSession';

function UpsellPopupHost() {
  const session = useWidgetSession();
  const upsell = session.upsell;
  return (
    <UpsellPopup
      open={Boolean(upsell)}
      reasonKey={upsell?.reasonKey ?? ''}
      detail={upsell?.detail}
      cta={upsell?.cta ?? 'upgrade'}
      onClose={session.dismissUpsell}
    />
  );
}

export function BuilderApp() {
  return (
    <WidgetSessionProvider>
      <div className="builder-app">
        <TopDrawer />

        <div className="builder-app__content">
          <ToolDrawer />
          <Workspace />
        </div>
      </div>
      <UpsellPopupHost />
    </WidgetSessionProvider>
  );
}
