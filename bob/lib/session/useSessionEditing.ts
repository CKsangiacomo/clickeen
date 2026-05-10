'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ApplyWidgetOpsResult, WidgetOp } from '../ops';
import { applyWidgetOps } from '../ops';
import { normalizeSessionConfig } from './sessionConfig';
import { serializeInstanceDataSignature, type SessionMeta, type SessionState } from './sessionTypes';

export function useSessionEditing(args: {
  state: SessionState;
  setState: Dispatch<SetStateAction<SessionState>>;
  setMeta: Dispatch<SetStateAction<SessionMeta>>;
}) {
  const { state, setMeta, setState } = args;

  const applyOps = useCallback(
    (ops: WidgetOp[]): ApplyWidgetOpsResult => {
      const compiled = state.compiled;
      if (!compiled) {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex: 0, message: 'This widget is not open yet.' }],
        };
        setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
        return result;
      }
      const applied = applyWidgetOps({
        data: state.instanceData,
        ops,
        controls: compiled.controls,
      });

      if (!applied.ok) {
        setState((prev) => ({ ...prev, error: { source: 'ops', errors: applied.errors } }));
        return applied;
      }

      const normalizedData = normalizeSessionConfig(applied.data, compiled);

      setState((prev) => ({
        ...prev,
        instanceData: normalizedData,
        isDirty: serializeInstanceDataSignature(normalizedData) !== prev.savedInstanceDataSignature,
        error: null,
        lastUpdate: {
          source: 'ops',
          path: ops[0]?.path || '',
          ts: Date.now(),
        },
      }));

      return { ok: true, data: normalizedData };
    },
    [setState, state],
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
