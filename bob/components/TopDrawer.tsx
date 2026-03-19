'use client';

import { useMemo, useState } from 'react';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { EmbedModal } from './EmbedModal';

export function TopDrawer() {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const { save, isSaving } = session;
  const [embedOpen, setEmbedOpen] = useState(false);

  const meta = chrome.meta;
  const currentPublicId = typeof meta?.publicId === 'string' ? meta.publicId : '';
  const hasInstance = Boolean(currentPublicId);
  const canPersist = hasInstance;
  const currentLabel = useMemo(
    () => (typeof meta?.label === 'string' ? meta.label.trim() : ''),
    [meta?.label]
  );

  return (
    <section className="topdrawer">
      <div className="topdrawer-context-wrap">
        <div className="topdrawer-context">
          {hasInstance ? (
            <span className="topdrawer-instance-title topdrawer-instance-title--readonly heading-3">
              {currentLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="topdrawer-actions">
        <button
          className="diet-btn-txt"
          data-size="xl"
          data-variant="primary"
          type="button"
          disabled={!canPersist || isSaving}
          onClick={() => save()}
        >
          <span className="diet-btn-txt__label">{isSaving ? 'Saving…' : 'Save'}</span>
        </button>
        <button
          className="diet-btn-txt"
          data-size="xl"
          data-variant="primary"
          type="button"
          disabled={!canPersist}
          onClick={() => setEmbedOpen(true)}
        >
          <span className="diet-btn-txt__label">Copy code</span>
        </button>
      </div>
      <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} />
    </section>
  );
}
