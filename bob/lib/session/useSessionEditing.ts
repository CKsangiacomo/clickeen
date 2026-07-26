'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ApplyWidgetOpsResult, WidgetOp } from '../ops';
import {
  ACCOUNT_TYPOGRAPHY_SELECTION_INVALID_REASON_KEY,
  validateAccountTypographyFontSelections,
} from '@clickeen/widget-shell';
import { applyWidgetOps } from '../ops';
import { assertSessionConfigContract } from './sessionConfig';
import { serializeInstanceDataSignature, type SessionMeta, type SessionState } from './sessionTypes';

export function useSessionEditing(args: {
  stateRef: MutableRefObject<SessionState>;
  metaRef: MutableRefObject<SessionMeta>;
  setState: Dispatch<SetStateAction<SessionState>>;
  setMeta: Dispatch<SetStateAction<SessionMeta>>;
}) {
  const { metaRef, stateRef, setMeta, setState } = args;

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
      if (applied.requiresDocumentValidation) {
        try {
          assertSessionConfigContract(applied.data, compiled);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const result: ApplyWidgetOpsResult = { ok: false, errors: [{ opIndex: 0, message }] };
          stateRef.current = { ...stateRef.current, error: { source: 'ops', errors: result.errors } };
          setState(stateRef.current);
          return result;
        }
      }
      try {
        const fontLibrary = metaRef.current?.fontLibrary;
        if (!fontLibrary) throw new Error('coreui.errors.typography.fontLibrary.invalid');
        const [invalidPath] = validateAccountTypographyFontSelections({
          fontLibrary,
          typography: applied.data.typography,
        });
        if (invalidPath) {
          const result: ApplyWidgetOpsResult = {
            ok: false,
            errors: [
              {
                opIndex: 0,
                path: invalidPath,
                message: ACCOUNT_TYPOGRAPHY_SELECTION_INVALID_REASON_KEY,
              },
            ],
          };
          stateRef.current = {
            ...stateRef.current,
            error: { source: 'ops', errors: result.errors },
          };
          setState(stateRef.current);
          return result;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const result: ApplyWidgetOpsResult = { ok: false, errors: [{ opIndex: 0, message }] };
        stateRef.current = {
          ...stateRef.current,
          error: { source: 'ops', errors: result.errors },
        };
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
          path: applied.changedPaths[0] || '',
          paths: applied.changedPaths,
          ts: Date.now(),
        },
      };
      stateRef.current = nextState;
      setState(nextState);

      return applied;
    },
    [metaRef, setState, stateRef],
  );

  const reportEditRejection = useCallback(
    (reasonKey: string) => {
      const nextState: SessionState = {
        ...stateRef.current,
        error: { source: 'ops', errors: [{ opIndex: 0, message: reasonKey }] },
      };
      stateRef.current = nextState;
      setState(nextState);
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
    reportEditRejection,
    setInstanceLabel,
  };
}
