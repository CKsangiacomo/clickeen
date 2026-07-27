'use client';

import { useEffect, useRef } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';

export function RomaUpsellDialog({
  open,
  reason,
  onClose,
}: {
  open: boolean;
  reason?: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lifecycleRef = useRef<DialogLifecycle | null>(null);
  const onCloseRef = useRef(onClose);

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
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    if (open) lifecycle.open();
    else lifecycle.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className="roma-modal" aria-labelledby="roma-upsell-title">
      <h2 id="roma-upsell-title" className="heading-4">
        Upgrade Clickeen
      </h2>
      {reason ? <p className="body-m">{reason}</p> : null}
      <div className="roma-upsell-dialog__content" data-upsell-content />
      <div className="roma-modal__actions">
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
    </dialog>
  );
}
