'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  serializeInstanceDataSignature,
  serializePublicPackageSignature,
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
  setMeta: Dispatch<SetStateAction<SessionMeta>>;
  setState: Dispatch<SetStateAction<SessionState>>;
  executeAccountCommand: ExecuteAccountCommand;
}) {
  const { executeAccountCommand, metaRef, setMeta, setState, setUpsell, stateRef } = args;

  const save = useCallback(async () => {
    // Save persists the one widget the customer is actively editing.
    const snapshot = stateRef.current;
    const meta = metaRef.current;
    const instanceId = meta?.instanceId ? String(meta.instanceId) : '';
    const widgetType = meta?.widgetname ? String(meta.widgetname).trim() : '';
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
      if (!snapshot.publicPackage || snapshot.error?.source === 'generation') {
        throw new Error('coreui.errors.builder.save.generationFailed');
      }
      const config = snapshot.instanceData;
      assertSessionConfigContract(config, snapshot.compiled);
      const submittedInstanceDataSignature = serializeInstanceDataSignature(config);
      const submittedPublicPackageSignature = serializePublicPackageSignature(snapshot.publicPackage);
      const saveBody: Record<string, unknown> = {
        widgetType,
        config,
        publicPackage: snapshot.publicPackage,
        baseLocale: meta?.baseLocale ?? null,
        displayName: meta?.label ?? null,
      };
      const { ok, json } = await executeAccountCommand({
        command: 'update-instance',
        ...(instanceId ? { instanceId } : {}),
        body: saveBody,
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

      const savedInstanceId = instanceId || (typeof json?.instanceId === 'string' ? json.instanceId.trim() : '');
      if (!savedInstanceId) throw new Error('coreui.errors.builder.save.missingInstanceId');
      if (!instanceId) {
        setMeta((currentMeta) => currentMeta ? {
          ...currentMeta,
          instanceId: savedInstanceId,
          publishStatus: 'unpublished',
          publicActions: null,
        } : currentMeta);
      }

      const current = stateRef.current;
      const currentInstanceDataSignature = serializeInstanceDataSignature(current.instanceData);
      const currentPublicPackageSignature = serializePublicPackageSignature(current.publicPackage);
      const hasEditsAfterSubmittedSave =
        currentInstanceDataSignature !== submittedInstanceDataSignature ||
        currentPublicPackageSignature !== submittedPublicPackageSignature;
      const nextInstanceData = hasEditsAfterSubmittedSave ? current.instanceData : config;
      const nextState: SessionState = {
        ...current,
        instanceData: nextInstanceData,
        savedInstanceDataSignature: submittedInstanceDataSignature,
        savedPublicPackageSignature: submittedPublicPackageSignature,
        isDirty: hasEditsAfterSubmittedSave,
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
    setMeta,
    setUpsell,
    stateRef,
  ]);

  return {
    save,
  };
}
