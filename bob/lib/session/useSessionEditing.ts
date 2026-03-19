'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ApplyWidgetOpsResult, WidgetOp } from '../ops';
import { applyWidgetOps } from '../ops';
import { sanitizeConfig } from '@clickeen/ck-policy';
import { type PreviewSettings, type SessionState } from './sessionTypes';
import { applyWidgetNormalizationRules } from '../compiler/modules/normalization';

export function useSessionEditing(args: {
  state: SessionState;
  stateRef: MutableRefObject<SessionState>;
  setState: Dispatch<SetStateAction<SessionState>>;
}) {
  const applyMinibobInjectedState = useCallback((nextState: Record<string, unknown>): boolean => {
    const snapshot = args.stateRef.current;
    const compiled = snapshot.compiled;
    const policy = snapshot.policy;
    if (!compiled || compiled.controls.length === 0) return false;
    if (!policy) return false;
    let resolved: Record<string, unknown> = structuredClone(nextState);

    resolved = sanitizeConfig({
      config: resolved,
      limits: compiled.limits ?? null,
      policy,
      context: 'load',
    });
    resolved = applyWidgetNormalizationRules(resolved, compiled.normalization);

    const baseNext = resolved;

    args.setState((prev) => ({
      ...prev,
      instanceData: baseNext,
      error: null,
      upsell: null,
      lastUpdate: { source: 'external', path: '', ts: Date.now() },
    }));

    return true;
  }, [args.setState, args.stateRef]);

  const applyOps = useCallback(
    (ops: WidgetOp[]): ApplyWidgetOpsResult => {
      const compiled = args.state.compiled;
      if (!compiled || compiled.controls.length === 0) {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex: 0, message: 'This widget did not compile with controls[]' }],
        };
        args.setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
        return result;
      }
      const policy = args.state.policy;
      if (!policy) {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex: 0, message: 'Editor context is not ready.' }],
        };
        args.setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors }, upsell: null }));
        return result;
      }
      if (policy.role === 'viewer') {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex: 0, message: 'Read-only mode: editing is disabled.' }],
        };
        args.setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors }, upsell: null }));
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
        upsell: null,
        policy: prev.policy,
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

  const dismissUpsell = useCallback(() => {
    args.setState((prev) => ({ ...prev, upsell: null }));
  }, [args.setState]);

  const requestUpsell = useCallback((reasonKey: string, detail?: string) => {
    if (!reasonKey) return;
    args.setState((prev) => ({
      ...prev,
      upsell: {
        reasonKey,
        detail,
        cta: 'upgrade',
      },
    }));
  }, [args.setState]);

  const discardChanges = useCallback(() => {
    args.setState((prev) => {
      const nextBase = structuredClone(prev.savedBaseInstanceData);
      return {
        ...prev,
        instanceData: nextBase,
        error: null,
        upsell: null,
        lastUpdate: { source: 'load', path: '', ts: Date.now() },
      };
    });
  }, [args.setState]);

  const setPreview = useCallback((updates: Partial<PreviewSettings>) => {
    args.setState((prev) => ({
      ...prev,
      preview: { ...prev.preview, ...updates },
    }));
  }, [args.setState]);

  const setSelectedPath = useCallback((path: string | null) => {
    args.setState((prev) => ({
      ...prev,
      selectedPath: typeof path === 'string' && path.trim() ? path.trim() : null,
    }));
  }, [args.setState]);

  const setInstanceLabel = useCallback((label: string) => {
    const trimmed = String(label || '').trim();
    args.setState((prev) => {
      if (!prev.meta) return prev;
      if (!trimmed) return prev;
      return {
        ...prev,
        meta: {
          ...prev.meta,
          label: trimmed,
        },
      };
    });
  }, [args.setState]);

  return {
    applyMinibobInjectedState,
    applyOps,
    dismissUpsell,
    requestUpsell,
    discardChanges,
    setPreview,
    setSelectedPath,
    setInstanceLabel,
  };
}
