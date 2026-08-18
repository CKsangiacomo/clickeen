'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import { copyToClipboard } from '../lib/copy-to-clipboard';
import type { WidgetPublicActions } from '../lib/public-widget-actions';

const COPY_OPTIONS = [
  { key: 'publicUrl', label: 'Widget URL' },
  { key: 'iframeSnippet', label: 'Embed code' },
] as const;

export function WidgetCopyCodeDialog({
  open,
  instanceName,
  actions,
  onClose,
}: {
  open: boolean;
  instanceName: string;
  actions: WidgetPublicActions | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lifecycleRef = useRef<DialogLifecycle | null>(null);
  const onCloseRef = useRef(onClose);
  const openRef = useRef(open);
  const copyRequestRef = useRef(0);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({
      dialog,
      initialFocus: () => closeButtonRef.current,
      requestDismiss: () => onCloseRef.current(),
    });
    lifecycleRef.current = lifecycle;
    return () => {
      lifecycle.destroy();
      lifecycleRef.current = null;
    };
  }, []);

  useEffect(() => {
    openRef.current = open;
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    if (open) lifecycle.open();
    else {
      copyRequestRef.current += 1;
      lifecycle.close();
      setCopyStatus(null);
    }
  }, [open]);

  const copy = useCallback(async (label: string, value: string) => {
    const request = ++copyRequestRef.current;
    setCopyStatus(null);
    const copied = await copyToClipboard(value);
    if (!openRef.current || request !== copyRequestRef.current) return;
    setCopyStatus(copied ? `${label} copied` : `${label} could not be copied`);
  }, []);

  const complete = Boolean(actions?.publicUrl && actions.iframeSnippet);

  return (
    <dialog ref={dialogRef} className="diet-popup" aria-labelledby="roma-widget-code-title">
      <header className="diet-popup__header">
        <h2 id="roma-widget-code-title" className="heading-4">Copy code</h2>
        <button
          className="diet-button diet-popup__dismiss"
          data-size="medium"
          data-type="quaternary"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          <span className="diet-icon" data-icon="multiply" aria-hidden="true" />
        </button>
      </header>
      <div className="diet-popup__body">
        <p className="body-m">Use {instanceName} on your website.</p>
        {complete && actions ? (
          <div className="roma-widget-code-list">
            {COPY_OPTIONS.map((option) => (
              <section className="roma-widget-code-item" key={option.key}>
                <div className="roma-widget-code-item__header">
                  <h3 className="label-s">{option.label}</h3>
                  <button
                    className="diet-button"
                    data-size="small"
                    data-type="tertiary"
                    type="button"
                    aria-label={`Copy ${option.label}`}
                    onClick={() => void copy(option.label, actions[option.key])}
                  >
                    <span className="diet-button__label">Copy</span>
                  </button>
                </div>
                <pre className="roma-widget-code-value body-s"><code>{actions[option.key]}</code></pre>
              </section>
            ))}
          </div>
        ) : (
          <p className="body-m" role="alert">Public widget code is unavailable.</p>
        )}
        {copyStatus ? <p className="body-s" role="status">{copyStatus}</p> : null}
      </div>
      <footer className="diet-popup__footer">
        <div className="diet-popup__actions">
          <button
            ref={closeButtonRef}
            className="diet-button"
            data-size="medium"
            data-type="primary"
            type="button"
            onClick={onClose}
          >
            <span className="diet-button__label">Close</span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}
