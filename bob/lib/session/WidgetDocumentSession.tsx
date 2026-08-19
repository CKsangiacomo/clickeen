'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AccountFontLibrary } from '@clickeen/widget-foundation';
import { createInitialSessionState, type SessionState } from './sessionTypes';
import { createAccountAssetsClient, useSessionTransport } from './sessionTransport';
import { useSessionEditing } from './useSessionEditing';
import { useSessionBoot } from './useSessionBoot';
import { useSessionSaving } from './useSessionSaving';
import { useWidgetSessionChromeController } from './WidgetSessionChrome';
import type { AccountAssetsClient } from '../../../dieter/components/shared/account-assets';

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
  requestSystemUpsell: ReturnType<typeof useSessionTransport>['requestSystemUpsell'];
  applyOps: ReturnType<typeof useSessionEditing>['applyOps'];
  save: ReturnType<typeof useSessionSaving>['save'];
  setInstanceLabel: ReturnType<typeof useSessionEditing>['setInstanceLabel'];
  loadInstance: ReturnType<typeof useSessionBoot>['loadInstance'];
};

type WidgetSessionTransportValue = {
  listTranslations: ReturnType<typeof useSessionTransport>['listTranslations'];
  readTranslation: ReturnType<typeof useSessionTransport>['readTranslation'];
  generateTranslations: ReturnType<typeof useSessionTransport>['generateTranslations'];
  runCopilot: ReturnType<typeof useSessionTransport>['runCopilot'];
  cancelCopilot: ReturnType<typeof useSessionTransport>['cancelCopilot'];
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
  const policyRef = useRef(chrome.policy);
  policyRef.current = chrome.policy;

  const transport = useSessionTransport({ metaRef });
  const editing = useSessionEditing({
    stateRef,
    policyRef,
    setState,
    setMeta: chrome.setMeta,
    requestWidgetUpsell: transport.requestWidgetUpsell,
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
    setState,
    setMeta: chrome.setMeta,
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
      runCopilot: transport.runCopilot,
      cancelCopilot: transport.cancelCopilot,
    }),
    [
      transport.generateTranslations,
      transport.listTranslations,
      transport.readTranslation,
      transport.runCopilot,
      transport.cancelCopilot,
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
      requestSystemUpsell: transport.requestSystemUpsell,
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
      transport.requestSystemUpsell,
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
