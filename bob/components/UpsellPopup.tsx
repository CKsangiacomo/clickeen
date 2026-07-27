'use client';

import { useEffect, useRef } from 'react';
import {
  createDialogLifecycle,
  type DialogLifecycle,
} from '../../dieter/components/shared/dialog-lifecycle';

type UpsellPopupProps = {
  open: boolean;
  reasonKey: string;
  cta: 'upgrade';
  onClose: () => void;
};

function resolveUpsellReasonCopy(reasonKey: string): string {
  if (reasonKey === 'coreui.upsell.reason.limitReached') return "You've reached your plan limit.";
  if (reasonKey === 'coreui.upsell.reason.flagBlocked') return 'This option is not available on your current plan.';
  return 'This action requires a plan upgrade.';
}

export function UpsellPopup({ open, reasonKey, cta, onClose }: UpsellPopupProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lifecycleRef = useRef<DialogLifecycle | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    let lifecycle: DialogLifecycle | null = null;
    lifecycle = createDialogLifecycle({
      dialog,
      initialFocus: () => closeButtonRef.current,
      requestDismiss: () => {
        lifecycle?.close();
        onCloseRef.current();
      },
    });
    lifecycleRef.current = lifecycle;

    return () => {
      lifecycle?.destroy();
      lifecycleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    if (open) lifecycle.open();
    else lifecycle.close();
  }, [open]);

  const headline = 'Upgrade to continue';
  const primaryLabel = 'Upgrade plan';
  const reasonCopy = resolveUpsellReasonCopy(reasonKey);
  const close = () => {
    lifecycleRef.current?.close();
    onCloseRef.current();
  };

  return (
    <dialog
      ref={dialogRef}
      className="ck-upsellModal"
      aria-label="Upgrade required"
      tabIndex={-1}
    >
      <div className="ck-upsellModal__header">
        <div className="heading-3">{headline}</div>
        <div className="body-m ck-upsellModal__reason">{reasonCopy}</div>
      </div>

      <div className="ck-upsellModal__actions">
        <button
          className="diet-btn-txt"
          data-size="lg"
          data-variant="primary"
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && window.parent) {
              window.parent.postMessage({ type: 'bob:upsell', cta, reasonKey }, '*');
            }
            close();
          }}
        >
          <span className="diet-btn-txt__label">{primaryLabel}</span>
        </button>
        <button
          ref={closeButtonRef}
          className="diet-btn-txt"
          data-size="lg"
          data-variant="neutral"
          type="button"
          onClick={close}
        >
          <span className="diet-btn-txt__label">Not now</span>
        </button>
      </div>
    </dialog>
  );
}
