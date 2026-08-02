'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';

export type DieterDropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function DieterDropdownActions({
  value,
  options,
  onChange,
  label,
  ariaLabel,
  disabled = false,
  size = 'md',
  className,
}: {
  value: string;
  options: readonly DieterDropdownOption[];
  onChange: (value: string) => void;
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const generatedId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const accessibleLabel = ariaLabel ?? label ?? 'Choose an option';
  const labelClass = size === 'sm' ? 'label-xs' : size === 'lg' ? 'label-m' : 'label-s';
  const bodyClass = size === 'sm' ? 'body-xs' : size === 'lg' ? 'body-m' : 'body-s';

  useEffect(() => {
    if (!open) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnPointerDown, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const labelId = `${generatedId}-label`;

  return (
    <div
      ref={rootRef}
      className={`diet-dropdown-actions diet-popover-host${className ? ` ${className}` : ''}`}
      data-size={size}
      data-state={open ? 'open' : 'closed'}
    >
      <input type="hidden" className="diet-dropdown-actions__value-field" value={value} readOnly />
      <button
        ref={triggerRef}
        type="button"
        className="diet-dropdown-header diet-dropdown-actions__control"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : accessibleLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {label ? (
          <span className={`diet-dropdown-header-label ${labelClass}`} id={labelId}>
            {label}
          </span>
        ) : null}
        <span className={`diet-dropdown-header-value ${bodyClass}`} data-muted={selectedOption ? 'false' : 'true'}>
          {selectedOption?.label ?? accessibleLabel}
        </span>
      </button>
      <div className="diet-popover diet-dropdown-actions__popover" role="listbox" aria-label={accessibleLabel} data-state={open ? 'open' : 'closed'}>
        <div className="diet-popover__header">
          <span className="diet-popover__header-label label-s">{accessibleLabel}</span>
        </div>
        <div className="diet-popover__body diet-dropdown-actions__menu">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={`diet-btn-menuactions diet-dropdown-actions__menuaction${selected ? ' is-selected' : ''}`}
                data-size={size}
                data-variant="neutral"
                data-value={option.value}
                data-label={option.label}
                role="option"
                aria-selected={selected}
                disabled={disabled || option.disabled}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <span className={`diet-btn-menuactions__label ${bodyClass}`}>
                  <span className="diet-dropdown-actions__menuaction-text">{option.label}</span>
                </span>
                <span className="diet-btn-menuactions__icon" aria-hidden="true">
                  <span className="diet-dropdown-actions__check diet-btn-ic" data-size="xs" data-variant="neutral" aria-hidden="true">
                    <span
                      className="diet-btn-ic__icon diet-icon-mask"
                      style={{ '--diet-icon-source': 'url("/dieter/icons/svg/checkmark.svg")' } as CSSProperties}
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
