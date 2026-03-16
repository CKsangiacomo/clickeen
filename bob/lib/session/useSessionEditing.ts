'use client';

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ApplyWidgetOpsResult, WidgetOp } from '../ops';
import { applyWidgetOps } from '../ops';
import type { BudgetDecision, BudgetKey } from '@clickeen/ck-policy';
import {
  canConsume,
  consume,
  evaluateLimits,
  sanitizeConfig,
} from '@clickeen/ck-policy';
import {
  applyLocalizationOps,
  buildL10nSnapshot,
  filterAllowlistedOps,
  mergeLocalizationOps,
  type LocalizationOp,
} from '../l10n/instance';
import {
  type PreviewSettings,
  type SessionState,
} from './sessionTypes';
import { resolveLocaleOverlayEntry } from './sessionLocalization';
import { applyWidgetNormalizations } from './sessionNormalization';
import { applyDefaultsIntoConfig } from './sessionConfig';

export function useSessionEditing(args: {
  state: SessionState;
  stateRef: MutableRefObject<SessionState>;
  setState: Dispatch<SetStateAction<SessionState>>;
}) {
  const previewOpsRef = useRef<WidgetOp[] | null>(null);

  useEffect(() => {
    previewOpsRef.current = args.state.previewOps;
  }, [args.state.previewOps]);

  const applyMinibobInjectedState = useCallback((nextState: Record<string, unknown>): boolean => {
    const snapshot = args.stateRef.current;
    const compiled = snapshot.compiled;
    const policy = snapshot.policy;
    if (!compiled || compiled.controls.length === 0) return false;
    if (!policy) return false;
    if (!compiled.defaults || typeof compiled.defaults !== 'object' || Array.isArray(compiled.defaults)) return false;

    const defaults = compiled.defaults as Record<string, unknown>;
    let resolved: Record<string, unknown> = structuredClone(nextState);

    resolved = applyDefaultsIntoConfig(compiled.normalization, defaults, resolved);
    resolved = sanitizeConfig({
      config: resolved,
      limits: compiled.limits ?? null,
      policy,
      context: 'load',
    });
    resolved = applyWidgetNormalizations(compiled.normalization, resolved);

    const baseNext = resolved;
    const instanceNext =
      snapshot.locale.activeLocale !== snapshot.locale.baseLocale
        ? applyLocalizationOps(applyLocalizationOps(baseNext, snapshot.locale.baseOps), snapshot.locale.userOps)
        : baseNext;

    args.setState((prev) => ({
      ...prev,
      undoSnapshot: prev.instanceData,
      baseInstanceData: baseNext,
      instanceData: instanceNext,
      previewData: null,
      previewOps: null,
      isDirty: true,
      minibobPersonalizationUsed: true,
      error: null,
      upsell: null,
      lastUpdate: { source: 'external', path: '', ts: Date.now() },
    }));

    return true;
  }, [args.setState, args.stateRef]);

  const applyOps = useCallback(
    (ops: WidgetOp[]): ApplyWidgetOpsResult => {
      const compiled = args.state.compiled;
      const localeState = args.state.locale;
      const isLocaleMode = localeState.activeLocale !== localeState.baseLocale;
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

      const denyOps = (
        opIndex: number,
        path: string | undefined,
        decision: { reasonKey: string; detail?: string }
      ) => {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex, path, message: decision.reasonKey }],
        };
        args.setState((prev) => ({
          ...prev,
          error: null,
          upsell: {
            reasonKey: decision.reasonKey,
            detail: decision.detail,
            cta: prev.policy?.profile === 'minibob' ? 'signup' : 'upgrade',
          },
        }));
        return result;
      };

      let opsToApply = ops;

      if (isLocaleMode) {
        if (!localeState.allowlist.length) {
          const result: ApplyWidgetOpsResult = {
            ok: false,
            errors: [{ opIndex: 0, message: 'Localization allowlist not loaded' }],
          };
          args.setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
          return result;
        }

        const candidateOps = ops.filter((op) => op && op.op === 'set' && typeof (op as any).value === 'string') as LocalizationOp[];
        if (candidateOps.length === 0) {
          const result: ApplyWidgetOpsResult = {
            ok: false,
            errors: [{ opIndex: 0, message: 'Localized edits only support text fields' }],
          };
          args.setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
          return result;
        }

        const { filtered } = filterAllowlistedOps(candidateOps, localeState.allowlist);
        if (filtered.length === 0) {
          const result: ApplyWidgetOpsResult = {
            ok: false,
            errors: [{ opIndex: 0, message: 'This field is not localizable' }],
          };
          args.setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
          return result;
        }
        opsToApply = filtered;
      }

      const applied = applyWidgetOps({
        data: args.state.instanceData,
        ops: opsToApply,
        controls: compiled.controls,
      });

      if (!applied.ok) {
        args.setState((prev) => ({ ...prev, error: { source: 'ops', errors: applied.errors } }));
        return applied;
      }

      const normalizedData = applyWidgetNormalizations(compiled.normalization, applied.data);

      const violations = evaluateLimits({
        config: normalizedData,
        limits: compiled.limits ?? null,
        policy,
        context: 'ops',
      });
      if (violations.length > 0) {
        const first = violations[0];
        return denyOps(0, first.path, { reasonKey: first.reasonKey, detail: first.detail });
      }

      if (isLocaleMode) {
        const merged = mergeLocalizationOps(localeState.userOps, opsToApply as LocalizationOp[]);
        const localized = applyLocalizationOps(
          applyLocalizationOps(args.state.baseInstanceData, localeState.baseOps),
          merged,
        );
        args.setState((prev) => ({
          ...prev,
          instanceData: localized,
          locale: { ...prev.locale, userOps: merged, dirty: true, error: null },
          undoSnapshot: null,
          error: null,
          upsell: null,
          policy: prev.policy,
          lastUpdate: {
            source: 'ops',
            path: opsToApply[0]?.path || '',
            ts: Date.now(),
          },
        }));

        return applied;
      }

      args.setState((prev) => ({
        ...prev,
        undoSnapshot: prev.instanceData,
        instanceData: normalizedData,
        baseInstanceData: normalizedData,
        isDirty: true,
        error: null,
        upsell: null,
        policy: prev.policy,
        lastUpdate: {
          source: 'ops',
          path: opsToApply[0]?.path || '',
          ts: Date.now(),
        },
      }));

      return applied;
    },
    [args.setState, args.state],
  );

  const clearPreviewOps = useCallback(() => {
    previewOpsRef.current = null;
    args.setState((prev) => {
      if (!prev.previewOps && !prev.previewData) return prev;
      return { ...prev, previewOps: null, previewData: null };
    });
  }, [args.setState]);

  const setPreviewOps = useCallback((ops: WidgetOp[]): ApplyWidgetOpsResult => {
    const snapshot = args.stateRef.current;
    if (!Array.isArray(ops) || ops.length === 0) {
      return { ok: false, errors: [{ opIndex: 0, message: 'Ops must be a non-empty array' }] };
    }

    const compiled = snapshot.compiled;
    const policy = snapshot.policy;
    if (!compiled || compiled.controls.length === 0) {
      return { ok: false, errors: [{ opIndex: 0, message: 'This widget did not compile with controls[]' }] };
    }
    if (!policy) {
      return { ok: false, errors: [{ opIndex: 0, message: 'Editor context is not ready.' }] };
    }

    if (policy.role === 'viewer') {
      return { ok: false, errors: [{ opIndex: 0, message: 'Read-only mode: editing is disabled.' }] };
    }

    let opsToApply = ops;
    const localeState = snapshot.locale;
    const isLocaleMode = localeState.activeLocale !== localeState.baseLocale;

    if (isLocaleMode) {
      if (!localeState.allowlist.length) {
        return { ok: false, errors: [{ opIndex: 0, message: 'Localization allowlist not loaded' }] };
      }

      const candidateOps = ops.filter(
        (op) => op && op.op === 'set' && typeof (op as any).value === 'string',
      ) as LocalizationOp[];
      if (candidateOps.length === 0) {
        return { ok: false, errors: [{ opIndex: 0, message: 'Localized edits only support text fields' }] };
      }

      const { filtered } = filterAllowlistedOps(candidateOps, localeState.allowlist);
      if (filtered.length === 0) {
        return { ok: false, errors: [{ opIndex: 0, message: 'This field is not localizable' }] };
      }
      opsToApply = filtered;
    }

    const applied = applyWidgetOps({
      data: snapshot.instanceData,
      ops: opsToApply,
      controls: compiled.controls,
    });

    if (!applied.ok) {
      return applied;
    }

    const normalizedData = applyWidgetNormalizations(compiled.normalization, applied.data);

    const violations = evaluateLimits({
      config: normalizedData,
      limits: compiled.limits ?? null,
      policy,
      context: 'ops',
    });
    if (violations.length > 0) {
      const first = violations[0];
      return { ok: false, errors: [{ opIndex: 0, path: first.path, message: first.reasonKey }] };
    }

    args.setState((prev) => ({
      ...prev,
      previewData: normalizedData,
      previewOps: opsToApply,
    }));

    return applied;
  }, [args.setState, args.stateRef]);

  const undoLastOps = useCallback(() => {
    args.setState((prev) => {
      if (!prev.undoSnapshot) return prev;
      if (prev.locale.activeLocale !== prev.locale.baseLocale) return prev;
      return {
        ...prev,
        instanceData: prev.undoSnapshot,
        baseInstanceData: prev.undoSnapshot,
        undoSnapshot: null,
        isDirty: true,
        lastUpdate: {
          source: 'ops',
          path: '',
          ts: Date.now(),
        },
      };
    });
  }, [args.setState]);

  const commitLastOps = useCallback(() => {
    args.setState((prev) => {
      if (!prev.undoSnapshot) return prev;
      return { ...prev, undoSnapshot: null };
    });
  }, [args.setState]);

  useEffect(() => {
    if (!previewOpsRef.current) return;
    previewOpsRef.current = null;
    args.setState((prev) => {
      if (!prev.previewOps && !prev.previewData) return prev;
      return { ...prev, previewOps: null, previewData: null };
    });
  }, [args.setState, args.state.instanceData]);

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
        cta: prev.policy?.profile === 'minibob' ? 'signup' : 'upgrade',
      },
    }));
  }, [args.setState]);

  const discardChanges = useCallback(() => {
    args.setState((prev) => {
      const nextBase = structuredClone(prev.savedBaseInstanceData);
      const isLocaleMode = prev.locale.activeLocale !== prev.locale.baseLocale;
      const overlayEntry = isLocaleMode
        ? resolveLocaleOverlayEntry(prev.locale.overlayEntries, prev.locale.activeLocale)
        : null;
      const snapshotPaths = new Set(Object.keys(buildL10nSnapshot(nextBase, prev.locale.allowlist)));
      const baseOps = isLocaleMode
        ? filterAllowlistedOps(overlayEntry?.baseOps ?? [], prev.locale.allowlist).filtered.filter((op) =>
            snapshotPaths.has(op.path)
          )
        : [];
      const userOps = isLocaleMode
        ? filterAllowlistedOps(overlayEntry?.userOps ?? [], prev.locale.allowlist).filtered.filter((op) =>
            snapshotPaths.has(op.path)
          )
        : [];
      const nextInstance = isLocaleMode
        ? applyLocalizationOps(applyLocalizationOps(nextBase, baseOps), userOps)
        : nextBase;
      return {
        ...prev,
        baseInstanceData: nextBase,
        instanceData: nextInstance,
        isDirty: false,
        undoSnapshot: null,
        error: null,
        upsell: null,
        locale: {
          ...prev.locale,
          baseOps,
          userOps,
          source: overlayEntry?.source ?? (isLocaleMode ? prev.locale.source : null),
          dirty: false,
          error: null,
          stale: isLocaleMode && !prev.isDirty ? prev.locale.stale : false,
        },
        lastUpdate: { source: 'load', path: '', ts: Date.now() },
      };
    });
  }, [args.setState]);

  const consumeBudget = useCallback(
    (key: BudgetKey, amount = 1): BudgetDecision => {
      const policy = args.state.policy;
      if (!policy) {
        return { ok: false, upsell: 'UP', reasonKey: 'coreui.errors.auth.contextUnavailable' };
      }
      const budget = policy.budgets[key];
      if (!budget) return { ok: true, nextUsed: 0 };

      const decision = canConsume(policy, key, amount);
      if (!decision.ok) {
        args.setState((prev) => ({
          ...prev,
          error: null,
          upsell: {
            reasonKey: decision.reasonKey,
            detail: decision.detail,
            cta: prev.policy?.profile === 'minibob' ? 'signup' : 'upgrade',
          },
        }));
        return decision;
      }

      args.setState((prev) => ({
        ...prev,
        policy: prev.policy ? consume(prev.policy, key, amount) : prev.policy,
        upsell: null,
      }));
      return decision;
    },
    [args.setState, args.state.policy],
  );

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
    clearPreviewOps,
    setPreviewOps,
    undoLastOps,
    commitLastOps,
    dismissUpsell,
    requestUpsell,
    discardChanges,
    consumeBudget,
    setPreview,
    setSelectedPath,
    setInstanceLabel,
  };
}
