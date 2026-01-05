'use client';

import { useEffect, useRef } from 'react';

type UpsellPopupProps = {
  open: boolean;
  reasonKey: string;
  detail?: string;
  cta: 'signup' | 'upgrade';
  onClose: () => void;
};

export function UpsellPopup({ open, reasonKey, detail, cta, onClose }: UpsellPopupProps) {
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

  const headline = cta === 'signup' ? 'Create a free account to continue' : 'Upgrade to continue';
  const primaryLabel = cta === 'signup' ? 'Create free account' : 'Upgrade plan';

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
          <div className="body-m ck-upsellModal__reason">{reasonKey}</div>
          {detail ? <div className="caption ck-upsellModal__detail">{detail}</div> : null}
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
