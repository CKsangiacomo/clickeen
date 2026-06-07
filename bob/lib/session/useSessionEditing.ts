'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ApplyWidgetOpsResult, WidgetOp } from '../ops';
import { applyWidgetOps } from '../ops';
import { normalizeSessionConfig } from './sessionConfig';
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

      const normalizedData = normalizeSessionConfig(applied.data, compiled);
      const latest = stateRef.current;
      const nextState: SessionState = {
        ...latest,
        instanceData: normalizedData,
        isDirty: serializeInstanceDataSignature(normalizedData) !== latest.savedInstanceDataSignature,
        error: null,
        lastUpdate: {
          source: 'ops',
          path: ops[0]?.path || '',
          ts: Date.now(),
        },
      };
      stateRef.current = nextState;
      setState(nextState);

      return { ok: true, data: normalizedData };
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
