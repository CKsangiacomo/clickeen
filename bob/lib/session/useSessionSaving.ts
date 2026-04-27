'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  serializeInstanceDataSignature,
  type SessionMeta,
  type SessionState,
  type SessionUpsell,
} from './sessionTypes';
import type { ExecuteAccountCommand } from './sessionTransport';
import { normalizeSessionConfig } from './normalizeSessionConfig';

export function useSessionSaving(args: {
  stateRef: MutableRefObject<SessionState>;
  metaRef: MutableRefObject<SessionMeta>;
  setUpsell: Dispatch<SetStateAction<SessionUpsell>>;
  setState: Dispatch<SetStateAction<SessionState>>;
  executeAccountCommand: ExecuteAccountCommand;
}) {
  const { executeAccountCommand, metaRef, setState, setUpsell, stateRef } = args;

  const save = useCallback(async () => {
    // Save persists the one widget the customer is actively editing.
    const snapshot = stateRef.current;
    const meta = metaRef.current;
    const publicId = meta?.publicId ? String(meta.publicId) : '';
    const widgetType = meta?.widgetname ? String(meta.widgetname).trim() : '';
    if (!publicId) {
      setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Missing instance context for save.' },
      }));
      return;
    }
    if (!widgetType) {
      setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Missing widget type for save.' },
      }));
      return;
    }
    if (!snapshot.isDirty) {
      return;
    }
    if (!snapshot.compiled) {
      setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Missing widget compiler context for save.' },
      }));
      return;
    }

    setState((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      const normalizedConfig = normalizeSessionConfig({
        compiled: snapshot.compiled,
        config: snapshot.instanceData,
      });
      const { ok, json } = await executeAccountCommand({
        command: 'update-instance',
        publicId,
        body: {
          widgetType,
          config: normalizedConfig,
          displayName: meta?.label ?? null,
          source: meta?.source,
          meta: meta?.meta ?? null,
        },
      });
      if (!ok) {
        const err = json?.error;
        if (err?.kind === 'VALIDATION') {
          setState((prev) => ({
            ...prev,
            isSaving: false,
            error: { source: 'save', message: err.reasonKey || 'Save failed.', paths: err.paths },
          }));
          return;
        }
        setState((prev) => ({
          ...prev,
          isSaving: false,
          error: { source: 'save', message: err?.reasonKey || 'Save failed.' },
        }));
        return;
      }

      const current = stateRef.current;
      const savedInstanceDataSignature = serializeInstanceDataSignature(normalizedConfig);
      const nextState: SessionState = {
        ...current,
        instanceData: normalizedConfig,
        savedInstanceDataSignature,
        isDirty: false,
        isSaving: false,
        error: null,
      };
      setUpsell(null);
      stateRef.current = nextState;
      setState(nextState);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, isSaving: false, error: { source: 'save', message: messageText } }));
    }
  }, [
    executeAccountCommand,
    metaRef,
    setState,
    setUpsell,
    stateRef,
  ]);

  return {
    save,
  };
}
