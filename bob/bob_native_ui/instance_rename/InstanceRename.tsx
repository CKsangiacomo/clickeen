'use client';

import { useEffect, useRef } from 'react';
import './InstanceRename.css';

interface InstanceRenameProps {
  state: 'view' | 'editing';
  value: string;
  placeholder?: string;
  ariaLabel?: string;
  onStartEditing?: () => void;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  onCancel?: () => void;
}

export function InstanceRename({
  state,
  value,
  placeholder = 'Enter instance name',
  ariaLabel = 'Rename instance',
  onStartEditing,
  onChange,
  onCommit,
  onCancel,
}: InstanceRenameProps) {
  const isEditing = state === 'editing';
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  return (
    <div className="instance-rename" data-state={state}>
      <button
        type="button"
        className="instance-rename__view"
        onClick={() => onStartEditing?.()}
        aria-label={ariaLabel}
        aria-hidden={isEditing}
        tabIndex={isEditing ? -1 : 0}
      >
        <span className="instance-rename__label">{value}</span>
      </button>

      <div className="instance-rename__edit" aria-hidden={!isEditing}>
        <input
          ref={inputRef}
          className="instance-rename__input"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onCommit(event.target.value.trim())}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onCommit(event.currentTarget.value.trim());
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onCancel?.();
            }
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
      </div>
    </div>
  );
}
