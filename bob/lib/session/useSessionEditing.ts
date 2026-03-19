'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ApplyWidgetOpsResult, WidgetOp } from '../ops';
import { applyWidgetOps } from '../ops';
import { type SessionMeta, type SessionState } from './sessionTypes';

export function useSessionEditing(args: {
  state: SessionState;
  setState: Dispatch<SetStateAction<SessionState>>;
  setMeta: Dispatch<SetStateAction<SessionMeta>>;
}) {
  const applyOps = useCallback(
    (ops: WidgetOp[]): ApplyWidgetOpsResult => {
      const compiled = args.state.compiled;
      if (!compiled) {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex: 0, message: 'This widget is not open yet.' }],
        };
        args.setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
        return result;
      }
      const applied = applyWidgetOps({
        data: args.state.instanceData,
        ops,
        controls: compiled.controls,
      });

      if (!applied.ok) {
        args.setState((prev) => ({ ...prev, error: { source: 'ops', errors: applied.errors } }));
        return applied;
      }

      args.setState((prev) => ({
        ...prev,
        instanceData: applied.data,
        error: null,
        lastUpdate: {
          source: 'ops',
          path: ops[0]?.path || '',
          ts: Date.now(),
        },
      }));

      return applied;
    },
    [args.setState, args.state],
  );

  const setInstanceLabel = useCallback((label: string) => {
    const trimmed = String(label || '').trim();
    args.setMeta((prev) => {
      if (!prev) return prev;
      if (!trimmed) return prev;
      return {
        ...prev,
        label: trimmed,
      };
    });
  }, [args.setMeta]);

  return {
    applyOps,
    setInstanceLabel,
  };
}
