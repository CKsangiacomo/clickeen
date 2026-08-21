'use client';

import { useEffect, useRef } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import ROMA_DIALOGS_UI_COPY from '../l10n/dialogs/en.json';

export function RomaUnsavedChangesDialog({
  open,
  message,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean;
  message?: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);
  const lifecycleRef = useRef<DialogLifecycle | null>(null);
  const keepRef = useRef(onKeepEditing);

  useEffect(() => {
    keepRef.current = onKeepEditing;
  }, [onKeepEditing]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({
      dialog,
      initialFocus: () => keepButtonRef.current,
      requestDismiss(reason) {
        if (reason === 'escape') keepRef.current();
      },
    });
    lifecycleRef.current = lifecycle;
    return () => {
      lifecycle.destroy();
      lifecycleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    if (open) lifecycle.open();
    else lifecycle.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className="diet-popup" data-size="medium" aria-labelledby="roma-unsaved-title">
      <header className="diet-popup__header">
        <h2 id="roma-unsaved-title" className="heading-4">
          {ROMA_DIALOGS_UI_COPY.unsaved.title}
        </h2>
      </header>
      {message ? (
        <div className="diet-popup__body">
          <p className="body-m">{message}</p>
        </div>
      ) : null}
      <footer className="diet-popup__footer">
        <div className="diet-popup__actions">
          <button
            ref={keepButtonRef}
            className="diet-button"
            data-size="medium"
            data-type="secondary"
            type="button"
            onClick={onKeepEditing}
          >
            <span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.unsaved.keepEditing}</span>
          </button>
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            type="button"
            onClick={onDiscard}
          >
            <span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.unsaved.discard}</span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}
