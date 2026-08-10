'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const meta = chrome.meta;
  const currentInstanceId = typeof meta?.instanceId === 'string' ? meta.instanceId : '';
  const hasInstance = Boolean(currentInstanceId);
  const canSave = hasInstance && isDirty;
  const showSaveAction = canSave || isSaving;
  const instanceLabel = typeof meta?.label === 'string' ? meta.label.trim() : '';
  const currentLabel = instanceLabel || currentInstanceId;
  const publicActions = meta?.publicActions ?? null;

  useEffect(() => {
    if (!moreOpen) return undefined;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !moreRef.current?.contains(event.target)) {
        setMoreOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMoreOpen(false);
      moreButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [moreOpen]);

  return (
    <section className="topdrawer">
      <div className="topdrawer-leading">
        <button
          className="host-navigation-open diet-button"
          data-size="large"
          data-type="secondary"
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
          data-type="secondary"
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
      <div className="topdrawer-context-wrap">
        <div className="topdrawer-context">
          {hasInstance ? (
            <span className="topdrawer-instance-title heading-3">
              {currentLabel}
            </span>
          ) : null}
          {meta?.publishStatus ? (
            <span className="topdrawer-publish-status body-xs">
              {meta.publishStatus === 'published' ? 'Published' : 'Unpublished'}
            </span>
          ) : null}
        </div>
      </div>

      <div className="topdrawer-actions">
        {publicActions ? (
          <>
            <a
              className="diet-button"
              data-size="large"
              data-type="tertiary"
              href={publicActions.publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span className="diet-button__label">Open public widget</span>
            </a>
            <div
              className="topdrawer-more diet-popover-host"
              ref={moreRef}
              data-state={moreOpen ? 'open' : 'closed'}
            >
              <button
                ref={moreButtonRef}
                className="diet-button"
                data-size="large"
                data-type="tertiary"
                type="button"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((open) => !open)}
              >
                <span className="diet-button__label">More</span>
              </button>
              <div className="topdrawer-more__menu diet-popover" role="menu">
                <button
                  className="diet-btn-menuactions"
                  data-size="md"
                  data-variant="neutral"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    requestHostAction('copy-code');
                  }}
                >
                  <span className="diet-btn-menuactions__label body-s">Copy code</span>
                </button>
              </div>
            </div>
          </>
        ) : null}
        {showSaveAction ? (
          <button
            className="diet-button"
            data-size="large"
            data-type="primary"
            type="button"
            disabled={isSaving}
            onClick={() => save()}
          >
            <span className="diet-button__label">{isSaving ? 'Saving…' : 'Save'}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
