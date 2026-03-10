'use client';

import { useMemo, useState } from 'react';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { EmbedModal } from './EmbedModal';

export function TopDrawer() {
  const session = useWidgetSession();
  const { meta, save, isSaving, hasUnsavedChanges, discardChanges } = session;
  const [embedOpen, setEmbedOpen] = useState(false);

  const currentPublicId = typeof meta?.publicId === 'string' ? meta.publicId : '';
  const accountId = typeof meta?.accountId === 'string' ? meta.accountId : '';
  const hasInstance = Boolean(currentPublicId);
  const canPersist = hasInstance && Boolean(accountId);
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
        {hasUnsavedChanges ? (
          <>
            <button
              className="diet-btn-txt"
              data-size="xl"
              data-variant="neutral"
              type="button"
              disabled={!canPersist || isSaving}
              onClick={() => discardChanges()}
            >
              <span className="diet-btn-txt__label">Discard</span>
            </button>
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
          </>
        ) : null}
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
