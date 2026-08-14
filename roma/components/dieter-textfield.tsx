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
  return (
    <div className={`diet-textfield${className ? ` ${className}` : ''}`} data-size={controlSize}>
      <label className="diet-textfield__control">
        <span className={`diet-textfield__display-label${label ? '' : ' is-hidden'}`}>{label}</span>
        <input
          {...inputProps}
          className={`diet-textfield__field${inputClassName ? ` ${inputClassName}` : ''}`}
          aria-label={inputProps['aria-label'] ?? label}
        />
      </label>
    </div>
  );
}
