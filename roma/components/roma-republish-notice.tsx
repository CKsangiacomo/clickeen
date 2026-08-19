'use client';

import { useEffect, useRef } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';

export function RomaRepublishNotice({
  open,
  republishing,
  onRepublish,
  onLater,
}: {
  open: boolean;
  republishing: boolean;
  onRepublish: () => void;
  onLater: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const laterButtonRef = useRef<HTMLButtonElement>(null);
  const lifecycleRef = useRef<DialogLifecycle | null>(null);
  const onLaterRef = useRef(onLater);

  useEffect(() => {
    onLaterRef.current = onLater;
  }, [onLater]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({
      dialog,
      initialFocus: () => laterButtonRef.current,
      requestDismiss: () => onLaterRef.current(),
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
    <dialog ref={dialogRef} className="diet-popup" data-size="medium" aria-labelledby="roma-republish-title">
      <header className="diet-popup__header">
        <h2 id="roma-republish-title" className="heading-4">
          Changes are not live yet
        </h2>
      </header>
      <div className="diet-popup__body">
        <p className="body-m">
          This widget is published. Your saved changes appear on your live widget only after you republish.
        </p>
      </div>
      <footer className="diet-popup__footer">
        <div className="diet-popup__actions">
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            type="button"
            disabled={republishing}
            aria-busy={republishing || undefined}
            onClick={onRepublish}
          >
            {republishing ? <span className="diet-spinner" aria-hidden="true" /> : null}
            <span className="diet-button__label">Republish now</span>
          </button>
          <button
            ref={laterButtonRef}
            className="diet-button"
            data-size="medium"
            data-type="quaternary"
            type="button"
            disabled={republishing}
            onClick={onLater}
          >
            <span className="diet-button__label">I&rsquo;ll do it later</span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}
