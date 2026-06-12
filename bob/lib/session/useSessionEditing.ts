'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ApplyWidgetOpsResult, WidgetOp } from '../ops';
import { applyWidgetOps } from '../ops';
import { assertSessionConfigContract } from './sessionConfig';
import { serializeInstanceDataSignature, type SessionMeta, type SessionState } from './sessionTypes';

export function useSessionEditing(args: {
  stateRef: MutableRefObject<SessionState>;
  setState: Dispatch<SetStateAction<SessionState>>;
  setMeta: Dispatch<SetStateAction<SessionMeta>>;
}) {
  const { stateRef, setMeta, setState } = args;

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
      try {
        assertSessionConfigContract(applied.data, compiled);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const result: ApplyWidgetOpsResult = { ok: false, errors: [{ opIndex: 0, message }] };
        stateRef.current = { ...stateRef.current, error: { source: 'ops', errors: result.errors } };
        setState(stateRef.current);
        return result;
      }

      const latest = stateRef.current;
      const nextState: SessionState = {
        ...latest,
        instanceData: applied.data,
        isDirty: serializeInstanceDataSignature(applied.data) !== latest.savedInstanceDataSignature,
        error: null,
        lastUpdate: {
          source: 'ops',
          path: ops[0]?.path || '',
          ts: Date.now(),
        },
      };
      stateRef.current = nextState;
      setState(nextState);

      return { ok: true, data: applied.data };
    },
    [setState, stateRef],
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
