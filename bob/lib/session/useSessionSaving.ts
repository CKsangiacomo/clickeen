'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  serializeInstanceDataSignature,
  type SessionMeta,
  type SessionState,
  type SessionUpsell,
} from './sessionTypes';
import type { ExecuteAccountCommand } from './sessionTransport';
import { assertSessionConfigContract } from './sessionConfig';

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
    const instanceId = meta?.instanceId ? String(meta.instanceId) : '';
    const widgetType = meta?.widgetname ? String(meta.widgetname).trim() : '';
    if (!instanceId) {
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
    const savingState: SessionState = {
      ...stateRef.current,
      isSaving: true,
      error: null,
    };
    stateRef.current = savingState;
    setState(savingState);

    try {
      if (!snapshot.compiled) throw new Error('coreui.errors.builder.save.missingContract');
      const config = snapshot.instanceData;
      assertSessionConfigContract(config, snapshot.compiled);
      const submittedInstanceDataSignature = serializeInstanceDataSignature(config);
      const { ok, json } = await executeAccountCommand({
        command: 'update-instance',
        instanceId,
        body: {
          widgetType,
          config,
          baseLocale: meta?.baseLocale ?? null,
          displayName: meta?.label ?? null,
          meta: meta?.meta ?? null,
        },
      });
      if (!ok) {
        const err = json?.error;
        if (err?.kind === 'VALIDATION') {
          const nextState: SessionState = {
            ...stateRef.current,
            isSaving: false,
            error: {
              source: 'save',
              message: err.reasonKey || 'Save failed.',
              detail: typeof err.detail === 'string' ? err.detail : undefined,
              paths: Array.isArray(err.paths)
                ? err.paths.filter((path: unknown): path is string => typeof path === 'string')
                : undefined,
            },
          };
          stateRef.current = nextState;
          setState(nextState);
          return;
        }
        const nextState: SessionState = {
          ...stateRef.current,
          isSaving: false,
          error: {
            source: 'save',
            message: err?.reasonKey || 'Save failed.',
            detail: typeof err?.detail === 'string' ? err.detail : undefined,
          },
        };
        stateRef.current = nextState;
        setState(nextState);
        return;
      }

      const current = stateRef.current;
      const currentInstanceDataSignature = serializeInstanceDataSignature(current.instanceData);
      const hasEditsAfterSubmittedSave = currentInstanceDataSignature !== submittedInstanceDataSignature;
      const nextInstanceData = hasEditsAfterSubmittedSave ? current.instanceData : config;
      const nextState: SessionState = {
        ...current,
        instanceData: nextInstanceData,
        savedInstanceDataSignature: submittedInstanceDataSignature,
        isDirty: serializeInstanceDataSignature(nextInstanceData) !== submittedInstanceDataSignature,
        isSaving: false,
        error: null,
      };
      setUpsell(null);
      stateRef.current = nextState;
      setState(nextState);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      const nextState: SessionState = {
        ...stateRef.current,
        isSaving: false,
        error: { source: 'save', message: messageText },
      };
      stateRef.current = nextState;
      setState(nextState);
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
