'use client';

import { useMemo, useState } from 'react';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { PublishEmbedModal } from './PublishEmbedModal';

export function TopDrawer() {
  const session = useWidgetSession();
  const { meta, compiled, publish, isPublishing, isDirty, discardChanges } = session;
  const [embedOpen, setEmbedOpen] = useState(false);

  const hasInstance = Boolean(meta?.publicId);
  const canPublish = hasInstance && Boolean(meta?.workspaceId);
  const displayName = useMemo(
    () =>
      meta?.label || meta?.publicId || compiled?.displayName || compiled?.widgetname || 'No instance loaded',
    [meta?.label, meta?.publicId, compiled?.displayName, compiled?.widgetname]
  );

  return (
    <section className="topdrawer">
      <div className={hasInstance ? 'heading-3' : 'heading-3'}>{displayName}</div>
      <div className="topdrawer-actions">
        {isDirty ? (
          <>
            <button
              className="diet-btn-txt"
              data-size="xl"
              data-variant="neutral"
              type="button"
              disabled={!canPublish || isPublishing}
              onClick={() => discardChanges()}
            >
              <span className="diet-btn-txt__label">Discard</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="xl"
              data-variant="primary"
              type="button"
              disabled={!canPublish || isPublishing}
              onClick={() => publish()}
            >
              <span className="diet-btn-txt__label">{isPublishing ? 'Saving…' : 'Save'}</span>
            </button>
          </>
        ) : null}
        <button
          className="diet-btn-txt"
          data-size="xl"
          data-variant="primary"
          type="button"
          disabled={!canPublish}
          onClick={() => setEmbedOpen(true)}
        >
          <span className="diet-btn-txt__label">Publish</span>
        </button>
      </div>
      <PublishEmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} />
    </section>
  );
}
