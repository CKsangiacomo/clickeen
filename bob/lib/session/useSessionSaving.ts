'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  serializeInstanceDataSignature,
  type SessionMeta,
  type SessionState,
} from './sessionTypes';
import type { ExecuteAccountCommand } from './sessionTransport';

export function useSessionSaving(args: {
  stateRef: MutableRefObject<SessionState>;
  metaRef: MutableRefObject<SessionMeta>;
  setState: Dispatch<SetStateAction<SessionState>>;
  setMeta: Dispatch<SetStateAction<SessionMeta>>;
  executeAccountCommand: ExecuteAccountCommand;
}) {
  const { executeAccountCommand, metaRef, setMeta, setState, stateRef } = args;

  const save = useCallback(async () => {
    // Save persists the one widget the customer is actively editing.
    const snapshot = stateRef.current;
    const meta = metaRef.current;
    const instanceId = meta?.instanceId ?? '';
    const widgetType = meta?.widgetname ?? '';
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
      const config = snapshot.instanceData;
      const submittedInstanceDataSignature = serializeInstanceDataSignature(config);
      const saveBody: Record<string, unknown> = {
        widgetType,
        config,
      };
      const { ok, json } = await executeAccountCommand({
        command: 'update-instance',
        instanceId,
        body: saveBody,
      });
      if (!ok) {
        const err = (json as {
          error: {
            kind: string;
            reasonKey: string;
            detail?: string;
            paths?: string[];
          };
        }).error;
        if (err.kind === 'VALIDATION') {
          const nextState: SessionState = {
            ...stateRef.current,
            isSaving: false,
            error: {
              source: 'save',
              message: err.reasonKey,
              detail: err.detail,
              paths: err.paths,
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
            message: err.reasonKey,
            detail: err.detail,
          },
        };
        stateRef.current = nextState;
        setState(nextState);
        return;
      }

      const savedAt = (json as { updatedAt?: unknown } | undefined)?.updatedAt;
      if (typeof savedAt === 'string' && savedAt) {
        setMeta((prev) => (prev ? { ...prev, sourceUpdatedAt: savedAt } : prev));
        metaRef.current = metaRef.current
          ? { ...metaRef.current, sourceUpdatedAt: savedAt }
          : metaRef.current;
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
    stateRef,
  ]);

  return {
    save,
  };
}
