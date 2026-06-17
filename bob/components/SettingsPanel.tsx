'use client';

import { useWidgetSession } from '../lib/session/useWidgetSession';
import { TdMenuContent } from './TdMenuContent';

export function SettingsPanel() {
  const session = useWidgetSession();
  const compiled = session.compiled;
  const settingsHtml = compiled?.panels?.find((panel) => panel.id === 'settings')?.html ?? '';

  if (!compiled) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">Settings</div>
        <div className="label-s label-muted">Load an instance to configure settings.</div>
      </div>
    );
  }

  return (
    <TdMenuContent
      panelId="settings"
      panelHtml={settingsHtml}
      instanceData={session.instanceData}
      applyOps={session.applyOps}
      lastUpdate={session.lastUpdate}
      dieterMedia={compiled.media.dieter}
    />
  );
}
