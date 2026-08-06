'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import { copyToClipboard } from '../lib/copy-to-clipboard';
import type { PublicActions } from '../lib/public-actions';

const COPY_OPTIONS = [
  { key: 'publicUrl', label: 'Public URL' },
  { key: 'clickeenJsSnippet', label: 'Installation code' },
] as const;

export function PublicCodeDialog({
  open,
  productName,
  actions,
  onClose,
}: {
  open: boolean;
  productName: string;
  actions: PublicActions | null;
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

  const complete = Boolean(actions?.publicUrl && actions.clickeenJsSnippet);

  return (
    <dialog ref={dialogRef} className="diet-popup" aria-labelledby="roma-public-code-title">
      <header className="diet-popup__header">
        <h2 id="roma-public-code-title" className="heading-4">Copy code</h2>
      </header>
      <div className="diet-popup__body">
        <p className="body-m">Use {productName} on your website.</p>
        {complete && actions ? (
          <div className="roma-public-code-list">
            {COPY_OPTIONS.map((option) => (
              <section className="roma-public-code-item" key={option.key}>
                <div className="roma-public-code-item__header">
                  <h3 className="label-s">{option.label}</h3>
                  <button
                    className="diet-btn-txt"
                    data-size="sm"
                    data-variant="line2"
                    type="button"
                    aria-label={`Copy ${option.label}`}
                    onClick={() => void copy(option.label, actions[option.key])}
                  >
                    <span className="diet-btn-txt__label body-s">Copy</span>
                  </button>
                </div>
                <pre className="roma-public-code-value body-s"><code>{actions[option.key]}</code></pre>
              </section>
            ))}
          </div>
        ) : (
          <p className="body-m" role="alert">Public code is unavailable.</p>
        )}
        {copyStatus ? <p className="body-s" role="status">{copyStatus}</p> : null}
      </div>
      <footer className="diet-popup__footer">
        <div className="diet-popup__actions">
          <button
            ref={closeButtonRef}
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={onClose}
          >
            <span className="diet-btn-txt__label body-m">Close</span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}
