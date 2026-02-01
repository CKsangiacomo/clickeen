'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { TdMenuContent } from './TdMenuContent';

function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeWebsiteDisplay(value: string): { href: string; label: string } | null {
  const href = normalizeWebsiteUrl(value);
  if (!href) return null;
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./i, '');
    return { href: url.toString(), label: host || href };
  } catch {
    return { href, label: href };
  }
}

type WebsiteModalProps = {
  open: boolean;
  value: string;
  onClose: () => void;
  onSave: (next: string) => void;
  onRemove: () => void;
};

function WebsiteModal({ open, value, onClose, onSave, onRemove }: WebsiteModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setError(null);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ck-websiteOverlay" role="presentation" onMouseDown={onClose}>
      <div
        className="ck-websiteModal"
        role="dialog"
        aria-modal="true"
        aria-label="Add your website"
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <div className="ck-websiteModal__header">
          <div className="heading-3">Your website</div>
          <div className="label-s label-muted">Add your website so agents can personalize this widget.</div>
        </div>

        <div className="tdmenucontent__fields">
          <div className="diet-textfield" data-size="md">
            <label className="diet-textfield__control">
              <span className="diet-textfield__display-label label-s">Website</span>
              <input
                className="diet-textfield__field body-s"
                type="url"
                placeholder="https://example.com"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
          </div>
        </div>

        {error ? <div className="settings-panel__error">{error}</div> : null}

        <div className="ck-websiteModal__actions">
          {readString(value).trim() ? (
            <button
              className="diet-btn-txt"
              data-size="lg"
              data-variant="neutral"
              type="button"
              onClick={() => {
                setDraft('');
                onRemove();
                onClose();
              }}
            >
              <span className="diet-btn-txt__label">Remove</span>
            </button>
          ) : null}
          <button
            className="diet-btn-txt"
            data-size="lg"
            data-variant="primary"
            type="button"
            onClick={() => {
              const resolved = normalizeWebsiteUrl(draft);
              if (!resolved) {
                setError('Enter a website URL.');
                return;
              }
              try {
                new URL(resolved);
              } catch {
                setError('Enter a valid website URL.');
                return;
              }
              onSave(resolved);
              onClose();
            }}
          >
            <span className="diet-btn-txt__label">Save</span>
          </button>
          <button
            ref={closeButtonRef}
            className="diet-btn-txt"
            data-size="lg"
            data-variant="neutral"
            type="button"
            onClick={onClose}
          >
            <span className="diet-btn-txt__label">Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const session = useWidgetSession();
  const compiled = session.compiled;
  const policy = session.policy;
  const settingsHtml = compiled?.panels?.find((panel) => panel.id === 'settings')?.html ?? '';

  const [websiteOpen, setWebsiteOpen] = useState(false);
  const websiteValue = readString((session.instanceData as any)?.context?.websiteUrl);
  const websiteDisplay = useMemo(() => normalizeWebsiteDisplay(websiteValue), [websiteValue]);
  const websiteEnabled = Boolean(policy.flags?.['context.website.enabled'] ?? true);

  const saveWebsite = useCallback(
    (next: string) => {
      if (!websiteEnabled) {
        session.requestUpsell('coreui.upsell.reason.website');
        return;
      }
      session.applyOps([{ op: 'set', path: 'context.websiteUrl', value: next }]);
    },
    [session, websiteEnabled]
  );

  const removeWebsite = useCallback(() => {
    if (!websiteEnabled) {
      session.requestUpsell('coreui.upsell.reason.website');
      return;
    }
    session.applyOps([{ op: 'set', path: 'context.websiteUrl', value: '' }]);
  }, [session, websiteEnabled]);

  if (!compiled) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">Settings</div>
        <div className="label-s label-muted">Load an instance to configure settings.</div>
      </div>
    );
  }

  return (
    <>
      <TdMenuContent
        panelId="settings"
        panelHtml={settingsHtml}
        widgetKey={compiled.widgetname}
        instanceData={session.instanceData}
        applyOps={session.applyOps}
        undoLastOps={session.undoLastOps}
        canUndo={session.canUndo}
        lastUpdate={session.lastUpdate}
        dieterAssets={compiled.assets.dieter}
        translateMode={false}
        readOnly={false}
        translateAllowlist={session.locale.allowlist}
        header={
          <div className="settings-panel__fullwidth">
            <button
              className="diet-btn-txt"
              data-size="lg"
              data-variant="primary"
              type="button"
              onClick={() => {
                if (!websiteEnabled) {
                  session.requestUpsell('coreui.upsell.reason.website');
                  return;
                }
                setWebsiteOpen(true);
              }}
            >
              <span className="diet-btn-txt__label">{websiteDisplay ? 'Edit your website' : 'Add your website'}</span>
            </button>
          </div>
        }
      />
      <WebsiteModal
        open={websiteOpen}
        value={websiteValue}
        onClose={() => setWebsiteOpen(false)}
        onSave={saveWebsite}
        onRemove={removeWebsite}
      />
    </>
  );
}
