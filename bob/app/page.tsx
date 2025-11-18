'use client';

import { TopDrawer } from '../components/TopDrawer';
import { ToolDrawer } from '../components/ToolDrawer';
import { Workspace } from '../components/Workspace';
import { WidgetSessionProvider } from '../lib/session/useWidgetSession';

export default function BobPage() {
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
          backgroundColor: 'var(--color-system-gray-6)',
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
    </WidgetSessionProvider>
  );
}
