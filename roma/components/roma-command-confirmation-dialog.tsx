'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import ROMA_DIALOGS_UI_COPY from '../l10n/dialogs/en.json';

type RomaCommandConfirmationDialogProps = {
  open: boolean;
  title: string;
  body?: string | null;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function OpenRomaCommandConfirmationDialog({
  title,
  body,
  confirmLabel,
  pending = false,
  onCancel,
  onConfirm,
}: Omit<RomaCommandConfirmationDialogProps, 'open'>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const lifecycleRef = useRef<DialogLifecycle | null>(null);
  const confirmRequestedRef = useRef(false);
  const pendingRef = useRef(pending);
  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    pendingRef.current = pending;
    if (!pending) confirmRequestedRef.current = false;
  }, [pending]);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    if (pendingRef.current || confirmRequestedRef.current) return;
    lifecycleRef.current?.close();
    onCancelRef.current();
  }, []);

  const handleConfirm = useCallback(() => {
    if (pendingRef.current || confirmRequestedRef.current) return;
    confirmRequestedRef.current = true;
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
      aria-describedby={body ? bodyId : undefined}
    >
      <header className="diet-popup__header">
        <h2 id={titleId} className="heading-4">{title}</h2>
      </header>
      {body ? (
        <div className="diet-popup__body">
          <p id={bodyId} className="body-m">{body}</p>
        </div>
      ) : null}
      <footer className="diet-popup__footer">
        <div className="diet-popup__actions">
          <button
            ref={cancelButtonRef}
            className="diet-button"
            data-size="medium"
            data-type="secondary"
            type="button"
            onClick={handleCancel}
            disabled={pending}
          >
            <span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.cancel}</span>
          </button>
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            data-loading={pending || undefined}
            type="button"
            aria-busy={pending || undefined}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? <span className="diet-spinner" aria-hidden="true" /> : null}
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
      pending={props.pending}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
    />
  );
}
