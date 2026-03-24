'use client';

import { useEffect, type MutableRefObject } from 'react';
import type { ApplyWidgetOpsResult, WidgetOp } from '../../lib/ops';
import type { CompiledWidget } from '../../lib/types';
import { getAt } from '../../lib/utils/paths';
import { syncSegmentedPressedState } from './dom';
import {
  coerceFiniteNumber,
  coercePxNumber,
  expandLinkedOps,
  isFiniteNumber,
} from './linkedOps';
import {
  parseBobJsonValue,
  resolvePathFromTarget,
  serializeBobJsonFieldValue,
} from './fieldValue';

type LastUpdate = {
  source: 'field' | 'load' | 'external' | 'ops' | 'unknown';
  path: string;
  ts: number;
} | null;

export function useTdMenuBindings(args: {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  instanceData: Record<string, unknown>;
  applyOps: (ops: WidgetOp[]) => ApplyWidgetOpsResult;
  panelHtml: string;
  renderKey: number;
  compiled: CompiledWidget | null;
  requestUpsell: (reasonKey: string, detail?: string) => void;
  lastUpdateRef: MutableRefObject<LastUpdate>;
  activePathRef: MutableRefObject<string | null>;
}) {
  const {
    activePathRef,
    applyOps,
    compiled,
    containerRef,
    instanceData,
    lastUpdateRef,
    panelHtml,
    renderKey,
    requestUpsell,
  } = args;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const applyExpandedOps = (ops: WidgetOp[]) =>
      applyOps(expandLinkedOps({ compiled, instanceData, ops }));

    const applySet = (path: string, rawValue: unknown) => {
      const applied = applyExpandedOps([{ op: 'set', path, value: rawValue }]);
      if (!applied.ok && process.env.NODE_ENV === 'development') {
        console.warn('[TdMenuContent] Failed to apply set op', applied.errors);
      }
    };

    const handleBobOpsEvent = (event: Event) => {
      const detail = (event as any).detail;
      const ops = detail?.ops as WidgetOp[] | undefined;
      if (!Array.isArray(ops) || ops.length === 0) return;
      event.stopPropagation();
      const applied = applyExpandedOps(ops);
      if (!applied.ok && process.env.NODE_ENV === 'development') {
        console.warn('[TdMenuContent] Failed to apply ops event', applied.errors);
      }
    };

    const handleUpsellEvent = (event: Event) => {
      const detail = (event as any).detail;
      const reasonKey =
        detail && typeof detail.reasonKey === 'string' ? detail.reasonKey : 'coreui.upsell.reason.flagBlocked';
      const detailText = detail && typeof detail.detail === 'string' ? detail.detail : undefined;
      event.stopPropagation();
      requestUpsell(reasonKey, detailText);
    };

    const handleContainerEvent = (event: Event) => {
      const detail = (event as any).detail;
      if (detail?.bobIgnore === true) return;

      const target = event.target;
      if (!target) return;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest('.diet-popaddlink')) return;
      if (
        !(
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        )
      ) {
        return;
      }
      const path = resolvePathFromTarget(target);
      if (!path) return;

      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        applySet(path, target.checked);
        return;
      }

      const rawValue = target.value;
      const currentValue = getAt(instanceData, path);

      if (target instanceof HTMLInputElement && target.dataset.bobJson != null) {
        const parsed = parseBobJsonValue(target, rawValue);
        if (parsed == null) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[TdMenuContent] Ignoring invalid JSON input for path', path);
          }
          return;
        }
        const applied = applyExpandedOps([{ op: 'set', path, value: parsed }]);
        if (!applied.ok) {
          const previousValue = getAt<unknown>(instanceData, path);
          const nextValue = serializeBobJsonFieldValue(target, previousValue);
          target.value = nextValue;
          target.dispatchEvent(
            new CustomEvent('external-sync', {
              detail: { value: nextValue, source: 'bob-deny', bobIgnore: true },
            }),
          );
          if (process.env.NODE_ENV === 'development') {
            console.warn('[TdMenuContent] Denied JSON input for path', path, applied.errors);
          }
        }
        return;
      }

      const sizeCustomMatch = path.match(/^typography\.roles\.([^.]+)\.sizeCustom$/);
      if (sizeCustomMatch) {
        const trimmed = rawValue.trim();
        if (!trimmed) return;
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[TdMenuContent] Ignoring invalid typography sizeCustom input for path', path);
          }
          return;
        }
        applySet(path, parsed);
        return;
      }

      if (isFiniteNumber(currentValue)) {
        const trimmed = rawValue.trim();
        if (!trimmed) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[TdMenuContent] Ignoring empty numeric input for path', path);
          }
          return;
        }
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[TdMenuContent] Ignoring invalid numeric input for path', path);
          }
          return;
        }
        applySet(path, parsed);
        return;
      }

      const sizePresetMatch = path.match(/^typography\.roles\.([^.]+)\.sizePreset$/);
      if (sizePresetMatch && rawValue === 'custom') {
        const roleKey = sizePresetMatch[1];
        const currentPreset = getAt<unknown>(instanceData, path);
        if (typeof currentPreset === 'string' && currentPreset.trim() && currentPreset !== 'custom') {
          const scaleValue = getAt<unknown>(instanceData, `typography.roleScales.${roleKey}.${currentPreset}`);
          const scalePx = coercePxNumber(scaleValue);
          if (scalePx != null) {
            const applied = applyOps([
              { op: 'set', path: `typography.roles.${roleKey}.sizeCustom`, value: scalePx },
              { op: 'set', path, value: rawValue },
            ]);
            if (!applied.ok && process.env.NODE_ENV === 'development') {
              console.warn('[TdMenuContent] Failed to apply typography sizePreset ops', applied.errors);
            }
            return;
          }
        }
      }

      applySet(path, rawValue);
    };

    container.addEventListener('bob-ops', handleBobOpsEvent as EventListener, true);
    container.addEventListener('bob-upsell', handleUpsellEvent as EventListener, true);
    container.addEventListener('input', handleContainerEvent, true);
    container.addEventListener('change', handleContainerEvent, true);

    const fields = Array.from(container.querySelectorAll<HTMLElement>('[data-bob-path]'));

    fields.forEach((field) => {
      const path = field.getAttribute('data-bob-path');
      if (!path) return;

      const value = getAt(instanceData, path);

      const isActive = activePathRef.current === path;
      const lastUpdate = lastUpdateRef.current;

      if (field instanceof HTMLInputElement && field.type === 'radio') {
        const nextChecked = value != null && String(value) === field.value;
        if (!isActive && field.checked !== nextChecked) {
          field.checked = nextChecked;
          syncSegmentedPressedState(field);
        } else if (!isActive) {
          syncSegmentedPressedState(field);
        }
        return;
      }

      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        const nextChecked = value === true;
        if (isActive) return;
        if (field.checked !== nextChecked) {
          field.checked = nextChecked;
        }
        return;
      }

      if (field instanceof HTMLInputElement && field.type === 'range') {
        if (isActive) return;
        const fallback = field.min?.trim() || '0';
        const resolvedNumber = coerceFiniteNumber(value);
        const resolvedValue = resolvedNumber == null ? fallback : String(resolvedNumber);
        if (field.value !== resolvedValue) {
          field.value = resolvedValue;
        }
        field.style.setProperty('--value', resolvedValue);
        field.style.setProperty('--min', field.min || '0');
        field.style.setProperty('--max', field.max || '100');
        return;
      }

      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
        return;
      }

      let nextValue =
        field instanceof HTMLInputElement && field.dataset.bobJson != null
          ? serializeBobJsonFieldValue(field, value)
          : value == null
            ? ''
            : String(value);

      const sizeCustomMatch = path.match(/^typography\.roles\.([^.]+)\.sizeCustom$/);
      if (sizeCustomMatch && field instanceof HTMLInputElement && field.type === 'number') {
        const numberValue = coercePxNumber(value);
        nextValue = numberValue == null ? '' : String(numberValue);
      }

      const currentValue = field.value;
      const unchanged = currentValue === nextValue;
      const isEcho = lastUpdate && lastUpdate.source === 'ops' && lastUpdate.path === path;
      if (isActive || unchanged || isEcho) return;

      field.value = nextValue;
      if (!(field instanceof HTMLInputElement)) return;

      if (field.dataset.bobJson != null) {
        field.dispatchEvent(
          new CustomEvent('external-sync', {
            detail: { value: nextValue, source: 'tdmenu' },
          }),
        );
      } else if (field.classList.contains('diet-dropdown-edit__field')) {
        field.dispatchEvent(
          new CustomEvent('external-sync', {
            detail: { value: nextValue, source: 'tdmenu' },
          }),
        );
      } else if (field.classList.contains('diet-textedit__field')) {
        field.dispatchEvent(new CustomEvent('external-sync', { detail: { value: nextValue } }));
      }
    });

    return () => {
      container.removeEventListener('bob-ops', handleBobOpsEvent as EventListener, true);
      container.removeEventListener('bob-upsell', handleUpsellEvent as EventListener, true);
      container.removeEventListener('input', handleContainerEvent, true);
      container.removeEventListener('change', handleContainerEvent, true);
    };
  }, [
    activePathRef,
    applyOps,
    compiled,
    containerRef,
    instanceData,
    lastUpdateRef,
    panelHtml,
    renderKey,
    requestUpsell,
  ]);
}
