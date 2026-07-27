'use client';

import { useMemo, type RefObject } from 'react';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { dieterIconStyle } from './dieterIcon';

export function TopDrawer({
  onOpenTools,
  toolsOpen,
  toolsButtonRef,
}: {
  onOpenTools: () => void;
  toolsOpen: boolean;
  toolsButtonRef: RefObject<HTMLButtonElement>;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const { save, isSaving, isDirty } = session;

  const meta = chrome.meta;
  const currentInstanceId = typeof meta?.instanceId === 'string' ? meta.instanceId : '';
  const hasInstance = Boolean(currentInstanceId);
  const canSave = hasInstance && isDirty;
  const showSaveAction = canSave || isSaving;
  const currentLabel = useMemo(
    () => {
      const label = typeof meta?.label === 'string' ? meta.label.trim() : '';
      return label || currentInstanceId;
    },
    [currentInstanceId, meta?.label]
  );

  return (
    <section className="topdrawer">
      <button
        ref={toolsButtonRef}
        className="tooldrawer-open diet-btn-ic"
        data-size="xl"
        data-variant="neutral"
        type="button"
        aria-label="Open tools"
        aria-expanded={toolsOpen}
        aria-controls="builder-tool-drawer"
        onClick={onOpenTools}
      >
        <span
          className="diet-btn-ic__icon"
          data-icon="line.3.horizontal.decrease.circle"
          style={dieterIconStyle('line.3.horizontal.decrease.circle')}
          aria-hidden="true"
        />
      </button>
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
        {showSaveAction ? (
          <button
            className="diet-btn-txt"
            data-size="xl"
            data-variant="primary"
            type="button"
            disabled={isSaving}
            onClick={() => save()}
          >
            <span className="diet-btn-txt__label">{isSaving ? 'Saving…' : 'Save'}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
