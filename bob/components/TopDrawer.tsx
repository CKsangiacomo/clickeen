'use client';

import { useMemo, useState } from 'react';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { EmbedModal } from './EmbedModal';

export function TopDrawer() {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const { save, isSaving, isDirty } = session;
  const [embedOpen, setEmbedOpen] = useState(false);

  const meta = chrome.meta;
  const currentPublicId = typeof meta?.publicId === 'string' ? meta.publicId : '';
  const hasInstance = Boolean(currentPublicId);
  const canSave = hasInstance && isDirty;
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
        {canSave || isSaving ? (
          <button
            className="diet-btn-txt"
            data-size="xl"
            data-variant="primary"
            type="button"
            disabled={!canSave || isSaving}
            onClick={() => save()}
          >
            <span className="diet-btn-txt__label">{isSaving ? 'Saving…' : 'Save'}</span>
          </button>
        ) : null}
        <button
          className="diet-btn-txt"
          data-size="xl"
          data-variant="primary"
          type="button"
          disabled={!hasInstance}
          onClick={() => setEmbedOpen(true)}
        >
          <span className="diet-btn-txt__label">Copy code</span>
        </button>
      </div>
      <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} />
    </section>
  );
}
