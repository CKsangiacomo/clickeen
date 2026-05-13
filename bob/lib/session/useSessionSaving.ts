'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  serializeInstanceDataSignature,
  type SessionMeta,
  type SessionState,
  type SessionUpsell,
} from './sessionTypes';
import type { ExecuteAccountCommand } from './sessionTransport';
import { normalizeSessionConfigForOpen } from './sessionConfig';

function normalizeTranslationFollowup(payload: unknown):
  | { ok: true }
  | { ok: false; reasonKey: string; detail?: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: true };
  const followup = payload as Record<string, unknown>;
  if (followup.ok !== false) return { ok: true };
  const reasonKey =
    typeof followup.reasonKey === 'string' && followup.reasonKey.trim()
      ? followup.reasonKey.trim()
      : 'coreui.errors.translations.acceptanceFailed';
  const detail =
    typeof followup.detail === 'string' && followup.detail.trim()
      ? followup.detail.trim()
      : undefined;
  return {
    ok: false,
    reasonKey,
    ...(detail ? { detail } : {}),
  };
}

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
    if (!snapshot.compiled) {
      setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Missing widget compiler context for save.' },
      }));
      return;
    }

    setState((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      const config = normalizeSessionConfigForOpen(snapshot.instanceData, snapshot.compiled);
      const { ok, json } = await executeAccountCommand({
        command: 'update-instance',
        instanceId,
        body: {
          widgetType,
          config,
          displayName: meta?.label ?? null,
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
      const savedInstanceDataSignature = serializeInstanceDataSignature(config);
      const nextState: SessionState = {
        ...current,
        instanceData: config,
        savedInstanceDataSignature,
        isDirty: false,
        isSaving: false,
        error: (() => {
          const translationFollowup = normalizeTranslationFollowup(json?.translationFollowup);
          if (translationFollowup.ok) return null;
          return {
            source: 'translation',
            message: translationFollowup.reasonKey,
            ...(translationFollowup.detail ? { detail: translationFollowup.detail } : {}),
          };
        })(),
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
