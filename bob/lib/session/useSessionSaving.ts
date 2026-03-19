'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { hasUnsavedDocument, type SessionState } from './sessionTypes';
import type { ExecuteAccountCommand } from './sessionTransport';

export function useSessionSaving(args: {
  stateRef: MutableRefObject<SessionState>;
  setState: Dispatch<SetStateAction<SessionState>>;
  executeAccountCommand: ExecuteAccountCommand;
}) {
  const save = useCallback(async () => {
    // Save persists the one widget the customer is actively editing.
    const snapshot = args.stateRef.current;
    const baseDocumentDirty = hasUnsavedDocument(snapshot);
    const policy = snapshot.policy;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const accountId = snapshot.meta?.accountId ? String(snapshot.meta.accountId) : '';
    if (!policy) {
      args.setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Editor context is not ready.' },
      }));
      return;
    }

    if (!publicId || !accountId) {
      args.setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Missing instance context for save.' },
      }));
      return;
    }
    if (policy.role === 'viewer') {
      args.setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Read-only mode: saving is disabled.' },
      }));
      return;
    }

    if (!baseDocumentDirty) return;

    args.setState((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      const { ok, json } = await args.executeAccountCommand({
        subject: 'account',
        command: 'update-instance',
        method: 'PUT',
        url: `/api/account/instance/${encodeURIComponent(publicId)}?subject=account`,
        accountId,
        publicId,
        body: { config: snapshot.instanceData },
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
      const nextBase =
        json?.config && typeof json.config === 'object' && !Array.isArray(json.config)
          ? structuredClone(json.config)
          : structuredClone(current.instanceData);
      const nextState: SessionState = {
        ...current,
        isSaving: false,
        error: null,
        upsell: null,
        savedBaseInstanceData: structuredClone(nextBase),
        instanceData: structuredClone(nextBase),
      };
      args.stateRef.current = nextState;
      args.setState(nextState);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      args.setState((prev) => ({ ...prev, isSaving: false, error: { source: 'save', message: messageText } }));
    }
  }, [
    args.executeAccountCommand,
    args.setState,
    args.stateRef,
  ]);

  return {
    save,
  };
}
