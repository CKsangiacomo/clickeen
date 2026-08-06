'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildBuilderRoute, DEFAULT_INSTANCE_DISPLAY_NAME, type WidgetInstance } from './use-roma-widgets';

export function WidgetRowActions({
  activeActionKey,
  canSaveAsTemplate,
  instance,
  isRenaming,
  onDelete,
  onDuplicate,
  onRename,
  onSaveAsTemplate,
}: {
  activeActionKey: string | null;
  canSaveAsTemplate: boolean;
  instance: WidgetInstance;
  isRenaming: boolean;
  onDelete: (instance: WidgetInstance) => void;
  onDuplicate: (instance: WidgetInstance) => void;
  onRename: (instance: WidgetInstance) => void;
  onSaveAsTemplate: (instance: WidgetInstance) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const instanceName = instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME;
  const secondaryActionStatus = activeActionKey === `duplicate:${instance.instanceId}`
    ? 'Duplicating…'
    : activeActionKey === `delete:${instance.instanceId}`
      ? 'Deleting…'
      : null;

  const close = useCallback((returnFocus = false) => {
    setMenuOpen(false);
    setPosition(null);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!menuOpen || position) return undefined;
    const frame = requestAnimationFrame(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const triggerRect = trigger.getBoundingClientRect();
    const styles = getComputedStyle(popover);
    const gap = Number.parseFloat(styles.rowGap) || 0;
    const edge = Number.parseFloat(styles.paddingInlineStart) || 0;
    const top = triggerRect.bottom + gap + popover.offsetHeight <= window.innerHeight - edge
      ? triggerRect.bottom + gap
      : Math.max(edge, triggerRect.top - popover.offsetHeight - gap);
    const left = Math.min(
      window.innerWidth - popover.offsetWidth - edge,
      Math.max(edge, triggerRect.right - popover.offsetWidth),
    );
    setPosition({ top, left });
    requestAnimationFrame(() => popover.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
    });
    return () => cancelAnimationFrame(frame);
  }, [menuOpen, position]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (triggerRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) return;
      close();
    };
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key === 'Tab') {
        close();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = Array.from(popoverRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
      if (items.length === 0) return;
      event.preventDefault();
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Home') items[0]?.focus();
      else if (event.key === 'End') items.at(-1)?.focus();
      else if (event.key === 'ArrowDown') items[(currentIndex + 1 + items.length) % items.length]?.focus();
      else items[(currentIndex - 1 + items.length) % items.length]?.focus();
    };
    const closeOnViewportChange = () => close();
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnKeyDown);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnKeyDown);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [close, menuOpen]);

  useEffect(() => {
    if (activeActionKey) close();
  }, [activeActionKey, close]);

  return (
    <>
      <div className="roma-cell-actions">
        <Link
          href={buildBuilderRoute({ instanceId: instance.instanceId, widgetType: instance.widgetType })}
          className="diet-btn-txt"
          data-size="md"
          data-variant="line2"
        >
          <span className="diet-btn-txt__label body-m">Edit</span>
        </Link>
        {secondaryActionStatus ? <span className="body-xs roma-widget-action-status" role="status">{secondaryActionStatus}</span> : null}
        <button
          ref={triggerRef}
          className="diet-btn-ic"
          data-size="md"
          data-variant="neutral"
          type="button"
          aria-label={`More actions for ${instanceName}`}
          aria-haspopup="menu"
          aria-controls={`roma-widget-actions-menu-${instance.instanceId}`}
          aria-expanded={menuOpen}
          disabled={Boolean(activeActionKey) || isRenaming}
          onClick={() => menuOpen ? close() : setMenuOpen(true)}
        >
          <Image className="diet-btn-ic__icon" src="/dieter/icons/svg/ellipsis.svg" alt="" width={16} height={16} aria-hidden="true" />
        </button>
      </div>
      {menuOpen && typeof document !== 'undefined' ? createPortal(
        <div
          ref={popoverRef}
          id={`roma-widget-actions-menu-${instance.instanceId}`}
          className="diet-popover roma-widget-actions-popover"
          role="menu"
          aria-label={`Actions for ${instanceName}`}
          data-positioned={position ? 'true' : 'false'}
          style={{ top: position?.top ?? 0, left: position?.left ?? 0 }}
        >
          <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { close(); onRename(instance); }}>
            <span className="diet-btn-menuactions__label body-s">Rename</span>
          </button>
          <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { close(true); onDuplicate(instance); }}>
            <span className="diet-btn-menuactions__label body-s">Duplicate</span>
          </button>
          {canSaveAsTemplate ? (
            <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { close(); onSaveAsTemplate(instance); }}>
              <span className="diet-btn-menuactions__label body-s">Save as template</span>
            </button>
          ) : null}
          <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { close(true); onDelete(instance); }}>
            <span className="diet-btn-menuactions__label body-s">Delete</span>
          </button>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
