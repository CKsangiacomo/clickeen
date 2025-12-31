'use client';

import { useMemo } from 'react';
import { useWidgetSession } from '../lib/session/useWidgetSession';

export function TopDrawer() {
  const session = useWidgetSession();
  const { meta, compiled } = session;

  const hasInstance = Boolean(meta?.publicId);
  const displayName = useMemo(
    () =>
      meta?.label || meta?.publicId || compiled?.displayName || compiled?.widgetname || 'No instance loaded',
    [meta?.label, meta?.publicId, compiled?.displayName, compiled?.widgetname]
  );

  return (
    <section className="topdrawer">
      <div className={hasInstance ? 'heading-3' : 'heading-3'}>{displayName}</div>
      <div className="topdrawer-actions">
        <button className="diet-btn-txt" data-size="xl" data-variant="primary" type="button">
          <span className="diet-btn-txt__label">Publish</span>
        </button>
      </div>
    </section>
  );
}
