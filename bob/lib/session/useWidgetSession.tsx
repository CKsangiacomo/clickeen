'use client';

import { createContext, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  createInitialSessionState,
  hasUnsavedDocument,
  type SessionState,
} from './sessionTypes';
import { useSessionTransport } from './sessionTransport';
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
  const boot = useSessionBoot({
    state,
    stateRef,
    setState,
    fetchApi: transport.fetchApi,
    bootModeRef: transport.bootModeRef,
    hostOriginRef: transport.hostOriginRef,
    applyMinibobInjectedState: editing.applyMinibobInjectedState,
  });
  const saving = useSessionSaving({
    stateRef,
    setState,
    executeAccountCommand: transport.executeAccountCommand,
  });
  const copilot = useSessionCopilot({ setState });
  const isDirty = hasUnsavedDocument(state);
  const hasUnsavedChanges = isDirty;

  const value = useMemo(
    () => ({
      compiled: state.compiled,
      instanceData: state.instanceData,
      isDirty,
      hasUnsavedChanges,
      policy: state.policy,
      upsell: state.upsell,
      isSaving: state.isSaving,
      preview: state.preview,
      selectedPath: state.selectedPath,
      lastUpdate: state.lastUpdate,
      error: state.error,
      meta: state.meta,
      apiFetch: transport.fetchApi,
      resolvePreviewAssets: transport.resolvePreviewAssets,
      copilotThreads: state.copilotThreads,
      applyOps: editing.applyOps,
      save: saving.save,
      discardChanges: editing.discardChanges,
      dismissUpsell: editing.dismissUpsell,
      requestUpsell: editing.requestUpsell,
      setSelectedPath: editing.setSelectedPath,
      setInstanceLabel: editing.setInstanceLabel,
      setPreview: editing.setPreview,
      loadInstance: boot.loadInstance,
      setCopilotThread: copilot.setCopilotThread,
      updateCopilotThread: copilot.updateCopilotThread,
    }),
    [
      boot.loadInstance,
      copilot.setCopilotThread,
      copilot.updateCopilotThread,
      editing,
      hasUnsavedChanges,
      isDirty,
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
