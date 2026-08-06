'use client';

import { useEffect, useRef } from 'react';
import { createDialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';

export function CatalogAssetChoiceDialog({
  open,
  product,
  copying,
  error,
  onCopy,
  onDiscard,
}: {
  open: boolean;
  product: 'widget' | 'page';
  copying: boolean;
  error: string | null;
  onCopy: () => void;
  onDiscard: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({
      dialog,
      initialFocus: () => dialog.querySelector('button'),
      requestDismiss: () => undefined,
    });
    if (open) lifecycle.open();
    else lifecycle.close();
    return () => lifecycle.destroy();
  }, [open]);

  return (
    <dialog ref={dialogRef} className="diet-popup" data-size="medium" aria-labelledby={`catalog-${product}-assets-title`}>
      <header className="diet-popup__header">
        <h2 id={`catalog-${product}-assets-title`} className="heading-4">This {product} includes assets</h2>
      </header>
      <div className="diet-popup__body">
        <p className="body-m">This {product} includes assets (images/SVGs/videos).</p>
        {error ? <p className="body-s" role="alert">{error}</p> : null}
      </div>
      <footer className="diet-popup__footer">
        <div className="diet-popup__actions">
          <button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" disabled={copying} onClick={onDiscard}>
            <span className="diet-btn-txt__label body-m">Discard assets</span>
          </button>
          <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" disabled={copying} onClick={onCopy}>
            <span className="diet-btn-txt__label body-m">{copying ? 'Copying…' : 'Copy assets in my assets folder'}</span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}
