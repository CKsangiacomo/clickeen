'use client';

import type { RefObject } from 'react';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import type { BobHostActionMessage } from '../lib/session/sessionTypes';
import { dieterIconStyle } from './dieterIcon';

function requestHostAction(action: BobHostActionMessage['action']): void {
  const message: BobHostActionMessage = { type: 'bob:host-action', action };
  window.parent?.postMessage(message, '*');
}

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
  const canSave = Boolean(meta) && isDirty;
  const showSaveAction = canSave || isSaving;

  return (
    <section className="topdrawer">
      <div className="topdrawer-leading">
        <button
          className="host-navigation-open diet-button"
          data-size="large"
          data-type="quaternary"
          type="button"
          aria-label="Open Clickeen navigation"
          onClick={() => requestHostAction('open-navigation')}
        >
          <span
            className="diet-icon"
            data-size="20"
            data-icon="rectangle.portrait.and.arrow.right"
            style={dieterIconStyle('rectangle.portrait.and.arrow.right')}
            aria-hidden="true"
          />
        </button>
        <button
          ref={toolsButtonRef}
          className="tooldrawer-open diet-button"
          data-size="large"
          data-type="quaternary"
          type="button"
          aria-label="Open tools"
          aria-expanded={toolsOpen}
          aria-controls="builder-tool-drawer"
          onClick={onOpenTools}
        >
          <span
            className="diet-icon"
            data-size="20"
            data-icon="line.3.horizontal.decrease.circle"
            style={dieterIconStyle('line.3.horizontal.decrease.circle')}
            aria-hidden="true"
          />
        </button>
      </div>
      <div className="topdrawer-context-wrap" />

      <div className="topdrawer-actions">
        {showSaveAction ? (
          <button
            className="diet-button"
            data-size="large"
            data-type="primary"
            data-loading={isSaving || undefined}
            type="button"
            aria-busy={isSaving || undefined}
            disabled={isSaving}
            onClick={() => save()}
          >
            {isSaving ? <span className="diet-spinner" aria-hidden="true" /> : null}
            <span className="diet-button__label">{isSaving ? 'Saving…' : 'Save'}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
