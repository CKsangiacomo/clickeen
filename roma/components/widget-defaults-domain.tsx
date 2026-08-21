'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CompiledControl, CompiledWidget } from '@clickeen/bob/types';
import {
  isCommonWidgetControlPath,
  type AccountFontLibrary,
} from '@clickeen/widget-foundation';
import widgetDefaultsCopy from '../l10n/widget-defaults/en.json';
import { useRomaAccountApi } from './account-api';
import { getWidgetEditorArtifact } from './widget-editor-artifact';
import { WidgetDefaultsBuilderControls } from './widget-defaults-builder-controls';
import { RomaUnsavedChangesDialog } from './roma-unsaved-changes-dialog';
import { RomaLoadingState } from './roma-system-state';

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

type WidgetDefaultsEntry = {
  widgetType: string;
  label: string;
  core: Record<string, unknown>;
  controls: CompiledControl[];
  payload: CompiledWidget;
};

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function cloneDefaults(value: AccountWidgetDefaultsDocument): AccountWidgetDefaultsDocument {
  return structuredClone(value);
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function setPathValue(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const next = cloneValue(root);
  const parts = path.split('.');
  let cursor: unknown = next;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  (cursor as Record<string, unknown>)[parts.at(-1)!] = value;
  return next;
}

function removeRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function WidgetDefaultsCoreSection(args: {
  entry: WidgetDefaultsEntry;
  fontLibrary: AccountFontLibrary;
  onOps: (widgetType: string, ops: Array<{ path: string; value: unknown }>) => void;
  onContractError: (widgetType: string) => void;
  onReadyChange: (widgetType: string, ready: boolean) => void;
}) {
  const { entry, fontLibrary, onOps, onContractError, onReadyChange } = args;
  const handleOps = useCallback(
    (ops: Array<{ path: string; value: unknown }>) => onOps(entry.widgetType, ops),
    [entry.widgetType, onOps],
  );
  const handleContractError = useCallback(
    () => onContractError(entry.widgetType),
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
        payload={entry.payload}
        fontLibrary={fontLibrary}
        hostId={`widget-defaults-core-${entry.widgetType}`}
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
  const [compiledWidgets, setCompiledWidgets] = useState<Record<string, CompiledWidget>>({});
  const [commonControlsReady, setCommonControlsReady] = useState(false);
  const [commonContractError, setCommonContractError] = useState(false);
  const [coreControlsReady, setCoreControlsReady] = useState<Record<string, boolean>>({});
  const [coreContractErrors, setCoreContractErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [reloadPending, setReloadPending] = useState(false);
  const [compiledLoading, setCompiledLoading] = useState(false);
  const [compiledFailed, setCompiledFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveReceipt, setSaveReceipt] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const allowNavigationRef = useRef(false);
  const draftRef = useRef<AccountWidgetDefaultsDocument | null>(null);
  const saveReceiptTimerRef = useRef<number | null>(null);
  draftRef.current = draft;

  const widgetTypes = useMemo(
    () =>
      draft ? Object.keys(draft.widgets).sort((left, right) => left.localeCompare(right)) : [],
    [draft],
  );
  const widgetTypesKey = widgetTypes.join('\n');
  const dirty = Boolean(baseline && draft && stableJson(baseline) !== stableJson(draft));
  const coreContractErrorEntries = widgetTypes.filter(
    (widgetType) => coreContractErrors[widgetType] === true,
  );
  const coreControlsReadyForAll =
    widgetTypes.length > 0 &&
    widgetTypes.every((widgetType) => coreControlsReady[widgetType] === true);
  const saveBlocked =
    commonContractError ||
    !commonControlsReady ||
    coreContractErrorEntries.length > 0 ||
    !coreControlsReadyForAll;
  const controlsLoaded =
    widgetTypes.length > 0 &&
    widgetTypes.every((widgetType) => Object.prototype.hasOwnProperty.call(compiledWidgets, widgetType));

  const loadDefaults = useCallback(async (options?: { command?: boolean }) => {
    const command = options?.command === true;
    if (!command) {
      setLoading(true);
    }
    try {
      const payload = await accountApi.fetchJson<WidgetDefaultsPayload>(
        '/api/account/widget-defaults',
        { method: 'GET' },
      );
      setBaseline(cloneDefaults(payload.widgetDefaults));
      setDraft(cloneDefaults(payload.widgetDefaults));
    } catch {
      setBaseline(null);
      setDraft(null);
    } finally {
      if (!command) setLoading(false);
    }
  }, [accountApi]);

  const reloadDefaults = useCallback(async () => {
    setReloadPending(true);
    try {
      await loadDefaults({ command: true });
    } finally {
      setReloadPending(false);
    }
  }, [loadDefaults]);

  useEffect(() => {
    void loadDefaults();
  }, [loadDefaults]);

  useEffect(() => {
    const requestedWidgetTypes = widgetTypesKey ? widgetTypesKey.split('\n') : [];
    if (!requestedWidgetTypes.length) return;
    let cancelled = false;
    setCompiledLoading(true);
    setCompiledFailed(false);
    Promise.all(
      requestedWidgetTypes.map(async (widgetType) => {
        const payload = await getWidgetEditorArtifact(widgetType);
        return [widgetType, payload] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setCompiledWidgets(Object.fromEntries(entries));
        setCommonControlsReady(false);
        setCommonContractError(false);
        setCoreControlsReady(
          Object.fromEntries(entries.map(([widgetType]) => [widgetType, false])),
        );
        setCoreContractErrors({});
      })
      .catch(() => {
        if (cancelled) return;
        setCompiledFailed(true);
      })
      .finally(() => {
        if (!cancelled) setCompiledLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [widgetTypesKey]);

  useEffect(() => () => {
    if (saveReceiptTimerRef.current !== null) {
      window.clearTimeout(saveReceiptTimerRef.current);
    }
  }, []);

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
    const commonWidgetType = widgetTypes[0];
    if (!commonWidgetType) return [];
    const compiled = compiledWidgets[commonWidgetType];
    if (!compiled) return [];
    return compiled.controls.filter((control) => isCommonWidgetControlPath(control.path));
  }, [compiledWidgets, widgetTypes]);

  const widgetEntries = useMemo<WidgetDefaultsEntry[]>(() => {
    if (!draft || !controlsLoaded) return [];
    return widgetTypes.map((widgetType) => {
      const core = draft.widgets[widgetType]!.core;
      const compiled = compiledWidgets[widgetType]!;
      return {
        widgetType,
        core,
        controls: compiled.controls.filter((control) => !isCommonWidgetControlPath(control.path)),
        label: compiled.displayName,
        payload: compiled,
      };
    });
  }, [compiledWidgets, controlsLoaded, draft, widgetTypes]);

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

  const reportCommonContractError = useCallback(() => {
    setCommonControlsReady(false);
    setCommonContractError(true);
  }, []);

  const setCommonReady = useCallback((ready: boolean) => {
    setCommonControlsReady(ready);
    if (ready) {
      setCommonContractError(false);
    }
  }, []);

  const reportCoreContractError = useCallback((widgetType: string) => {
    setCoreControlsReady((current) => ({ ...current, [widgetType]: false }));
    setCoreContractErrors((current) => ({ ...current, [widgetType]: true }));
  }, []);

  const setCoreReady = useCallback((widgetType: string, ready: boolean) => {
    setCoreControlsReady((current) => ({ ...current, [widgetType]: ready }));
    if (ready) {
      setCoreContractErrors((current) => removeRecordKey(current, widgetType));
    }
  }, []);

  const updateWidgetOps = useCallback(
    (widgetType: string, ops: Array<{ path: string; value: unknown }>) => {
      setDraft((current) => {
        if (!current) return current;
        const existing = current.widgets[widgetType]!;
        return {
          ...current,
          widgets: {
            ...current.widgets,
            [widgetType]: {
              ...existing,
              core: ops.reduce((core, op) => setPathValue(core, op.path, op.value), existing.core),
            },
          },
        };
      });
    },
    [],
  );

  const discard = useCallback(() => {
    if (!baseline) return;
    setDraft(cloneDefaults(baseline));
    setSaveReceipt(false);
  }, [baseline]);

  const save = useCallback(async () => {
    if (!draft || saving || saveBlocked) return;
    const snapshot = stableJson(draft);
    setSaving(true);
    setSaveReceipt(false);
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
      if (draftRef.current && stableJson(draftRef.current) === snapshot) {
        setDraft(cloneDefaults(saved));
        setSaveReceipt(true);
        if (saveReceiptTimerRef.current !== null) {
          window.clearTimeout(saveReceiptTimerRef.current);
        }
        saveReceiptTimerRef.current = window.setTimeout(() => {
          setSaveReceipt(false);
          saveReceiptTimerRef.current = null;
        }, 1000);
      }
    } catch {
      // The unchanged Save control remains the retry boundary.
    } finally {
      setSaving(false);
    }
  }, [accountApi, draft, saveBlocked, saving]);

  if (loading) {
    return <RomaLoadingState className="rd-canvas-module" />;
  }

  if (!draft) {
    return (
      <section className="rd-canvas-module" role="alert">
        <div className="rd-canvas-module__actions">
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            data-loading={reloadPending || undefined}
            type="button"
            aria-busy={reloadPending || undefined}
            onClick={() => void reloadDefaults()}
            disabled={reloadPending}
          >
            {reloadPending ? <span className="diet-spinner" aria-hidden="true" /> : null}
            <span className="diet-button__label">{widgetDefaultsCopy.reload}</span>
          </button>
        </div>
      </section>
    );
  }

  if (compiledLoading || (!controlsLoaded && !compiledFailed)) {
    return <RomaLoadingState className="rd-canvas-module" />;
  }

  if (compiledFailed || commonContractError || coreContractErrorEntries.length > 0) {
    return null;
  }

  return (
    <>
      <section className="widget-defaults">
        <div className="widget-defaults-toolbar">
          <div />
          <div className="widget-defaults-actions">
            <button
              className="diet-button"
              data-size="medium"
              data-type="tertiary"
              type="button"
              disabled={!dirty || saving || saveReceipt}
              onClick={discard}
            >
              <span className="diet-button__label">{widgetDefaultsCopy.discard}</span>
            </button>
            {saving ? (
              <button
                className="diet-button"
                data-size="medium"
                data-type="primary"
                data-tone="save"
                data-loading="true"
                type="button"
                aria-busy="true"
                disabled
              >
                <span className="diet-spinner" aria-hidden="true" />
                <span className="diet-button__label">{widgetDefaultsCopy.saving}</span>
              </button>
            ) : saveReceipt ? (
              <button
                className="diet-button"
                data-size="medium"
                data-type="primary"
                data-tone="save"
                data-state="success"
                type="button"
                disabled
              >
                <span
                  className="diet-icon diet-icon-mask"
                  aria-hidden="true"
                  style={{ '--diet-icon-source': 'url("/dieter/icons/svg/checkmark.svg")' } as CSSProperties}
                />
                <span className="diet-button__label">{widgetDefaultsCopy.saved}</span>
              </button>
            ) : dirty ? (
              <button
                className="diet-button"
                data-size="medium"
                data-type="primary"
                data-tone="save"
                type="button"
                disabled={saveBlocked}
                onClick={() => void save()}
              >
                <span className="diet-button__label">{widgetDefaultsCopy.save}</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="widget-defaults-section">
          <WidgetDefaultsBuilderControls
            controls={commonControls}
            payload={compiledWidgets[widgetTypes[0]!]!}
            fontLibrary={draft.fontLibrary}
            hostId="widget-defaults-common"
            values={draft.common}
            onOps={updateCommonOps}
            onContractError={reportCommonContractError}
            onReadyChange={setCommonReady}
          />
        </div>

        <div className="widget-defaults-toolbar widget-defaults-toolbar--secondary">
          <h2 className="heading-4">{widgetDefaultsCopy.heading}</h2>
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
        onKeepEditing={keepEditing}
        onDiscard={discardAndContinue}
      />
    </>
  );
}
