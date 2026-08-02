'use client';

import type { ComponentPropsWithoutRef } from 'react';

type TextfieldInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'className' | 'size'>;

export function DieterTextfield({
  label,
  controlSize = 'md',
  className,
  inputClassName,
  ...inputProps
}: TextfieldInputProps & {
  label?: string;
  controlSize?: 'sm' | 'md' | 'lg';
  className?: string;
  inputClassName?: string;
}) {
  const bodyClass = controlSize === 'sm' ? 'body-xs' : controlSize === 'lg' ? 'body-m' : 'body-s';
  const labelClass = controlSize === 'sm' ? 'label-xs' : controlSize === 'lg' ? 'label-m' : 'label-s';

  return (
    <div className={`diet-textfield${className ? ` ${className}` : ''}`} data-size={controlSize}>
      <label className="diet-textfield__control">
        <span className={`diet-textfield__display-label ${labelClass}${label ? '' : ' is-hidden'}`}>{label}</span>
        <input
          {...inputProps}
          className={`diet-textfield__field ${bodyClass}${inputClassName ? ` ${inputClassName}` : ''}`}
          aria-label={inputProps['aria-label'] ?? label}
        />
      </label>
    </div>
  );
}
