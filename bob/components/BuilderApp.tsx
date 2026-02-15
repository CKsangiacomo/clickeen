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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          gap: 'var(--space-2)',
          padding: 'var(--space-2)',
          overflow: 'hidden',
          backgroundColor: 'var(--color-system-gray-6-step3)',
        }}
      >
        <TopDrawer />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '340px 1fr',
            gap: 'var(--space-2)',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          <ToolDrawer />
          <Workspace />
        </div>
      </div>
      <UpsellPopupHost />
    </WidgetSessionProvider>
  );
}

