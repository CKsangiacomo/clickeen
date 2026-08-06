'use client';

import { resolveAccountAssetErrorCopy } from '../../dieter/components/shared/account-assets';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const UPSELL_REASONS = new Set([
  'coreui.upsell.reason.limitReached',
  'coreui.upsell.reason.platform.uploads',
]);

export function DieterImageUpload({
  value,
  onChange,
  onUpload,
  onResolve,
  onUpsell,
}: {
  value: string;
  onChange: (assetRef: string) => void;
  onUpload: (file: File) => Promise<string>;
  onResolve: (assetRef: string) => Promise<string>;
  onUpsell: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!value) {
      setPreviewUrl('');
      setError('');
      return;
    }
    setError('');
    let current = true;
    void onResolve(value).then((url) => {
      if (current) {
        setPreviewUrl(url);
        setError('');
      }
    }).catch(() => {
      if (current) setError('This image preview could not be loaded.');
    });
    return () => { current = false; };
  }, [onResolve, value]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  const upload = (file: File) => {
    setBusy(true);
    setError('');
    void onUpload(file).then(onChange).catch((uploadError) => {
      const reason = uploadError instanceof Error ? uploadError.message : '';
      if (UPSELL_REASONS.has(reason)) {
        setOpen(false);
        onUpsell();
        return;
      }
      setError(resolveAccountAssetErrorCopy(reason, 'Asset upload failed. Please try again.'));
    }).finally(() => setBusy(false));
  };

  return (
    <div ref={rootRef} className="diet-dropdown-upload diet-popover-host" data-size="md" data-state={open ? 'open' : 'closed'} data-has-file={value ? 'true' : 'false'}>
      <button ref={triggerRef} className="diet-dropdown-header diet-dropdown-upload__control" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="diet-dropdown-upload__header-icon" aria-hidden="true" />
        <span className="diet-dropdown-header-label label-s">Social image</span>
        <span className="diet-dropdown-header-value body-s" data-muted={value ? 'false' : 'true'}>{value ? 'Uploaded image' : 'Upload an image'}</span>
      </button>
      <div className="diet-popover diet-dropdown-upload__popover" role="dialog" aria-label="Social image" data-state={open ? 'open' : 'closed'}>
        <div className="diet-popover__header"><span className="diet-popover__header-label label-s">Social image</span></div>
        <div className="diet-popover__body">
          <div className="diet-dropdown-upload__panel body-xs" data-has-file={value ? 'true' : 'false'} data-kind={previewUrl ? 'image' : 'empty'}>
            <div className="diet-dropdown-upload__preview-frame">{previewUrl ? <Image className="diet-dropdown-upload__preview-img" src={previewUrl} alt="Current social image" width={320} height={160} unoptimized /> : <span className="diet-dropdown-upload__preview-empty-icon" data-icon="photo" aria-hidden="true" />}</div>
            <div className="diet-dropdown-upload__preview-error label-xs" role="alert">{error}</div>
            <div className="diet-dropdown-upload__actions">
              <button className="diet-btn-txt diet-dropdown-upload__upload-btn" data-size="lg" data-variant="line1" type="button" disabled={busy} onClick={() => fileRef.current?.click()}><span className="diet-btn-txt__label">Upload</span></button>
              <div className="diet-dropdown-upload__file-controls">
                <button className="diet-btn-txt diet-dropdown-upload__replace-btn" data-size="lg" data-variant="line1" type="button" disabled={busy} onClick={() => fileRef.current?.click()}><span className="diet-btn-txt__label">Upload new image</span></button>
                <button className="diet-btn-txt diet-dropdown-upload__remove-btn" data-size="lg" data-variant="neutral" type="button" disabled={busy} onClick={() => onChange('')}><span className="diet-btn-txt__label">Remove</span></button>
              </div>
            </div>
            <input ref={fileRef} className="diet-dropdown-upload__file-input" type="file" accept="image/*" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) upload(file); }} />
          </div>
        </div>
      </div>
    </div>
  );
}
