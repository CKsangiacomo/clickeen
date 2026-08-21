'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  serializeInstanceDataSignature,
  resolveSaveControlPhase,
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
    const meta = metaRef.current!;
    const { instanceId, widgetname: widgetType } = meta;
    if (!snapshot.isDirty) {
      return;
    }
    const savingState: SessionState = {
      ...stateRef.current,
      isSaving: true,
      saveControlPhase: resolveSaveControlPhase(stateRef.current.saveControlPhase, {
        type: 'save-started',
      }),
      error: null,
    };
    stateRef.current = savingState;
    setState(savingState);

    try {
      const config = snapshot.instanceData;
      const submittedInstanceDataSignature = serializeInstanceDataSignature(config);
      const saveBody: Record<string, unknown> = {
        config,
        ...(instanceId === null ? { widgetType } : {}),
      };
      const { ok, json } = await executeAccountCommand({
        command: 'save-instance',
        ...(instanceId === null ? {} : { instanceId }),
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
            saveControlPhase: resolveSaveControlPhase(stateRef.current.saveControlPhase, {
              type: 'save-failed',
              isDirty: stateRef.current.isDirty,
            }),
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
          saveControlPhase: resolveSaveControlPhase(stateRef.current.saveControlPhase, {
            type: 'save-failed',
            isDirty: stateRef.current.isDirty,
          }),
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

      if (instanceId === null) {
        const created = json as { instanceId: string; baseLocale: string };
        const currentMeta = metaRef.current!;
        const nextMeta = {
          ...currentMeta,
          instanceId: created.instanceId,
          baseLocale: created.baseLocale,
          translationSetup: {
            ...currentMeta.translationSetup,
            baseLocale: created.baseLocale,
          },
        };
        metaRef.current = nextMeta;
        setMeta(nextMeta);
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
        saveControlPhase: resolveSaveControlPhase(current.saveControlPhase, {
          type: 'save-succeeded',
          currentDraftMatchesSubmitted: !hasEditsAfterSubmittedSave,
        }),
        error: null,
      };
      stateRef.current = nextState;
      setState(nextState);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      const nextState: SessionState = {
        ...stateRef.current,
        isSaving: false,
        saveControlPhase: resolveSaveControlPhase(stateRef.current.saveControlPhase, {
          type: 'save-failed',
          isDirty: stateRef.current.isDirty,
        }),
        error: { source: 'save', message: messageText },
      };
      stateRef.current = nextState;
      setState(nextState);
    }
  }, [
    executeAccountCommand,
    metaRef,
    setState,
    setMeta,
    stateRef,
  ]);

  return {
    save,
  };
}
