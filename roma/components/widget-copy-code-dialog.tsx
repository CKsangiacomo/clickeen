'use client';

import { useCallback, useEffect, useRef } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import publicationCopy from '../l10n/publication/en.json';
import ROMA_DIALOGS_UI_COPY from '../l10n/dialogs/en.json';
import { copyToClipboard } from '../lib/copy-to-clipboard';
import type { WidgetPublicActions } from '../lib/public-widget-actions';

const COPY_OPTIONS = [
  { key: 'publicUrl', label: publicationCopy.widgetUrl },
  { key: 'iframeSnippet', label: publicationCopy.embedCode },
] as const;

export function WidgetCopyCodeDialog({
  open,
  actions,
  onClose,
}: {
  open: boolean;
  actions: WidgetPublicActions | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lifecycleRef = useRef<DialogLifecycle | null>(null);
  const onCloseRef = useRef(onClose);
  const openRef = useRef(open);
  const copyRequestRef = useRef(0);

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
    }
  }, [open]);

  const copy = useCallback(async (value: string) => {
    const request = ++copyRequestRef.current;
    await copyToClipboard(value);
    if (!openRef.current || request !== copyRequestRef.current) return;
  }, []);

  return (
    <dialog ref={dialogRef} className="diet-popup" aria-labelledby="roma-widget-code-title">
      <header className="diet-popup__header">
        <h2 id="roma-widget-code-title" className="heading-4">{publicationCopy.copyCode}</h2>
        <button
          className="diet-button diet-popup__dismiss"
          data-size="medium"
          data-type="quaternary"
          type="button"
          aria-label={ROMA_DIALOGS_UI_COPY.close}
          onClick={onClose}
        >
          <span className="diet-icon" data-icon="multiply" aria-hidden="true" />
        </button>
      </header>
      <div className="diet-popup__body">
        {actions ? (
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
                    aria-label={publicationCopy.copyAccessible.replace('{label}', option.label)}
                    onClick={() => void copy(actions[option.key])}
                  >
                    <span className="diet-button__label">{publicationCopy.copy}</span>
                  </button>
                </div>
                <pre className="roma-widget-code-value body-s"><code>{actions[option.key]}</code></pre>
              </section>
            ))}
          </div>
        ) : null}
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
            <span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.close}</span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}
