'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { SessionMeta, SessionState, SessionUpsell } from './sessionTypes';
import type { ExecuteAccountCommand } from './sessionTransport';

export function useSessionSaving(args: {
  stateRef: MutableRefObject<SessionState>;
  metaRef: MutableRefObject<SessionMeta>;
  setUpsell: Dispatch<SetStateAction<SessionUpsell>>;
  setState: Dispatch<SetStateAction<SessionState>>;
  executeAccountCommand: ExecuteAccountCommand;
}) {
  const save = useCallback(async () => {
    // Save persists the one widget the customer is actively editing.
    const snapshot = args.stateRef.current;
    const meta = args.metaRef.current;
    const publicId = meta?.publicId ? String(meta.publicId) : '';
    const widgetType = meta?.widgetname ? String(meta.widgetname).trim() : '';
    if (!publicId) {
      args.setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Missing instance context for save.' },
      }));
      return;
    }
    if (!widgetType) {
      args.setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Missing widget type for save.' },
      }));
      return;
    }

    args.setState((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      const { ok, json } = await args.executeAccountCommand({
        command: 'update-instance',
        publicId,
        body: {
          widgetType,
          config: snapshot.instanceData,
          displayName: meta?.label ?? null,
          source: meta?.source,
          meta: meta?.meta ?? null,
        },
      });
      if (!ok) {
        const err = json?.error;
        if (err?.kind === 'VALIDATION') {
          args.setState((prev) => ({
            ...prev,
            isSaving: false,
            error: { source: 'save', message: err.reasonKey || 'Save failed.', paths: err.paths },
          }));
          return;
        }
        args.setState((prev) => ({
          ...prev,
          isSaving: false,
          error: { source: 'save', message: err?.reasonKey || 'Save failed.' },
        }));
        return;
      }

      const current = args.stateRef.current;
      const nextState: SessionState = {
        ...current,
        isSaving: false,
        error: null,
      };
      args.setUpsell(null);
      args.stateRef.current = nextState;
      args.setState(nextState);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      args.setState((prev) => ({ ...prev, isSaving: false, error: { source: 'save', message: messageText } }));
    }
  }, [
    args.executeAccountCommand,
    args.metaRef,
    args.setState,
    args.setUpsell,
    args.stateRef,
  ]);

  return {
    save,
  };
}
