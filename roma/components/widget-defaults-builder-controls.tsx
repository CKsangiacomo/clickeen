'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAccountFontLibraryToTypographyMenus,
  applyGroupHeaders,
  applyShowIfVisibility,
  buildShowIfEntries,
  ensureMedia,
  installClusterCollapseBehavior,
  parseBobJsonValue,
  resolvePathFromTarget,
  runHydrators,
  serializeBobJsonFieldValue,
  type AccountAssetsClient,
  type DieterMedia,
  type ShowIfEntry,
} from '@clickeen/bob/control-host';
import type { AccountFontLibrary } from '@clickeen/widget-shell';

type BuilderControlPanel = {
  id?: string;
  label?: string;
  html: string;
};

export type BuilderControlPayload = {
  widgetname?: string;
  displayName?: string;
  panels?: BuilderControlPanel[];
  media?: {
    dieter?: DieterMedia;
  };
};

export type BuilderDefaultsControl = {
  path: string;
  panelId: string;
};

type BuilderDefaultsControlsProps = {
  controls: BuilderDefaultsControl[];
  payloads: BuilderControlPayload[];
  values: Record<string, unknown>;
  fontLibrary: AccountFontLibrary;
  scopeLabel: string;
  onContractError: (message: string) => void;
  onChange: (path: string, value: unknown) => void;
  onReadyChange: (ready: boolean) => void;
};

const PANEL_ORDER = ['content', 'layout', 'appearance', 'typography', 'settings'];
const BUILDER_CONTROLS_LOAD_ERROR_COPY = 'Builder controls could not be loaded. Please try again.';

const stubAccountAssets: AccountAssetsClient = {
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

function filterPanelHtml(panel: BuilderControlPanel, allowedPaths: Set<string>): string {
  const template = document.createElement('template');
  template.innerHTML = panel.html;

  Array.from(template.content.querySelectorAll<HTMLElement>('[data-bob-group]')).forEach((group) => {
    if (!fragmentHasAllowedPath(group, allowedPaths)) group.remove();
  });

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

function collectRenderedPaths(html: string): Set<string> {
  const template = document.createElement('template');
  template.innerHTML = html;
  return new Set(
    Array.from(template.content.querySelectorAll<HTMLElement>('[data-bob-path]'))
      .map((field) => controlPath(field))
      .filter((path): path is string => Boolean(path)),
  );
}

function buildPanelHtml(
  payload: BuilderControlPayload,
  controls: BuilderDefaultsControl[],
): { html: string; missingPaths: string[] } {
  const allowedPaths = new Set(controls.map((control) => control.path));
  const panelIds = new Set(controls.map((control) => control.panelId));
  const panels = [...(payload.panels ?? [])].sort(
    (left, right) =>
      PANEL_ORDER.indexOf(left.id ?? '') - PANEL_ORDER.indexOf(right.id ?? ''),
  );
  const html = panels
    .filter((panel) => panel.id && panelIds.has(panel.id))
    .map((panel) => filterPanelHtml(panel, allowedPaths))
    .filter(Boolean)
    .join('\n');
  const renderedPaths = collectRenderedPaths(html);
  const missingPaths = controls
    .map((control) => control.path)
    .filter((path) => !renderedPaths.has(path));
  return { html, missingPaths };
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
    const nextValue = isFiniteNumber(value) ? String(value) : field.min?.trim() || '0';
    field.value = nextValue;
    field.style.setProperty('--value', nextValue);
    field.style.setProperty('--min', field.min || '0');
    field.style.setProperty('--max', field.max || '100');
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
    field instanceof HTMLInputElement && field.dataset.bobJson != null
      ? serializeBobJsonFieldValue(field, value)
      : valueForTextField(value);

  field.value = nextValue;
  if (field instanceof HTMLInputElement && field.dataset.bobJson != null) {
    field.setAttribute('data-bob-json', nextValue);
  }

  if (
    field instanceof HTMLInputElement &&
    (field.dataset.bobJson != null ||
      field.classList.contains('diet-dropdown-actions__value-field') ||
      field.classList.contains('diet-dropdown-edit__field') ||
      field.classList.contains('diet-textedit__field') ||
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

  if (target instanceof HTMLInputElement && target.dataset.bobJson != null) {
    const parsed = parseBobJsonValue(target, target.value);
    return parsed.ok ? parsed.value : target.value;
  }

  const path = resolvePathFromTarget(target);
  const current = path ? readPathValue(values, path) : undefined;
  if (isFiniteNumber(current) && target instanceof HTMLInputElement) {
    return Number.isFinite(target.valueAsNumber) ? target.valueAsNumber : target.value;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return target.value;
  }

  return undefined;
}

export function WidgetDefaultsBuilderControls({
  controls,
  fontLibrary,
  onContractError,
  onChange,
  onReadyChange,
  payloads,
  scopeLabel,
  values,
}: BuilderDefaultsControlsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const valuesRef = useRef(values);
  const showIfEntriesRef = useRef<ShowIfEntry[]>([]);
  const [contractError, setContractError] = useState('');
  valuesRef.current = values;

  const payload = payloads.find((entry) => Array.isArray(entry.panels) && entry.panels.length > 0);
  const panelBuild = useMemo(() => {
    if (!payload || typeof document === 'undefined') return { html: '', missingPaths: [] };
    return buildPanelHtml(payload, controls);
  }, [controls, payload]);
  const panelHtml = panelBuild.html;

  useEffect(() => {
    if (payload && panelHtml && panelBuild.missingPaths.length === 0) return;
    onReadyChange(false);
    if (!payload) {
      onContractError('Compiled Builder controls are unavailable.');
      return;
    }
    if (!panelHtml) {
      onContractError(`No ${scopeLabel} controls are available.`);
      return;
    }
    onContractError(
      `Compiled Builder controls are missing ${scopeLabel} paths: ${panelBuild.missingPaths.join(', ')}`,
    );
  }, [onContractError, onReadyChange, panelBuild.missingPaths, panelHtml, payload, scopeLabel]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let cleanupListeners: (() => void) | null = null;
    setContractError('');
    onReadyChange(false);
    container.hidden = true;
    container.dataset.ready = 'false';

    if (panelBuild.missingPaths.length > 0) {
      const message = `Compiled Builder controls are missing ${scopeLabel} paths: ${panelBuild.missingPaths.join(', ')}`;
      setContractError(message);
      onContractError(message);
      container.innerHTML = '';
      return;
    }

    container.innerHTML = panelHtml;
    applyGroupHeaders(container);
    container.querySelectorAll<HTMLElement>('.tdmenucontent__cluster').forEach((cluster) => {
      const body = cluster.querySelector<HTMLElement>(':scope > .tdmenucontent__cluster-body');
      applyGroupHeaders(body ?? cluster);
    });
    const cleanupCollapse = installClusterCollapseBehavior(container);
    showIfEntriesRef.current = buildShowIfEntries(container);

    ensureMedia(payload?.media?.dieter)
      .then(() => {
        if (cancelled) return;
        applyAccountFontLibraryToTypographyMenus({ container, fontLibrary });
        runHydrators(container, { accountAssets: stubAccountAssets });
        showIfEntriesRef.current = buildShowIfEntries(container);
        syncControlValues(container, valuesRef.current, showIfEntriesRef.current);
        container.addEventListener('bob-ops', handleBobOps as EventListener, true);
        container.addEventListener('input', handleInput, true);
        container.addEventListener('change', handleInput, true);
        cleanupListeners = () => {
          container.removeEventListener('bob-ops', handleBobOps as EventListener, true);
          container.removeEventListener('input', handleInput, true);
          container.removeEventListener('change', handleInput, true);
        };
        container.hidden = false;
        container.dataset.ready = 'true';
        onReadyChange(true);
      })
      .catch(() => {
        if (cancelled) return;
        const message = BUILDER_CONTROLS_LOAD_ERROR_COPY;
        setContractError(message);
        onContractError(message);
        container.innerHTML = '';
        container.hidden = false;
        container.dataset.ready = 'false';
        onReadyChange(false);
      });

    const handleBobOps = (event: Event) => {
      const detail = (event as CustomEvent<{ ops?: unknown }>).detail;
      const ops = Array.isArray(detail?.ops) ? detail.ops : [];
      if (!ops.length) return;
      event.stopPropagation();
      for (const op of ops) {
        if (!isRecord(op) || op.op !== 'set' || typeof op.path !== 'string') continue;
        onChange(op.path, op.value);
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
      onChange(path, valueFromField(target, valuesRef.current));
    };

    syncControlValues(container, valuesRef.current, showIfEntriesRef.current);

    return () => {
      cancelled = true;
      onReadyChange(false);
      cleanupListeners?.();
      cleanupCollapse();
      container.dataset.ready = 'false';
    };
  }, [
    onChange,
    onContractError,
    onReadyChange,
    panelBuild.missingPaths,
    panelHtml,
    fontLibrary,
    payload?.media?.dieter,
    scopeLabel,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    syncControlValues(container, values, showIfEntriesRef.current);
  }, [values]);

  if (!payload) {
    return <p className="body-s widget-defaults-error">Compiled Builder controls are unavailable.</p>;
  }

  if (!panelHtml) {
    return <p className="body-s widget-defaults-error">No {scopeLabel} controls are available.</p>;
  }

  if (panelBuild.missingPaths.length > 0) {
    return (
      <p className="body-s widget-defaults-error">
        Compiled Builder controls are missing {scopeLabel} paths: {panelBuild.missingPaths.join(', ')}
      </p>
    );
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
