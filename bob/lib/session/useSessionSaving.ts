'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  serializeInstanceDataSignature,
  type SessionMeta,
  type SessionState,
  type SessionUpsell,
} from './sessionTypes';
import type { ExecuteAccountCommand } from './sessionTransport';

function normalizeTranslationFollowup(payload: unknown):
  | { ok: true }
  | { ok: false; reasonKey: string; detail?: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: true };
  const followup = payload as Record<string, unknown>;
  if (followup.ok !== false) return { ok: true };
  const failedResults = Array.isArray(followup.results)
    ? followup.results.filter((entry): entry is Record<string, unknown> => {
        return Boolean(entry && typeof entry === 'object' && !Array.isArray(entry) && entry.ok === false);
      })
    : [];
  const firstFailure = failedResults[0] ?? null;
  const reasonKey =
    typeof firstFailure?.reasonKey === 'string' && firstFailure.reasonKey.trim()
      ? firstFailure.reasonKey.trim()
      : 'coreui.errors.translations.acceptanceFailed';
  const locale =
    typeof firstFailure?.locale === 'string' && firstFailure.locale.trim()
      ? firstFailure.locale.trim()
      : '';
  const detailText =
    typeof firstFailure?.detail === 'string' && firstFailure.detail.trim()
      ? firstFailure.detail.trim()
      : '';
  const detail = [locale, detailText].filter(Boolean).join(': ') || undefined;
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
      const config = snapshot.instanceData;
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
            error: {
              source: 'save',
              message: err.reasonKey || 'Save failed.',
              detail: typeof err.detail === 'string' ? err.detail : undefined,
              paths: Array.isArray(err.paths)
                ? err.paths.filter((path: unknown): path is string => typeof path === 'string')
                : undefined,
            },
          }));
          return;
        }
        setState((prev) => ({
          ...prev,
          isSaving: false,
          error: {
            source: 'save',
            message: err?.reasonKey || 'Save failed.',
            detail: typeof err?.detail === 'string' ? err.detail : undefined,
          },
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
          const translationFollowup = normalizeTranslationFollowup(json?.translation);
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
