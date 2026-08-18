'use client';

import { evaluateEditLimits, type Policy } from '@clickeen/ck-policy';
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ApplyWidgetOpsResult, WidgetOp } from '../ops';
import { applyWidgetOps } from '../ops';
import { serializeInstanceDataSignature, type SessionMeta, type SessionState } from './sessionTypes';

export function useSessionEditing(args: {
  stateRef: MutableRefObject<SessionState>;
  policyRef: MutableRefObject<Policy | null>;
  setState: Dispatch<SetStateAction<SessionState>>;
  setMeta: Dispatch<SetStateAction<SessionMeta>>;
  requestWidgetUpsell: (
    capability: string,
    messageId: string,
    required: boolean | number,
  ) => void;
}) {
  const { policyRef, requestWidgetUpsell, stateRef, setMeta, setState } = args;

  const applyOps = useCallback(
    (ops: WidgetOp[]): ApplyWidgetOpsResult => {
      const current = stateRef.current;
      const compiled = current.compiled;
      if (!compiled) {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex: 0, message: 'This widget is not open yet.' }],
        };
        const nextState: SessionState = {
          ...stateRef.current,
          error: { source: 'ops', errors: result.errors },
        };
        stateRef.current = nextState;
        setState(nextState);
        return result;
      }
      const applied = applyWidgetOps({
        data: current.instanceData,
        ops,
        controls: compiled.controls,
      });

      if (!applied.ok) {
        const nextState: SessionState = {
          ...stateRef.current,
          error: { source: 'ops', errors: applied.errors },
        };
        stateRef.current = nextState;
        setState(nextState);
        return applied;
      }

      const denied = evaluateEditLimits({
        before: current.instanceData,
        candidate: applied.data,
        limits: compiled.limits,
        policy: policyRef.current!,
      })[0];
      if (denied) {
        requestWidgetUpsell(denied.key, denied.messageId, denied.required);
        return {
          ok: false,
          errors: [
            {
              opIndex: 0,
              path: denied.path,
              message: 'This edit is not available on the current plan.',
            },
          ],
        };
      }

      const latest = stateRef.current;
      const nextState: SessionState = {
        ...latest,
        instanceData: applied.data,
        isDirty: serializeInstanceDataSignature(applied.data) !== latest.savedInstanceDataSignature,
        error: null,
        lastUpdate: {
          source: 'ops',
          path: applied.changedPaths[0] || '',
          paths: applied.changedPaths,
          ts: Date.now(),
        },
      };
      stateRef.current = nextState;
      setState(nextState);

      return applied;
    },
    [policyRef, requestWidgetUpsell, setState, stateRef],
  );

  const setInstanceLabel = useCallback((label: string) => {
    const trimmed = String(label || '').trim();
    setMeta((prev) => {
      if (!prev) return prev;
      if (!trimmed) return prev;
      return {
        ...prev,
        label: trimmed,
      };
    });
  }, [setMeta]);

  return {
    applyOps,
    setInstanceLabel,
  };
}
