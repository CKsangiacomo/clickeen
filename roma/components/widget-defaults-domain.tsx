'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BOB_WIDGET_PANEL_IDS,
} from '@clickeen/bob/control-host';
import {
  isCommonWidgetControlPath,
  listCommonWidgetAccountDefaultMetadataPaths,
  type AccountFontLibrary,
} from '@clickeen/widget-foundation';
import { useRomaAccountApi } from './account-api';
import { getWidgetEditorArtifact } from './widget-editor-artifact';
import {
  WidgetDefaultsBuilderControls,
  type BuilderControlPayload,
} from './widget-defaults-builder-controls';
import { RomaUnsavedChangesDialog } from './roma-unsaved-changes-dialog';

type AccountWidgetDefaultsDocument = {
  accountId: string;
  fontLibrary: AccountFontLibrary;
  common: Record<string, unknown>;
  widgets: Record<
    string,
    {
      core: Record<string, unknown>;
    }
  >;
  seededAt: string;
  updatedAt: string;
};

type WidgetDefaultsPayload = {
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
};

type DefaultsControl = {
  order: number;
  panelId: string;
  groupId?: string;
  groupLabel?: string;
  type: string;
  path: string;
  label?: string;
  showIf?: string;
};

type WidgetDefaultsEntry = {
  widgetType: string;
  label: string;
  core: Record<string, unknown>;
  controls: DefaultsControl[];
  payload?: BuilderControlPayload;
};

const COMMON_SOFTWARE_METADATA_PATHS = new Set(listCommonWidgetAccountDefaultMetadataPaths());
const CORE_SOFTWARE_METADATA_PATHS = new Set(['uiLabels.core', 'typography.roleScales']);
const WIDGET_DEFAULTS_LOAD_ERROR_COPY = 'Widget defaults could not be loaded. Please try again.';
const WIDGET_CONTROLS_LOAD_ERROR_COPY = 'Builder controls could not be loaded. Please try again.';
const WIDGET_DEFAULTS_SAVE_ERROR_COPY = 'Widget defaults could not be saved. Please try again.';

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneDefaults(value: AccountWidgetDefaultsDocument): AccountWidgetDefaultsDocument {
  return JSON.parse(JSON.stringify(value)) as AccountWidgetDefaultsDocument;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function panelSortValue(panelId: string): number {
  const index = BOB_WIDGET_PANEL_IDS.findIndex((candidate) => candidate === panelId);
  return index >= 0 ? index : BOB_WIDGET_PANEL_IDS.length;
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

function pathExists(root: Record<string, unknown>, path: string): boolean {
  return typeof readPathValue(root, path) !== 'undefined';
}

function setPathValue(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const next = cloneValue(root);
  const parts = path.split('.').filter(Boolean);
  let cursor: unknown = next;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const last = index === parts.length - 1;
    const nextPart = parts[index + 1];
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(cursor)) return next;
      const offset = Number(part);
      if (last) {
        cursor[offset] = value;
        return next;
      }
      if (cursor[offset] == null) cursor[offset] = /^\d+$/.test(nextPart ?? '') ? [] : {};
      cursor = cursor[offset];
      continue;
    }
    if (!isRecord(cursor)) return next;
    if (last) {
      cursor[part] = value;
      return next;
    }
    if (!isRecord(cursor[part]) && !Array.isArray(cursor[part])) {
      cursor[part] = /^\d+$/.test(nextPart ?? '') ? [] : {};
    }
    cursor = cursor[part];
  }
  return next;
}

function removeRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function normalizeCompiledControl(raw: unknown, order: number): DefaultsControl | null {
  if (!isRecord(raw)) return null;
  const panelId = typeof raw.panelId === 'string' ? raw.panelId : '';
  const type = typeof raw.type === 'string' ? raw.type : '';
  const path = typeof raw.path === 'string' ? raw.path : '';
  if (!panelId || !type || !path) return null;
  return {
    order,
    panelId,
    type,
    path,
    ...(typeof raw.groupId === 'string' && raw.groupId ? { groupId: raw.groupId } : {}),
    ...(typeof raw.groupLabel === 'string' && raw.groupLabel ? { groupLabel: raw.groupLabel } : {}),
    ...(typeof raw.label === 'string' && raw.label ? { label: raw.label } : {}),
    ...(typeof raw.showIf === 'string' && raw.showIf ? { showIf: raw.showIf } : {}),
  };
}

function compiledControlsFromPayload(payload: unknown): DefaultsControl[] {
  if (!isRecord(payload) || !Array.isArray(payload.controls)) return [];
  return payload.controls
    .map((control, index) => normalizeCompiledControl(control, index))
    .filter((control): control is DefaultsControl => Boolean(control))
    .sort(
      (left, right) =>
        panelSortValue(left.panelId) - panelSortValue(right.panelId) || left.order - right.order,
    );
}

function compiledDisplayNameFromPayload(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : '';
  return displayName || null;
}

function uniqueControls(controls: DefaultsControl[]): DefaultsControl[] {
  const seen = new Set<string>();
  const unique: DefaultsControl[] = [];
  for (const control of controls) {
    const key = control.path;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(control);
  }
  return unique;
}

function isPathCoveredByControl(path: string, controlPaths: Set<string>): boolean {
  for (const controlPath of controlPaths) {
    if (path === controlPath || path.startsWith(`${controlPath}.`)) return true;
  }
  return false;
}

function isPathCoveredByMetadata(path: string, metadataPaths: Set<string>): boolean {
  for (const metadataPath of metadataPaths) {
    if (path === metadataPath || path.startsWith(`${metadataPath}.`)) return true;
  }
  return false;
}

function collectDefaultPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return prefix ? [prefix] : [];
  if (!isRecord(value)) return prefix ? [prefix] : [];
  const paths = Object.entries(value).flatMap(([key, child]) =>
    collectDefaultPaths(child, prefix ? `${prefix}.${key}` : key),
  );
  return paths.length > 0 ? paths : prefix ? [prefix] : [];
}

function WidgetDefaultsCoreSection(args: {
  entry: WidgetDefaultsEntry;
  fontLibrary: AccountFontLibrary;
  onOps: (
    widgetType: string,
    ops: Array<{ path: string; value: unknown }>,
  ) => void;
  onContractError: (widgetType: string, message: string) => void;
  onReadyChange: (widgetType: string, ready: boolean) => void;
}) {
  const { entry, fontLibrary, onOps, onContractError, onReadyChange } = args;
  const handleOps = useCallback(
    (ops: Array<{ path: string; value: unknown }>) => onOps(entry.widgetType, ops),
    [entry.widgetType, onOps],
  );
  const handleContractError = useCallback(
    (message: string) => onContractError(entry.widgetType, message),
    [entry.widgetType, onContractError],
  );
  const handleReadyChange = useCallback(
    (ready: boolean) => onReadyChange(entry.widgetType, ready),
    [entry.widgetType, onReadyChange],
  );

  return (
    <section className="widget-defaults-widget">
      <h3 className="heading-5">{entry.label}</h3>
      <WidgetDefaultsBuilderControls
        controls={entry.controls}
        payloads={entry.payload ? [entry.payload] : []}
        fontLibrary={fontLibrary}
        hostId={`widget-defaults-core-${entry.widgetType}`}
        scopeLabel={`${entry.label} Core`}
        values={entry.core}
        onOps={handleOps}
        onContractError={handleContractError}
        onReadyChange={handleReadyChange}
      />
    </section>
  );
}

export function WidgetDefaultsDomain() {
  const accountApi = useRomaAccountApi();
  const [baseline, setBaseline] = useState<AccountWidgetDefaultsDocument | null>(null);
  const [draft, setDraft] = useState<AccountWidgetDefaultsDocument | null>(null);
  const [compiledControls, setCompiledControls] = useState<Record<string, DefaultsControl[]>>({});
  const [compiledPayloads, setCompiledPayloads] = useState<Record<string, BuilderControlPayload>>({});
  const [compiledWidgetLabels, setCompiledWidgetLabels] = useState<Record<string, string>>({});
  const [commonControlsReady, setCommonControlsReady] = useState(false);
  const [commonContractError, setCommonContractError] = useState('');
  const [coreControlsReady, setCoreControlsReady] = useState<Record<string, boolean>>({});
  const [coreContractErrors, setCoreContractErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [compiledLoading, setCompiledLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const allowNavigationRef = useRef(false);

  const widgetTypes = useMemo(
    () =>
      draft ? Object.keys(draft.widgets).sort((left, right) => left.localeCompare(right)) : [],
    [draft],
  );
  const widgetTypesKey = widgetTypes.join('\n');
  const dirty = Boolean(baseline && draft && stableJson(baseline) !== stableJson(draft));
  const coreContractErrorEntries = widgetTypes
    .map((widgetType) => [widgetType, coreContractErrors[widgetType]] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));
  const coreControlsReadyForAll =
    widgetTypes.length > 0 && widgetTypes.every((widgetType) => coreControlsReady[widgetType] === true);
  const saveBlocked =
    Boolean(commonContractError) ||
    !commonControlsReady ||
    coreContractErrorEntries.length > 0 ||
    !coreControlsReadyForAll;
  const controlsLoaded =
    widgetTypes.length > 0 &&
    widgetTypes.every(
      (widgetType) =>
        Array.isArray(compiledControls[widgetType]) &&
        typeof compiledWidgetLabels[widgetType] === 'string' &&
        compiledWidgetLabels[widgetType].trim(),
    );

  const loadDefaults = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await accountApi.fetchJson<WidgetDefaultsPayload>(
        '/api/account/widget-defaults',
        { method: 'GET' },
      );
      setBaseline(cloneDefaults(payload.widgetDefaults));
      setDraft(cloneDefaults(payload.widgetDefaults));
    } catch {
      setError(WIDGET_DEFAULTS_LOAD_ERROR_COPY);
    } finally {
      setLoading(false);
    }
  }, [accountApi]);

  useEffect(() => {
    void loadDefaults();
  }, [loadDefaults]);

  useEffect(() => {
    const requestedWidgetTypes = widgetTypesKey.split('\n').filter(Boolean);
    if (!requestedWidgetTypes.length) return;
    let cancelled = false;
    setCompiledLoading(true);
    setError('');
    Promise.all(
      requestedWidgetTypes.map(async (widgetType) => {
        const payload = await getWidgetEditorArtifact(widgetType);
        const displayName = compiledDisplayNameFromPayload(payload);
        if (!displayName)
          throw new Error(`Compiled widget metadata missing displayName: ${widgetType}`);
        return [
          widgetType,
          displayName,
          compiledControlsFromPayload(payload),
          payload as BuilderControlPayload,
        ] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setCompiledWidgetLabels(
          Object.fromEntries(entries.map(([widgetType, displayName]) => [widgetType, displayName])),
        );
        setCompiledControls(
          Object.fromEntries(entries.map(([widgetType, , controls]) => [widgetType, controls])),
        );
        setCompiledPayloads(
          Object.fromEntries(entries.map(([widgetType, , , payload]) => [widgetType, payload])),
        );
        setCommonControlsReady(false);
        setCommonContractError('');
        setCoreControlsReady(Object.fromEntries(entries.map(([widgetType]) => [widgetType, false])));
        setCoreContractErrors({});
      })
      .catch(() => {
        if (cancelled) return;
        setError(WIDGET_CONTROLS_LOAD_ERROR_COPY);
      })
      .finally(() => {
        if (!cancelled) setCompiledLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [widgetTypesKey]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>('a[href]');
      if (!link) return;
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      pendingNavigationRef.current = () => {
        allowNavigationRef.current = true;
        link.click();
      };
      setUnsavedDialogOpen(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty]);

  const keepEditing = useCallback(() => {
    pendingNavigationRef.current = null;
    setUnsavedDialogOpen(false);
  }, []);

  const discardAndContinue = useCallback(() => {
    const action = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    setUnsavedDialogOpen(false);
    if (action) window.requestAnimationFrame(action);
  }, []);

  const commonControls = useMemo(() => {
    if (!draft) return [];
    return uniqueControls(
      Object.values(compiledControls)
        .flat()
        .filter(
          (control) =>
            isCommonWidgetControlPath(control.path) && pathExists(draft.common, control.path),
        ),
    );
  }, [compiledControls, draft]);

  const widgetEntries = useMemo<WidgetDefaultsEntry[]>(() => {
    if (!draft) return [];
    return widgetTypes.map((widgetType) => {
      const core = draft.widgets[widgetType]?.core ?? {};
      const compiledCoreControls = uniqueControls(
        (compiledControls[widgetType] ?? []).filter(
          (control) => !isCommonWidgetControlPath(control.path) && pathExists(core, control.path),
        ),
      );
      return {
        widgetType,
        core,
        controls: compiledCoreControls,
        label: compiledWidgetLabels[widgetType] ?? widgetType,
        payload: compiledPayloads[widgetType],
      };
    });
  }, [compiledControls, compiledPayloads, compiledWidgetLabels, draft, widgetTypes]);

  const unmappedDefaultPaths = useMemo(() => {
    if (!draft || !controlsLoaded) return [];
    const compiledCommonControls = uniqueControls(
      Object.values(compiledControls)
        .flat()
        .filter(
          (control) =>
            isCommonWidgetControlPath(control.path) && pathExists(draft.common, control.path),
        ),
    );
    const commonControlPaths = new Set(compiledCommonControls.map((control) => control.path));
    const commonPaths = collectDefaultPaths(draft.common)
      .filter((path) => !isPathCoveredByControl(path, commonControlPaths))
      .filter((path) => !isPathCoveredByMetadata(path, COMMON_SOFTWARE_METADATA_PATHS))
      .map((path) => `Common: ${path}`);

    const corePaths = widgetTypes.flatMap((widgetType) => {
      const core = draft.widgets[widgetType]?.core ?? {};
      const compiledCoreControls = uniqueControls(
        (compiledControls[widgetType] ?? []).filter(
          (control) => !isCommonWidgetControlPath(control.path) && pathExists(core, control.path),
        ),
      );
      const coreControlPaths = new Set(compiledCoreControls.map((control) => control.path));
      const widgetLabel = compiledWidgetLabels[widgetType] as string;
      return collectDefaultPaths(core)
        .filter((path) => !isPathCoveredByControl(path, coreControlPaths))
        .filter((path) => !isPathCoveredByMetadata(path, CORE_SOFTWARE_METADATA_PATHS))
        .map((path) => `${widgetLabel}: ${path}`);
    });

    return [...commonPaths, ...corePaths].sort((left, right) => left.localeCompare(right));
  }, [compiledControls, compiledWidgetLabels, controlsLoaded, draft, widgetTypes]);

  const updateCommonOps = useCallback((ops: Array<{ path: string; value: unknown }>) => {
        setDraft((current) =>
          current
            ? {
                ...current,
                common: ops.reduce(
                  (common, op) => setPathValue(common, op.path, op.value),
                  current.common,
                ),
              }
            : current,
    );
  }, []);

  const reportCommonContractError = useCallback((message: string) => {
    setCommonControlsReady(false);
    setCommonContractError(message);
    setError(message);
  }, []);

  const setCommonReady = useCallback((ready: boolean) => {
    setCommonControlsReady(ready);
    if (ready) {
      setCommonContractError('');
      setError('');
    }
  }, []);

  const reportCoreContractError = useCallback((widgetType: string, message: string) => {
    setCoreControlsReady((current) => ({ ...current, [widgetType]: false }));
    setCoreContractErrors((current) => ({ ...current, [widgetType]: message }));
    setError(message);
  }, []);

  const setCoreReady = useCallback((widgetType: string, ready: boolean) => {
    setCoreControlsReady((current) => ({ ...current, [widgetType]: ready }));
    if (ready) {
      setCoreContractErrors((current) => removeRecordKey(current, widgetType));
      setError('');
    }
  }, []);

  const updateWidgetOps = useCallback((
    widgetType: string,
    ops: Array<{ path: string; value: unknown }>,
  ) => {
    setDraft((current) => {
      if (!current) return current;
      const existing = current.widgets[widgetType];
      if (!existing) return current;
      return {
        ...current,
        widgets: {
          ...current.widgets,
          [widgetType]: {
            ...existing,
            core: ops.reduce(
              (core, op) => setPathValue(core, op.path, op.value),
              existing.core,
            ),
          },
        },
      };
    });
  }, []);

  const discard = useCallback(() => {
    if (!baseline) return;
    setDraft(cloneDefaults(baseline));
    setError('');
  }, [baseline]);

  const save = useCallback(async () => {
    if (!draft || saving || saveBlocked) return;
    const snapshot = stableJson(draft);
    setSaving(true);
    setError('');
    try {
      const payload = await accountApi.fetchJson<WidgetDefaultsPayload>(
        '/api/account/widget-defaults',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ widgetDefaults: draft }),
        },
      );
      const saved = cloneDefaults(payload.widgetDefaults);
      setBaseline(saved);
      setDraft((current) =>
        current && stableJson(current) !== snapshot ? current : cloneDefaults(saved),
      );
    } catch {
      setError(WIDGET_DEFAULTS_SAVE_ERROR_COPY);
    } finally {
      setSaving(false);
    }
  }, [accountApi, draft, saveBlocked, saving]);

  if (loading) {
    return <section className="rd-canvas-module body-m" role="status">Loading widget defaults...</section>;
  }

  if (!draft) {
    return (
      <section className="rd-canvas-module" role="alert">
        <p className="body-m">{error || 'Widget defaults are unavailable.'}</p>
        <div className="rd-canvas-module__actions">
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            type="button"
            onClick={() => void loadDefaults()}
          >
            <span className="diet-button__label">Reload</span>
          </button>
        </div>
      </section>
    );
  }

  if (compiledLoading || !controlsLoaded) {
    if (error && !compiledLoading) {
      return (
        <section className="rd-canvas-module widget-defaults-contract-error" role="alert">
          <div>
            <h2 className="heading-4">Widget Defaults Contract Error</h2>
            <p className="body-s widget-defaults-error">{error}</p>
          </div>
          <p className="body-m">
            Widget defaults require compiled Builder metadata. Fix the common controls or the widget spec
            before editing defaults.
          </p>
        </section>
      );
    }
    return <section className="rd-canvas-module body-m" role="status">Loading Builder controls...</section>;
  }

  if (unmappedDefaultPaths.length > 0) {
    return (
      <section className="rd-canvas-module widget-defaults-contract-error" role="alert">
        <div>
          <h2 className="heading-4">Widget Defaults Contract Error</h2>
          {error ? <p className="body-s widget-defaults-error">{error}</p> : null}
        </div>
        <p className="body-m">
          Account defaults contain paths that are not exposed by the compiled Builder control
          contract. Fix the common controls or the widget spec before editing defaults.
        </p>
        <pre className="widget-defaults-contract-error__paths body-s">
          {unmappedDefaultPaths.join('\n')}
        </pre>
      </section>
    );
  }

  if (commonContractError) {
    return (
      <section className="rd-canvas-module widget-defaults-contract-error" role="alert">
        <div>
          <h2 className="heading-4">Widget Defaults Contract Error</h2>
          <p className="body-s widget-defaults-error">{commonContractError}</p>
        </div>
        <p className="body-m">
          Widget defaults require rendered Builder controls and Dieter hydration. Fix the common controls or
          the widget spec before editing defaults.
        </p>
      </section>
    );
  }

  if (coreContractErrorEntries.length > 0) {
    return (
      <section className="rd-canvas-module widget-defaults-contract-error" role="alert">
        <div>
          <h2 className="heading-4">Widget Defaults Contract Error</h2>
          <pre className="widget-defaults-contract-error__paths body-s">
            {coreContractErrorEntries
              .map(([widgetType, message]) => `${compiledWidgetLabels[widgetType] ?? widgetType}: ${message}`)
              .join('\n')}
          </pre>
        </div>
        <p className="body-m">
          Widget defaults require rendered Builder controls and Dieter hydration. Fix the widget spec
          before editing defaults.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="widget-defaults">
        <div className="widget-defaults-toolbar">
          <div>
            {compiledLoading ? <p className="body-s" role="status">Loading Builder controls...</p> : null}
            {error ? <p className="body-s widget-defaults-error" role="alert">{error}</p> : null}
          </div>
          <div className="widget-defaults-actions">
            <button
              className="diet-button"
              data-size="medium"
              data-type="destructive"
              type="button"
              disabled={!dirty || saving}
              onClick={discard}
            >
              <span className="diet-button__label">Discard</span>
            </button>
            <button
              className="diet-button"
              data-size="medium"
              data-type="primary"
              type="button"
              disabled={!dirty || saving || saveBlocked}
              onClick={() => void save()}
            >
              <span className="diet-button__label">{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>

        <div className="widget-defaults-section">
          <WidgetDefaultsBuilderControls
            controls={commonControls}
            payloads={widgetTypes.map((widgetType) => compiledPayloads[widgetType]).filter(Boolean)}
            fontLibrary={draft.fontLibrary}
            hostId="widget-defaults-common"
            scopeLabel="All widgets"
            values={draft.common}
            onOps={updateCommonOps}
            onContractError={reportCommonContractError}
            onReadyChange={setCommonReady}
          />
        </div>

        <div className="widget-defaults-toolbar widget-defaults-toolbar--secondary">
          <h2 className="heading-4">Widget Defaults</h2>
        </div>
        <div className="widget-defaults-widgets">
          {widgetEntries.map((entry) => (
            <WidgetDefaultsCoreSection
              key={entry.widgetType}
              entry={entry}
              fontLibrary={draft.fontLibrary}
              onOps={updateWidgetOps}
              onContractError={reportCoreContractError}
              onReadyChange={setCoreReady}
            />
          ))}
        </div>
      </section>
      <RomaUnsavedChangesDialog
        open={unsavedDialogOpen}
        message="You have unsaved widget defaults."
        onKeepEditing={keepEditing}
        onDiscard={discardAndContinue}
      />
    </>
  );
}
