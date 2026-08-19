'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';

type RomaCommandConfirmationDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function OpenRomaCommandConfirmationDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: Omit<RomaCommandConfirmationDialogProps, 'open'>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const lifecycleRef = useRef<DialogLifecycle | null>(null);
  const decisionMadeRef = useRef(false);
  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    if (decisionMadeRef.current) return;
    decisionMadeRef.current = true;
    lifecycleRef.current?.close();
    onCancelRef.current();
  }, []);

  const handleConfirm = useCallback(() => {
    if (decisionMadeRef.current) return;
    decisionMadeRef.current = true;
    lifecycleRef.current?.close();
    onConfirmRef.current();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({
      dialog,
      initialFocus: () => cancelButtonRef.current,
      requestDismiss(reason) {
        if (reason === 'backdrop') handleCancel();
      },
    });
    lifecycleRef.current = lifecycle;
    lifecycle.open();
    return () => {
      lifecycle.destroy();
      lifecycleRef.current = null;
    };
  }, [handleCancel]);

  return (
    <dialog
      ref={dialogRef}
      className="diet-popup"
      data-size="medium"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
      <header className="diet-popup__header">
        <h2 id={titleId} className="heading-4">{title}</h2>
      </header>
      <div className="diet-popup__body">
        <p id={bodyId} className="body-m">{body}</p>
      </div>
      <footer className="diet-popup__footer">
        <div className="diet-popup__actions">
          <button
            ref={cancelButtonRef}
            className="diet-button"
            data-size="medium"
            data-type="secondary"
            type="button"
            onClick={handleCancel}
          >
            <span className="diet-button__label">Cancel</span>
          </button>
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            type="button"
            onClick={handleConfirm}
          >
            <span className="diet-button__label">{confirmLabel}</span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}

export function RomaCommandConfirmationDialog(props: RomaCommandConfirmationDialogProps) {
  if (!props.open) return null;
  return (
    <OpenRomaCommandConfirmationDialog
      title={props.title}
      body={props.body}
      confirmLabel={props.confirmLabel}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
    />
  );
}
