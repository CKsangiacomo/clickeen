'use client';

import { useEffect, useId, useRef, useState } from 'react';

export function DieterTextarea({
  label,
  value,
  placeholder = 'Enter text',
  onChange,
  disabled = false,
  size = 'md',
}: {
  label?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const labelClass = size === 'sm' ? 'label-xs' : size === 'lg' ? 'label-m' : 'label-s';
  const bodyClass = size === 'sm' ? 'body-xs' : size === 'lg' ? 'body-m' : 'body-s';

  useEffect(() => {
    if (!open) return;
    editorRef.current?.focus({ preventScroll: true });
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="diet-textarea diet-textfield diet-popover-host" data-size={size} data-state={open ? 'open' : 'closed'}>
      <input type="hidden" className="diet-textarea__value-field" value={value} readOnly />
      <button type="button" className="diet-textfield__control diet-textarea__control" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)}>
        {label ? <span id={`${id}-label`} className={`diet-textfield__display-label ${labelClass}`}>{label}</span> : null}
        <span className={`diet-textarea__preview ${bodyClass}`} data-muted={value ? 'false' : 'true'}>{value || placeholder}</span>
      </button>
      <div className="diet-popover diet-textarea__popover" role="dialog" aria-labelledby={label ? `${id}-label` : undefined} aria-label={label ? undefined : placeholder}>
        {label ? <div className="diet-popover__header"><span className={`diet-popover__header-label ${labelClass}`}>{label}</span></div> : null}
        <div className="diet-popover__body">
          <textarea ref={editorRef} className={`diet-textarea__editor ${bodyClass}`} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
        </div>
      </div>
    </div>
  );
}
