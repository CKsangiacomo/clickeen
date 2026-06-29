'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AccountFontLibrary } from '@clickeen/widget-shell';
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
  fontLibrary: AccountFontLibrary | null;
  accountAssets: AccountAssetsClient;
  apiFetch: ReturnType<typeof useSessionTransport>['fetchApi'];
  applyOps: ReturnType<typeof useSessionEditing>['applyOps'];
  save: ReturnType<typeof useSessionSaving>['save'];
  setInstanceLabel: ReturnType<typeof useSessionEditing>['setInstanceLabel'];
  loadInstance: ReturnType<typeof useSessionBoot>['loadInstance'];
};

type WidgetSessionTransportValue = {
  listTranslations: ReturnType<typeof useSessionTransport>['listTranslations'];
  readTranslation: ReturnType<typeof useSessionTransport>['readTranslation'];
  generateTranslations: ReturnType<typeof useSessionTransport>['generateTranslations'];
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

  const transport = useSessionTransport({ metaRef });
  const editing = useSessionEditing({
    stateRef,
    setState,
    setMeta: chrome.setMeta,
  });
  const boot = useSessionBoot({
    stateRef,
    metaRef,
    setState,
    setMeta: chrome.setMeta,
    setPolicy: chrome.setPolicy,
    setCopilot: chrome.setCopilot,
    hostOriginRef: transport.hostOriginRef,
  });
  const saving = useSessionSaving({
    stateRef,
    metaRef,
    setUpsell: chrome.setUpsell,
    setState,
    executeAccountCommand: transport.executeAccountCommand,
  });

  useEffect(() => {
    const origin = transport.hostOriginRef.current || '*';
    try {
      window.parent?.postMessage(
        {
          type: 'bob:dirty-state-changed',
          isDirty: state.isDirty,
        },
        origin,
      );
    } catch {}
  }, [state.isDirty, transport.hostOriginRef]);

  useEffect(() => {
    if (!state.isDirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.isDirty]);

  const accountAssets = useMemo(() => createAccountAssetsClient(transport.accountAssets), [transport.accountAssets]);
  const transportValue = useMemo<WidgetSessionTransportValue>(
    () => ({
      listTranslations: transport.listTranslations,
      readTranslation: transport.readTranslation,
      generateTranslations: transport.generateTranslations,
    }),
    [
      transport.generateTranslations,
      transport.listTranslations,
      transport.readTranslation,
    ],
  );

  const value = useMemo<WidgetDocumentSessionValue>(
    () => ({
      compiled: state.compiled,
      instanceData: state.instanceData,
      isDirty: state.isDirty,
      isSaving: state.isSaving,
      lastUpdate: state.lastUpdate,
      error: state.error,
      fontLibrary: chrome.meta?.fontLibrary ?? null,
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
      chrome.meta,
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
