'use client';

import { createContext, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  createInitialSessionState,
  type SessionState,
} from './sessionTypes';
import { useSessionTransport } from './sessionTransport';
import { useSessionLocalization } from './useSessionLocalization';
import { useSessionEditing } from './useSessionEditing';
import { useSessionBoot } from './useSessionBoot';
import { useSessionSaving } from './useSessionSaving';
import { useSessionCopilot } from './useSessionCopilot';

function useWidgetSessionInternal() {
  const [state, setState] = useState<SessionState>(() => createInitialSessionState(null));

  const stateRef = useRef(state);
  stateRef.current = state;

  const transport = useSessionTransport({ stateRef });
  const editing = useSessionEditing({
    state,
    stateRef,
    setState,
  });
  const localization = useSessionLocalization({
    state,
    stateRef,
    setState,
    fetchApi: transport.fetchApi,
    executeAccountCommand: transport.executeAccountCommand,
  });
  const boot = useSessionBoot({
    state,
    stateRef,
    setState,
    fetchApi: transport.fetchApi,
    bootModeRef: transport.bootModeRef,
    hostOriginRef: transport.hostOriginRef,
    sessionIdRef: transport.sessionIdRef,
    openRequestStatusRef: transport.openRequestStatusRef,
    applyMinibobInjectedState: editing.applyMinibobInjectedState,
  });
  const saving = useSessionSaving({
    stateRef,
    setState,
    executeAccountCommand: transport.executeAccountCommand,
    persistLocaleEdits: localization.persistLocaleEdits,
    loadLocaleAllowlist: localization.loadLocaleAllowlist,
    monitorLocaleTranslationsAfterSave: localization.monitorLocaleTranslationsAfterSave,
  });
  const copilot = useSessionCopilot({ setState });

  const value = useMemo(
    () => ({
      compiled: state.compiled,
      instanceData: state.instanceData,
      baseInstanceData: state.baseInstanceData,
      previewData: state.previewData,
      previewOps: state.previewOps,
      isDirty: state.isDirty,
      hasUnsavedChanges: state.isDirty || state.locale.dirty,
      minibobPersonalizationUsed: state.minibobPersonalizationUsed,
      isMinibob: state.policy?.profile === 'minibob',
      policy: state.policy,
      upsell: state.upsell,
      isSaving: state.isSaving,
      preview: state.preview,
      locale: state.locale,
      selectedPath: state.selectedPath,
      lastUpdate: state.lastUpdate,
      error: state.error,
      meta: state.meta,
      apiFetch: transport.fetchApi,
      resolvePreviewAssets: transport.resolvePreviewAssets,
      canUndo: Boolean(state.undoSnapshot) && state.locale.activeLocale === state.locale.baseLocale,
      copilotThreads: state.copilotThreads,
      applyOps: editing.applyOps,
      setPreviewOps: editing.setPreviewOps,
      clearPreviewOps: editing.clearPreviewOps,
      undoLastOps: editing.undoLastOps,
      commitLastOps: editing.commitLastOps,
      save: saving.save,
      discardChanges: editing.discardChanges,
      dismissUpsell: editing.dismissUpsell,
      requestUpsell: editing.requestUpsell,
      setSelectedPath: editing.setSelectedPath,
      setInstanceLabel: editing.setInstanceLabel,
      setPreview: editing.setPreview,
      setLocalePreview: localization.setLocalePreview,
      clearLocaleManualOverrides: localization.clearLocaleManualOverrides,
      reloadLocalizationSnapshot: localization.reloadLocalizationSnapshot,
      loadInstance: boot.loadInstance,
      consumeBudget: editing.consumeBudget,
      setCopilotThread: copilot.setCopilotThread,
      updateCopilotThread: copilot.updateCopilotThread,
    }),
    [
      boot.loadInstance,
      copilot.setCopilotThread,
      copilot.updateCopilotThread,
      editing,
      localization,
      saving.save,
      state,
      transport.fetchApi,
      transport.resolvePreviewAssets,
    ],
  );

  return value;
}

const WidgetSessionContext = createContext<ReturnType<typeof useWidgetSessionInternal> | null>(null);

export function WidgetSessionProvider({ children }: { children: ReactNode }) {
  const value = useWidgetSessionInternal();
  return <WidgetSessionContext.Provider value={value}>{children}</WidgetSessionContext.Provider>;
}

export function useWidgetSession() {
  const context = useContext(WidgetSessionContext);
  if (!context) {
    throw new Error('useWidgetSession must be used within WidgetSessionProvider');
  }
  return context;
}
