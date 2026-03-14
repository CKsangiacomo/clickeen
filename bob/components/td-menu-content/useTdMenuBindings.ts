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
  isPlainRecord,
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
  readOnly: boolean;
  compiled: CompiledWidget | null;
  clearPreviewOps: () => void;
  setPreviewOps: (ops: WidgetOp[]) => ApplyWidgetOpsResult;
  requestUpsell: (reasonKey: string, detail?: string) => void;
  lastUpdateRef: MutableRefObject<LastUpdate>;
  activePathRef: MutableRefObject<string | null>;
}) {
  useEffect(() => {
    const container = args.containerRef.current;
    if (!container) return;

    const setOp = (path: string, value: unknown): WidgetOp => ({ op: 'set', path, value });

    const applyExpandedOps = (ops: WidgetOp[]) =>
      args.applyOps(expandLinkedOps({ compiled: args.compiled, instanceData: args.instanceData, ops }));

    const applySet = (path: string, rawValue: unknown) => {
      const applied = applyExpandedOps([{ op: 'set', path, value: rawValue }]);
      if (!applied.ok && process.env.NODE_ENV === 'development') {
        console.warn('[TdMenuContent] Failed to apply set op', applied.errors);
      }
    };

    const revertTargetValue = (
      target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
      path: string,
    ) => {
      const previousValue = getAt<unknown>(args.instanceData, path);

      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        target.checked = previousValue === true;
        return;
      }

      const nextValue =
        target instanceof HTMLInputElement && target.dataset.bobJson != null
          ? serializeBobJsonFieldValue(target, previousValue)
          : previousValue == null
            ? ''
            : String(previousValue);

      target.value = nextValue;

      if (target instanceof HTMLInputElement) {
        target.dispatchEvent(
          new CustomEvent('external-sync', {
            detail: { value: nextValue, source: 'bob-deny', bobIgnore: true },
          }),
        );
      }
    };

    const handleBobOpsEvent = (event: Event) => {
      if (args.readOnly) return;
      const detail = (event as any).detail;
      const ops = detail?.ops as WidgetOp[] | undefined;
      if (!Array.isArray(ops) || ops.length === 0) return;
      event.stopPropagation();
      const applied = applyExpandedOps(ops);
      if (!applied.ok && process.env.NODE_ENV === 'development') {
        console.warn('[TdMenuContent] Failed to apply ops event', applied.errors);
      }
    };

    const handleBobPreviewEvent = (event: Event) => {
      if (args.readOnly) return;
      const detail = (event as any).detail;
      if (detail?.clear) {
        event.stopPropagation();
        args.clearPreviewOps();
        return;
      }
      const ops = detail?.ops as WidgetOp[] | undefined;
      if (!Array.isArray(ops) || ops.length === 0) return;
      event.stopPropagation();
      args.setPreviewOps(expandLinkedOps({ compiled: args.compiled, instanceData: args.instanceData, ops }));
    };

    const handleUpsellEvent = (event: Event) => {
      const detail = (event as any).detail;
      const reasonKey =
        detail && typeof detail.reasonKey === 'string' ? detail.reasonKey : 'coreui.upsell.reason.flagBlocked';
      const detailText = detail && typeof detail.detail === 'string' ? detail.detail : undefined;
      event.stopPropagation();
      args.requestUpsell(reasonKey, detailText);
    };

    const handleContainerEvent = (event: Event) => {
      const detail = (event as any).detail;
      if (detail?.bobIgnore === true) return;

      const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (!target) return;
      if (target.closest('.diet-popaddlink')) return;
      const path = resolvePathFromTarget(target);
      if (!path) return;

      if (args.readOnly) {
        revertTargetValue(target, path);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        const radiusLinkMatch = path.match(/^(pod|appearance\.cardwrapper)\.radiusLinked$/);
        if (radiusLinkMatch) {
          const nextLinked = target.checked;
          const base = radiusLinkMatch[1];
          const linkedPath = `${base}.radius`;
          const tlPath = `${base}.radiusTL`;
          const trPath = `${base}.radiusTR`;
          const brPath = `${base}.radiusBR`;
          const blPath = `${base}.radiusBL`;

          const linkedValue = getAt<unknown>(args.instanceData, linkedPath);
          const tlValue = getAt<unknown>(args.instanceData, tlPath);
          const source = nextLinked ? tlValue : linkedValue;
          if (typeof source !== 'string' || !source.trim()) {
            applySet(path, nextLinked);
            return;
          }

          args.applyOps([
            setOp(path, nextLinked),
            ...(nextLinked ? [setOp(linkedPath, source)] : []),
            setOp(tlPath, source),
            setOp(trPath, source),
            setOp(brPath, source),
            setOp(blPath, source),
          ]);
          return;
        }

        const v2PaddingMatch = path.match(/^(pod|stage)\.padding\.(desktop|mobile)\.linked$/);
        if (v2PaddingMatch) {
          const nextLinked = target.checked;
          const rootKey = v2PaddingMatch[1];
          const deviceKey = v2PaddingMatch[2];
          const base = `${rootKey}.padding.${deviceKey}`;
          const allPath = `${base}.all`;
          const topPath = `${base}.top`;
          const rightPath = `${base}.right`;
          const bottomPath = `${base}.bottom`;
          const leftPath = `${base}.left`;

          const linkedValue = getAt<unknown>(args.instanceData, allPath);
          const topValue = getAt<unknown>(args.instanceData, topPath);
          const source = nextLinked ? topValue : linkedValue;
          const numberValue = coerceFiniteNumber(source);
          if (numberValue == null) {
            applySet(path, nextLinked);
            return;
          }
          args.applyOps([
            setOp(path, nextLinked),
            ...(nextLinked ? [setOp(allPath, numberValue)] : []),
            setOp(topPath, numberValue),
            setOp(rightPath, numberValue),
            setOp(bottomPath, numberValue),
            setOp(leftPath, numberValue),
          ]);
          return;
        }

        const insideShadowLinkMatch = path.match(/^(stage|pod|appearance\.cardwrapper)\.insideShadow\.linked$/);
        if (insideShadowLinkMatch) {
          const nextLinked = target.checked;
          const base = insideShadowLinkMatch[1];
          const allPath = `${base}.insideShadow.all`;
          const topPath = `${base}.insideShadow.top`;
          const rightPath = `${base}.insideShadow.right`;
          const bottomPath = `${base}.insideShadow.bottom`;
          const leftPath = `${base}.insideShadow.left`;

          const allValue = getAt<unknown>(args.instanceData, allPath);
          const topValue = getAt<unknown>(args.instanceData, topPath);
          const source = nextLinked ? topValue : allValue;
          if (!isPlainRecord(source)) {
            applySet(path, nextLinked);
            return;
          }

          const sourceShadow = source as Record<string, unknown>;
          const makeShadow = () => ({ ...sourceShadow });
          args.applyOps([
            setOp(path, nextLinked),
            ...(nextLinked ? [setOp(allPath, makeShadow())] : []),
            setOp(topPath, makeShadow()),
            setOp(rightPath, makeShadow()),
            setOp(bottomPath, makeShadow()),
            setOp(leftPath, makeShadow()),
          ]);
          return;
        }

        if (path === 'layout.itemPaddingLinked') {
          const nextLinked = target.checked;
          const linkedValue = getAt<unknown>(args.instanceData, 'layout.itemPadding');
          const topValue = getAt<unknown>(args.instanceData, 'layout.itemPaddingTop');
          const source = nextLinked ? topValue : linkedValue;
          const numberValue = coerceFiniteNumber(source);
          if (numberValue == null) {
            applySet(path, nextLinked);
            return;
          }
          args.applyOps([
            setOp('layout.itemPaddingLinked', nextLinked),
            ...(nextLinked ? [setOp('layout.itemPadding', numberValue)] : []),
            setOp('layout.itemPaddingTop', numberValue),
            setOp('layout.itemPaddingRight', numberValue),
            setOp('layout.itemPaddingBottom', numberValue),
            setOp('layout.itemPaddingLeft', numberValue),
          ]);
          return;
        }

        applySet(path, target.checked);
        return;
      }

      const rawValue = target.value;
      const currentValue = getAt(args.instanceData, path);

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
          revertTargetValue(target, path);
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
        const currentPreset = getAt<unknown>(args.instanceData, path);
        if (typeof currentPreset === 'string' && currentPreset.trim() && currentPreset !== 'custom') {
          const scaleValue = getAt<unknown>(args.instanceData, `typography.roleScales.${roleKey}.${currentPreset}`);
          const scalePx = coercePxNumber(scaleValue);
          if (scalePx != null) {
            const applied = args.applyOps([
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
    container.addEventListener('bob-preview', handleBobPreviewEvent as EventListener, true);
    container.addEventListener('bob-upsell', handleUpsellEvent as EventListener, true);
    container.addEventListener('input', handleContainerEvent, true);
    container.addEventListener('change', handleContainerEvent, true);

    const fields = Array.from(container.querySelectorAll<HTMLElement>('[data-bob-path]'));

    fields.forEach((field) => {
      const path = field.getAttribute('data-bob-path');
      if (!path) return;

      const rawValue = getAt(args.instanceData, path);
      const value =
        rawValue === undefined && args.compiled?.defaults
          ? getAt(args.compiled.defaults as Record<string, unknown>, path)
          : rawValue;

      const isActive = args.activePathRef.current === path;
      const lastUpdate = args.lastUpdateRef.current;

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
      container.removeEventListener('bob-preview', handleBobPreviewEvent as EventListener, true);
      container.removeEventListener('bob-upsell', handleUpsellEvent as EventListener, true);
      container.removeEventListener('input', handleContainerEvent, true);
      container.removeEventListener('change', handleContainerEvent, true);
    };
  }, [
    args.activePathRef,
    args.applyOps,
    args.clearPreviewOps,
    args.compiled,
    args.containerRef,
    args.instanceData,
    args.lastUpdateRef,
    args.panelHtml,
    args.readOnly,
    args.renderKey,
    args.requestUpsell,
    args.setPreviewOps,
  ]);
}
