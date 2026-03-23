'use client';

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createInitialSessionState, type SessionState } from './sessionTypes';
import { useSessionTransport } from './sessionTransport';
import { useSessionEditing } from './useSessionEditing';
import { useSessionBoot } from './useSessionBoot';
import { useSessionSaving } from './useSessionSaving';
import { useWidgetSessionChromeController } from './WidgetSessionChrome';
import {
  createAccountAssetsClient,
  type AccountAssetsClient,
} from '../../../dieter/components/shared/account-assets';

export type WidgetDocumentSessionValue = {
  compiled: SessionState['compiled'];
  instanceData: SessionState['instanceData'];
  isDirty: SessionState['isDirty'];
  isSaving: SessionState['isSaving'];
  lastUpdate: SessionState['lastUpdate'];
  error: SessionState['error'];
  accountAssets: AccountAssetsClient;
  apiFetch: ReturnType<typeof useSessionTransport>['fetchApi'];
  applyOps: ReturnType<typeof useSessionEditing>['applyOps'];
  save: ReturnType<typeof useSessionSaving>['save'];
  setInstanceLabel: ReturnType<typeof useSessionEditing>['setInstanceLabel'];
  loadInstance: ReturnType<typeof useSessionBoot>['loadInstance'];
};

type WidgetSessionTransportValue = {
  loadTranslations: ReturnType<typeof useSessionTransport>['loadTranslations'];
};

const WidgetDocumentSessionContext = createContext<WidgetDocumentSessionValue | null>(null);
const WidgetSessionTransportContext = createContext<WidgetSessionTransportValue | null>(null);

export function WidgetDocumentSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(() => createInitialSessionState());
  const chrome = useWidgetSessionChromeController();

  const stateRef = useRef(state);
  stateRef.current = state;
  const metaRef = useRef(chrome.meta);
  metaRef.current = chrome.meta;

  const transport = useSessionTransport({ stateRef, metaRef });
  const editing = useSessionEditing({
    state,
    setState,
    setMeta: chrome.setMeta,
  });
  const boot = useSessionBoot({
    setState,
    setMeta: chrome.setMeta,
    setPolicy: chrome.setPolicy,
    hostOriginRef: transport.hostOriginRef,
  });
  const saving = useSessionSaving({
    stateRef,
    metaRef,
    setUpsell: chrome.setUpsell,
    setState,
    executeAccountCommand: transport.executeAccountCommand,
  });
  const accountAssets = useMemo(() => createAccountAssetsClient(transport.accountAssets), [transport.accountAssets]);
  const transportValue = useMemo<WidgetSessionTransportValue>(
    () => ({
      loadTranslations: transport.loadTranslations,
    }),
    [transport.loadTranslations],
  );

  const value = useMemo<WidgetDocumentSessionValue>(
    () => ({
      compiled: state.compiled,
      instanceData: state.instanceData,
      isDirty: state.isDirty,
      isSaving: state.isSaving,
      lastUpdate: state.lastUpdate,
      error: state.error,
      accountAssets,
      apiFetch: transport.fetchApi,
      applyOps: editing.applyOps,
      save: saving.save,
      setInstanceLabel: editing.setInstanceLabel,
      loadInstance: boot.loadInstance,
    }),
    [
      accountAssets,
      boot.loadInstance,
      editing.applyOps,
      editing.setInstanceLabel,
      saving.save,
      state,
      transport.fetchApi,
    ],
  );

  return (
    <WidgetSessionTransportContext.Provider value={transportValue}>
      <WidgetDocumentSessionContext.Provider value={value}>{children}</WidgetDocumentSessionContext.Provider>
    </WidgetSessionTransportContext.Provider>
  );
}

export function useWidgetSession() {
  const context = useContext(WidgetDocumentSessionContext);
  if (!context) {
    throw new Error('useWidgetSession must be used within WidgetSessionProvider');
  }
  return context;
}

export function useWidgetSessionTransport() {
  const context = useContext(WidgetSessionTransportContext);
  if (!context) {
    throw new Error('useWidgetSessionTransport must be used within WidgetSessionProvider');
  }
  return context;
}
