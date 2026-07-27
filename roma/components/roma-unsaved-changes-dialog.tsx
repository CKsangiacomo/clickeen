'use client';

import { useEffect, useRef } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';

export function RomaUnsavedChangesDialog({
  open,
  message,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean;
  message: string;
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
    <dialog ref={dialogRef} className="roma-modal" aria-labelledby="roma-unsaved-title">
      <h2 id="roma-unsaved-title" className="heading-4">
        Unsaved changes
      </h2>
      <p className="body-m">{message}</p>
      <div className="roma-modal__actions">
        <button
          ref={keepButtonRef}
          className="diet-btn-txt"
          data-size="md"
          data-variant="secondary"
          type="button"
          onClick={onKeepEditing}
        >
          <span className="diet-btn-txt__label body-m">Keep editing</span>
        </button>
        <button
          className="diet-btn-txt"
          data-size="md"
          data-variant="primary"
          type="button"
          onClick={onDiscard}
        >
          <span className="diet-btn-txt__label body-m">Discard</span>
        </button>
      </div>
    </dialog>
  );
}
