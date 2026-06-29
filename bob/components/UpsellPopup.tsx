'use client';

import { useEffect, useRef } from 'react';

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
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

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

  const headline = 'Upgrade to continue';
  const primaryLabel = 'Upgrade plan';
  const reasonCopy = resolveUpsellReasonCopy(reasonKey);

  return (
    <div className="ck-upsellOverlay" role="presentation" onMouseDown={onClose}>
      <div
        className="ck-upsellModal"
        role="dialog"
        aria-modal="true"
        aria-label="Upgrade required"
        onMouseDown={(ev) => ev.stopPropagation()}
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
              onClose();
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
            onClick={onClose}
          >
            <span className="diet-btn-txt__label">Not now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
