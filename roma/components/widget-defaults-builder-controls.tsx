'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAccountFontLibraryToTypographyMenus,
  applyClusterGroupHeaders,
  applyGroupHeaders,
  applyShowIfVisibility,
  buildShowIfEntries,
  installClusterCollapseBehavior,
  namespaceControlHostClusterIds,
  parseDieterJsonFieldValue,
  resolvePathFromTarget,
  runHydrators,
  serializeDieterJsonFieldValue,
  expandTypographyFamilyOps,
  type AccountAssetsClient,
  type ShowIfEntry,
} from '@clickeen/bob/control-host';
import type { CompiledControl, CompiledPanel, CompiledWidget } from '@clickeen/bob/types';
import type { AccountFontLibrary } from '@clickeen/widget-foundation';

type BuilderDefaultsControlsProps = {
  controls: CompiledControl[];
  payload: CompiledWidget;
  values: Record<string, unknown>;
  fontLibrary: AccountFontLibrary;
  hostId: string;
  scopeLabel: string;
  onContractError: (message: string) => void;
  onOps: (ops: Array<{ path: string; value: unknown }>) => void;
  onReadyChange: (ready: boolean) => void;
};

const BUILDER_CONTROLS_LOAD_ERROR_COPY = 'Builder controls could not be loaded. Please try again.';

const stubAccountAssets: AccountAssetsClient = {
  resolveUploadUpsellReason: () => null,
  listAssets: async () => [],
  resolveAssets: async () => ({ assetsByRef: new Map() }),
  uploadAsset: async () => {
    throw new Error('account assets are not supported on the Widget Defaults surface');
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readPathValue(root: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let cursor: unknown = root;
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[Number(part)];
      continue;
    }
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function readValuefieldInput(
  value: number,
  control: Pick<CompiledControl, 'min' | 'max'>,
): number | null {
  if (
    !Number.isFinite(value) ||
    (typeof control.min === 'number' && value < control.min) ||
    (typeof control.max === 'number' && value > control.max)
  ) {
    return null;
  }
  return value;
}

function valueForTextField(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

function controlPath(el: Element): string | null {
  const path = el.getAttribute('data-bob-path');
  return path && path.trim() ? path.trim() : null;
}

function fragmentHasAllowedPath(root: ParentNode, allowedPaths: Set<string>): boolean {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-bob-path]')).some((field) => {
    const path = controlPath(field);
    return Boolean(path && allowedPaths.has(path));
  });
}

function filterPanelHtml(panel: CompiledPanel, allowedPaths: Set<string>): string {
  const template = document.createElement('template');
  template.innerHTML = panel.html;

  Array.from(template.content.querySelectorAll<HTMLElement>('[data-bob-group]')).forEach(
    (group) => {
      if (!fragmentHasAllowedPath(group, allowedPaths)) group.remove();
    },
  );

  Array.from(template.content.querySelectorAll<HTMLElement>('[data-bob-path]')).forEach((field) => {
    const path = controlPath(field);
    if (!path || allowedPaths.has(path)) return;
    const root =
      field.closest<HTMLElement>('[data-bob-group]') ||
      field.closest<HTMLElement>('.tdmenucontent__cluster') ||
      field;
    root.remove();
  });

  Array.from(template.content.querySelectorAll<HTMLElement>('.tdmenucontent__cluster')).forEach(
    (cluster) => {
      if (!fragmentHasAllowedPath(cluster, allowedPaths)) cluster.remove();
    },
  );

  return template.innerHTML.trim();
}

function wrapPanelHtml(panel: CompiledPanel, filteredHtml: string): string {
  const wrapper = document.createElement('section');
  wrapper.className = 'tdmenucontent__cluster';

  const header = document.createElement('div');
  header.className = 'tdmenucontent__cluster-header';

  const label = document.createElement('h3');
  label.className = 'overline-small tdmenucontent__cluster-label';
  label.textContent = panel.label;
  header.appendChild(label);

  const body = document.createElement('div');
  body.className = 'tdmenucontent__cluster-body';
  body.innerHTML = filteredHtml;

  wrapper.append(header, body);
  return wrapper.outerHTML;
}

export function buildPanelHtml(
  payload: CompiledWidget,
  controls: CompiledControl[],
): string {
  const allowedPaths = new Set(controls.map((control) => control.path));
  const panelIds = new Set(controls.map((control) => control.panelId));
  return payload.panels
    .filter((panel) => panelIds.has(panel.id))
    .map((panel) => {
      const filteredHtml = filterPanelHtml(panel, allowedPaths);
      return filteredHtml ? wrapPanelHtml(panel, filteredHtml) : '';
    })
    .filter(Boolean)
    .join('\n');
}

function syncFieldValue(field: HTMLElement, values: Record<string, unknown>) {
  const path = controlPath(field);
  if (!path) return;
  const value = readPathValue(values, path);

  if (field instanceof HTMLInputElement && field.type === 'radio') {
    field.checked = value != null && String(value) === field.value;
    return;
  }

  if (field instanceof HTMLInputElement && field.type === 'checkbox') {
    field.checked = value === true;
    return;
  }

  if (field instanceof HTMLInputElement && field.type === 'range') {
    if (!isFiniteNumber(value)) {
      throw new Error(`Slider value for "${path}" is not a finite number`);
    }
    const nextValue = String(value);
    const valueChanged = field.value !== nextValue;
    field.value = nextValue;
    if (valueChanged) {
      field.dispatchEvent(new CustomEvent('external-sync', { detail: { value: nextValue } }));
    }
    return;
  }

  if (
    !(field instanceof HTMLInputElement) &&
    !(field instanceof HTMLTextAreaElement) &&
    !(field instanceof HTMLSelectElement)
  ) {
    return;
  }

  const nextValue =
    field instanceof HTMLInputElement && field.dataset.dieterJson != null
      ? serializeDieterJsonFieldValue(field, value)
      : valueForTextField(value);
  const valueChanged = field.value !== nextValue;

  field.value = nextValue;
  if (field instanceof HTMLInputElement && field.dataset.dieterJson != null) {
    field.setAttribute('data-dieter-json', nextValue);
  }

  if (
    valueChanged &&
    field instanceof HTMLInputElement &&
    (field.dataset.dieterJson != null ||
      field.classList.contains('diet-dropdown-actions__value-field') ||
      field.classList.contains('diet-dropdown-edit__field') ||
      field.classList.contains('diet-choice-tiles__field'))
  ) {
    field.dispatchEvent(new CustomEvent('external-sync', { detail: { value: nextValue } }));
  }
}

function syncControlValues(
  container: HTMLElement,
  values: Record<string, unknown>,
  showIfEntries: ShowIfEntry[],
) {
  container
    .querySelectorAll<HTMLElement>('[data-bob-path]')
    .forEach((field) => syncFieldValue(field, values));
  applyShowIfVisibility(showIfEntries, values);
}

function valueFromField(target: HTMLElement, values: Record<string, unknown>): unknown {
  if (target instanceof HTMLInputElement && target.type === 'checkbox') return target.checked;
  if (target instanceof HTMLInputElement && target.type === 'radio') return target.value;

  if (target instanceof HTMLInputElement && target.dataset.dieterJson != null) {
    const parsed = parseDieterJsonFieldValue(target, target.value);
    return parsed.ok ? parsed.value : target.value;
  }

  const path = resolvePathFromTarget(target);
  const current = path ? readPathValue(values, path) : undefined;
  if (isFiniteNumber(current) && target instanceof HTMLInputElement) {
    return Number.isFinite(target.valueAsNumber) ? target.valueAsNumber : target.value;
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return target.value;
  }

  return undefined;
}

export function WidgetDefaultsBuilderControls({
  controls,
  fontLibrary,
  hostId,
  onContractError,
  onOps,
  onReadyChange,
  payload,
  scopeLabel,
  values,
}: BuilderDefaultsControlsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const valuesRef = useRef(values);
  const showIfEntriesRef = useRef<ShowIfEntry[]>([]);
  const [contractError, setContractError] = useState('');
  valuesRef.current = values;

  const panelHtml = useMemo(() => {
    if (typeof document === 'undefined') return '';
    return buildPanelHtml(payload, controls);
  }, [controls, payload]);

  useEffect(() => {
    if (panelHtml) return;
    onReadyChange(false);
    onContractError(`No ${scopeLabel} controls are available.`);
  }, [onContractError, onReadyChange, panelHtml, scopeLabel]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cleanupListeners: (() => void) | null = null;
    let cleanupDieterControls: (() => void) | null = null;
    setContractError('');
    onReadyChange(false);
    container.hidden = true;
    container.dataset.ready = 'false';

    container.innerHTML = panelHtml;
    namespaceControlHostClusterIds(container, hostId);
    applyGroupHeaders(container);
    container.querySelectorAll<HTMLElement>('.tdmenucontent__cluster').forEach((cluster) => {
      applyClusterGroupHeaders(cluster);
    });
    const cleanupCollapse = installClusterCollapseBehavior(container);
    showIfEntriesRef.current = buildShowIfEntries(container);

    const handleDieterOps = (event: Event) => {
      const detail = (event as CustomEvent<{ ops?: unknown }>).detail;
      const ops = Array.isArray(detail?.ops) ? detail.ops : [];
      if (!ops.length) return;
      event.stopPropagation();
      const setOps = ops.filter(
        (op): op is { op: 'set'; path: string; value: unknown } =>
          isRecord(op) && op.op === 'set' && typeof op.path === 'string',
      );
      if (!setOps.length) return;
      const expanded = expandTypographyFamilyOps({
        instanceData: valuesRef.current,
        fontLibrary,
        ops: setOps,
      });
      if (expanded) {
        onOps(
          expanded.filter(
            (op): op is { op: 'set'; path: string; value: unknown } => op.op === 'set',
          ),
        );
      }
    };

    const handleInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (
        !(
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        )
      ) {
        return;
      }
      if (target instanceof HTMLInputElement && target.type === 'radio' && !target.checked) return;
      const path = resolvePathFromTarget(target);
      if (!path) return;
      const control = controls.find((candidate) => candidate.path === path);
      let value = valueFromField(target, valuesRef.current);
      if (control?.type === 'valuefield') {
        if (!(target instanceof HTMLInputElement) || target.type !== 'number') return;
        const numericValue = readValuefieldInput(target.valueAsNumber, control);
        if (numericValue === null) return;
        value = numericValue;
      }
      const expanded = expandTypographyFamilyOps({
        instanceData: valuesRef.current,
        fontLibrary,
        ops: [{ op: 'set', path, value }],
      });
      if (expanded) {
        onOps(
          expanded.filter(
            (op): op is { op: 'set'; path: string; value: unknown } => op.op === 'set',
          ),
        );
      }
    };

    try {
      applyAccountFontLibraryToTypographyMenus({ container, fontLibrary });
      syncControlValues(container, valuesRef.current, showIfEntriesRef.current);
      cleanupDieterControls = runHydrators(container, { accountAssets: stubAccountAssets });
      showIfEntriesRef.current = buildShowIfEntries(container);
      syncControlValues(container, valuesRef.current, showIfEntriesRef.current);
      container.addEventListener('dieter-ops', handleDieterOps as EventListener, true);
      container.addEventListener('input', handleInput, true);
      container.addEventListener('change', handleInput, true);
      cleanupListeners = () => {
        container.removeEventListener('dieter-ops', handleDieterOps as EventListener, true);
        container.removeEventListener('input', handleInput, true);
        container.removeEventListener('change', handleInput, true);
      };
      container.hidden = false;
      container.dataset.ready = 'true';
      onReadyChange(true);
    } catch {
      cleanupDieterControls?.();
      const message = BUILDER_CONTROLS_LOAD_ERROR_COPY;
      setContractError(message);
      onContractError(message);
      container.innerHTML = '';
      container.hidden = false;
      container.dataset.ready = 'false';
      onReadyChange(false);
    }

    return () => {
      onReadyChange(false);
      cleanupDieterControls?.();
      cleanupListeners?.();
      cleanupCollapse();
      container.dataset.ready = 'false';
    };
  }, [
    onContractError,
    onOps,
    onReadyChange,
    controls,
    panelHtml,
    fontLibrary,
    hostId,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    syncControlValues(container, values, showIfEntriesRef.current);
  }, [values]);

  if (!panelHtml) {
    return <p className="body-s widget-defaults-error">No {scopeLabel} controls are available.</p>;
  }

  if (contractError) {
    return <p className="body-s widget-defaults-error">{contractError}</p>;
  }

  return (
    <div
      className="tdmenucontent__fields widget-defaults-builder-fields"
      data-ready="false"
      hidden
      ref={containerRef}
    />
  );
}
