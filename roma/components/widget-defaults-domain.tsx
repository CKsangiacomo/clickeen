'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CompiledControl, CompiledWidget } from '@clickeen/bob/types';
import {
  isCommonWidgetControlPath,
  type AccountFontLibrary,
} from '@clickeen/widget-foundation';
import widgetDefaultsCopy from '../l10n/widget-defaults/en.json';
import { useRomaAccountApi } from './account-api';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { getWidgetEditorArtifact } from './widget-editor-artifact';
import { WidgetDefaultsBuilderControls } from './widget-defaults-builder-controls';
import { RomaUnsavedChangesDialog } from './roma-unsaved-changes-dialog';
import { RomaLoadingState } from './roma-system-state';

type AccountWidgetDefaultsDocument = {
  accountId: string;
  fontLibrary: AccountFontLibrary;
  common: Record<string, unknown>;
  widgets: Record<string, { core: Record<string, unknown> }>;
  seededAt: string;
  updatedAt: string;
};

type WidgetDefinition = {
  widgetType: string;
  displayName: string;
  description: string;
};

type WidgetDefaultsLoadPayload = {
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
  widgetDefinitions: WidgetDefinition[];
};

type WidgetDefaultsSavePayload = {
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
};

type WidgetCoreOp = { path: string; value: unknown };

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function cloneDefaults(value: AccountWidgetDefaultsDocument): AccountWidgetDefaultsDocument {
  return structuredClone(value);
}

function setPathValue(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const next = structuredClone(root);
  const parts = path.split('.');
  let cursor: unknown = next;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor = (cursor as Record<string, unknown>)[parts[index]!];
  }
  (cursor as Record<string, unknown>)[parts.at(-1)!] = value;
  return next;
}

export function resolveEffectiveWidgetCore(args: {
  widgetDefaults: AccountWidgetDefaultsDocument;
  widgetType: string;
  deployedCoreDefaults: Record<string, unknown>;
}): Record<string, unknown> {
  return Object.prototype.hasOwnProperty.call(args.widgetDefaults.widgets, args.widgetType)
    ? args.widgetDefaults.widgets[args.widgetType]!.core
    : args.deployedCoreDefaults;
}

export function applyWidgetCoreOps(args: {
  widgetDefaults: AccountWidgetDefaultsDocument;
  widgetType: string;
  deployedCoreDefaults: Record<string, unknown>;
  ops: WidgetCoreOp[];
}): AccountWidgetDefaultsDocument {
  const effectiveCore = resolveEffectiveWidgetCore(args);
  const editedCore = args.ops.reduce(
    (core, op) => setPathValue(core, op.path, op.value),
    effectiveCore,
  );
  return {
    ...args.widgetDefaults,
    widgets: {
      ...args.widgetDefaults.widgets,
      [args.widgetType]: { core: editedCore },
    },
  };
}

function WidgetDefaultsCoreSection(args: {
  widgetType: string;
  label: string;
  core: Record<string, unknown>;
  controls: CompiledControl[];
  payload: CompiledWidget;
  fontLibrary: AccountFontLibrary;
  onOps: (ops: WidgetCoreOp[]) => void;
  onContractError: () => void;
  onReadyChange: (ready: boolean) => void;
}) {
  return (
    <section className="widget-defaults-widget">
      <h3 className="heading-5">{args.label}</h3>
      <WidgetDefaultsBuilderControls
        controls={args.controls}
        payload={args.payload}
        fontLibrary={args.fontLibrary}
        hostId={`widget-defaults-core-${args.widgetType}`}
        values={args.core}
        onOps={args.onOps}
        onContractError={args.onContractError}
        onReadyChange={args.onReadyChange}
      />
    </section>
  );
}

export function WidgetDefaultsDomain() {
  const accountApi = useRomaAccountApi();
  const [baseline, setBaseline] = useState<AccountWidgetDefaultsDocument | null>(null);
  const [draft, setDraft] = useState<AccountWidgetDefaultsDocument | null>(null);
  const [widgetDefinitions, setWidgetDefinitions] = useState<WidgetDefinition[]>([]);
  const [selectedWidgetType, setSelectedWidgetType] = useState<string | null>(null);
  const [loadedWidget, setLoadedWidget] = useState<{
    widgetType: string;
    payload: CompiledWidget;
  } | null>(null);
  const [commonControlsReady, setCommonControlsReady] = useState(false);
  const [commonContractError, setCommonContractError] = useState(false);
  const [coreControlsReady, setCoreControlsReady] = useState(false);
  const [coreContractError, setCoreContractError] = useState(false);
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

  const compiledWidget =
    loadedWidget?.widgetType === selectedWidgetType ? loadedWidget.payload : null;

  const dirty = Boolean(baseline && draft && stableJson(baseline) !== stableJson(draft));
  const saveBlocked =
    !compiledWidget ||
    commonContractError ||
    !commonControlsReady ||
    coreContractError ||
    !coreControlsReady;

  const loadDefaults = useCallback(async (options?: { command?: boolean }) => {
    const command = options?.command === true;
    if (!command) setLoading(true);
    try {
      const payload = await accountApi.fetchJson<WidgetDefaultsLoadPayload>(
        '/api/account/widget-defaults',
        { method: 'GET' },
      );
      setBaseline(cloneDefaults(payload.widgetDefaults));
      setDraft(cloneDefaults(payload.widgetDefaults));
      setWidgetDefinitions(payload.widgetDefinitions);
      setSelectedWidgetType((current) =>
        current && payload.widgetDefinitions.some((entry) => entry.widgetType === current)
          ? current
          : payload.widgetDefinitions[0]?.widgetType ?? null,
      );
    } catch {
      setBaseline(null);
      setDraft(null);
      setWidgetDefinitions([]);
      setSelectedWidgetType(null);
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
    if (!selectedWidgetType) {
      setLoadedWidget(null);
      setCompiledLoading(false);
      setCompiledFailed(false);
      return;
    }
    let cancelled = false;
    setCompiledLoading(true);
    setCompiledFailed(false);
    setCommonControlsReady(false);
    setCommonContractError(false);
    setCoreControlsReady(false);
    setCoreContractError(false);
    getWidgetEditorArtifact(selectedWidgetType)
      .then((payload) => {
        if (!cancelled) setLoadedWidget({ widgetType: selectedWidgetType, payload });
      })
      .catch(() => {
        if (!cancelled) setCompiledFailed(true);
      })
      .finally(() => {
        if (!cancelled) setCompiledLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedWidgetType]);

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

  const selectedDefinition = useMemo(
    () => widgetDefinitions.find((entry) => entry.widgetType === selectedWidgetType) ?? null,
    [selectedWidgetType, widgetDefinitions],
  );
  const selectorOptions = useMemo(
    () => widgetDefinitions.map((entry) => ({ value: entry.widgetType, label: entry.displayName })),
    [widgetDefinitions],
  );
  const commonControls = useMemo(
    () => compiledWidget?.controls.filter((control) => isCommonWidgetControlPath(control.path)) ?? [],
    [compiledWidget],
  );
  const coreControls = useMemo(
    () => compiledWidget?.controls.filter((control) => !isCommonWidgetControlPath(control.path)) ?? [],
    [compiledWidget],
  );
  const effectiveCore = useMemo(
    () =>
      draft && compiledWidget && selectedWidgetType
        ? resolveEffectiveWidgetCore({
            widgetDefaults: draft,
            widgetType: selectedWidgetType,
            deployedCoreDefaults: compiledWidget.coreDefaults,
          })
        : null,
    [compiledWidget, draft, selectedWidgetType],
  );

  const updateCommonOps = useCallback((ops: WidgetCoreOp[]) => {
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

  const updateWidgetOps = useCallback((ops: WidgetCoreOp[]) => {
    if (!selectedWidgetType || !compiledWidget) return;
    setDraft((current) =>
      current
        ? applyWidgetCoreOps({
            widgetDefaults: current,
            widgetType: selectedWidgetType,
            deployedCoreDefaults: compiledWidget.coreDefaults,
            ops,
          })
        : current,
    );
  }, [compiledWidget, selectedWidgetType]);

  const reportCommonContractError = useCallback(() => {
    setCommonControlsReady(false);
    setCommonContractError(true);
  }, []);

  const setCommonReady = useCallback((ready: boolean) => {
    setCommonControlsReady(ready);
    if (ready) setCommonContractError(false);
  }, []);

  const reportCoreContractError = useCallback(() => {
    setCoreControlsReady(false);
    setCoreContractError(true);
  }, []);

  const setCoreReady = useCallback((ready: boolean) => {
    setCoreControlsReady(ready);
    if (ready) setCoreContractError(false);
  }, []);

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
      const payload = await accountApi.fetchJson<WidgetDefaultsSavePayload>(
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

  if (loading) return <RomaLoadingState className="rd-canvas-module" />;

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

        <div className="widget-defaults-toolbar widget-defaults-toolbar--secondary">
          <h2 className="heading-4">{widgetDefaultsCopy.heading}</h2>
          {selectedWidgetType ? (
            <DieterDropdownActions
              ariaLabel={widgetDefaultsCopy.heading}
              value={selectedWidgetType}
              options={selectorOptions}
              onChange={setSelectedWidgetType}
            />
          ) : null}
        </div>

        {compiledLoading ? <RomaLoadingState className="rd-canvas-module" /> : null}
        {!compiledLoading &&
        !compiledFailed &&
        compiledWidget &&
        effectiveCore &&
        selectedDefinition &&
        selectedWidgetType ? (
          <>
            <div className="widget-defaults-section">
              <WidgetDefaultsBuilderControls
                key={`common:${selectedWidgetType}`}
                controls={commonControls}
                payload={compiledWidget}
                fontLibrary={draft.fontLibrary}
                hostId="widget-defaults-common"
                values={draft.common}
                onOps={updateCommonOps}
                onContractError={reportCommonContractError}
                onReadyChange={setCommonReady}
              />
            </div>
            {!commonContractError && !coreContractError ? (
              <div className="widget-defaults-widgets">
                <WidgetDefaultsCoreSection
                  key={selectedWidgetType}
                  widgetType={selectedWidgetType}
                  label={selectedDefinition.displayName}
                  controls={coreControls}
                  payload={compiledWidget}
                  fontLibrary={draft.fontLibrary}
                  core={effectiveCore}
                  onOps={updateWidgetOps}
                  onContractError={reportCoreContractError}
                  onReadyChange={setCoreReady}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      <RomaUnsavedChangesDialog
        open={unsavedDialogOpen}
        onKeepEditing={keepEditing}
        onDiscard={discardAndContinue}
      />
    </>
  );
}
