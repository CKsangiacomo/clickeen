"use client";

import { useEffect, useRef, useState } from 'react';

interface TopBarProps {
  widgetName: string;
  setWidgetName: (name: string) => void;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => Promise<void> | void;
  onPublish?: () => Promise<void> | void;
  saveError?: string | null;
}

export function TopBar({ widgetName, setWidgetName, isDirty, isSaving, onSave, onPublish, saveError }: TopBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(widgetName);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isEditing) setDraftName(widgetName);
  }, [widgetName, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const input = ref.current?.querySelector<HTMLInputElement>('.diet-textrename__input');
    if (input) {
      input.focus({ preventScroll: true });
      try {
        const v = input.value;
        input.setSelectionRange(v.length, v.length);
      } catch {}
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const onDocPointerDown = (e: Event) => {
      const target = e.target as Node | null;
      const inside = ref.current && target ? ref.current.contains(target) : false;
      if (!inside) {
        setDraftName(widgetName);
        setIsEditing(false);
        ref.current?.querySelector<HTMLInputElement>('.diet-textrename__input')?.blur();
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, [isEditing, widgetName]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'inline-grid', alignItems: 'center', blockSize: 'var(--control-size-xl)' }}>
        <div
          ref={ref}
          className="diet-textrename"
          data-size="xl"
          data-state={isEditing ? 'editing' : 'view'}
          style={{ paddingInline: 'var(--space-1)', blockSize: '100%' }}
        >
          <div
            className="diet-textrename__view"
            role="button"
            aria-label="Rename widget"
            tabIndex={0}
            onClick={() => setIsEditing(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setIsEditing(true);
              }
            }}
          >
            <span className="diet-textrename__label heading-3">{widgetName || 'Untitled widget'}</span>
          </div>
          <div className="diet-textrename__edit">
            <input
              className="diet-textrename__input heading-3"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={(event) => {
                const next = event.relatedTarget as Node | null;
                if (next && ref.current?.contains(next)) return;
                setDraftName(widgetName);
                setIsEditing(false);
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const trimmed = (draftName || '').trim();
                  const finalName = trimmed.length > 0 ? trimmed : 'Untitled widget';
                  setIsEditing(false);
                  ref.current?.querySelector<HTMLInputElement>('.diet-textrename__input')?.blur();
                  setWidgetName(finalName);
                } else if (e.key === 'Escape') {
                  setDraftName(widgetName);
                  setIsEditing(false);
                  ref.current?.querySelector<HTMLInputElement>('.diet-textrename__input')?.blur();
                }
              }}
              placeholder="Untitled widget"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        {/* Status chip */}
        <span
          className="diet-btn"
          data-size="md"
          data-variant="ghost"
          aria-disabled="true"
          style={{ cursor: 'default' }}
        >
          <span className="diet-btn__label">
            {isSaving ? 'Syncing…' : saveError ? 'Sync failed' : isDirty ? 'Pending…' : 'Synced'}
          </span>
        </span>
        <button className="diet-btn" data-size="xl" data-variant="primary" type="button" onClick={() => onPublish?.()}>
          <span className="diet-btn__label">Publish</span>
        </button>
      </div>
    </div>
  );
}
