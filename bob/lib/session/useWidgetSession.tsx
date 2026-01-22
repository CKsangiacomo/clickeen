'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { CompiledWidget } from '../types';
import type { ApplyWidgetOpsResult, WidgetOp, WidgetOpError } from '../ops';
import { applyWidgetOps } from '../ops';
import type { CopilotThread } from '../copilot/types';
import type { BudgetDecision, BudgetKey, Policy } from '@clickeen/ck-policy';
import { can, canConsume, consume, evaluateLimits, sanitizeConfig, resolvePolicy as resolveCkPolicy } from '@clickeen/ck-policy';
import { persistConfigAssetsToTokyo } from '../assets/persistConfigAssetsToTokyo';
import {
  applyLocalizationOps,
  computeBaseFingerprint,
  filterAllowlistedOps,
  isCuratedPublicId,
  mergeLocalizationOps,
  normalizeLocaleToken,
  type LocalizationOp,
} from '../l10n/instance';
import { resolveTokyoBaseUrl } from '../env/tokyo';

type UpdateMeta = {
  source: 'field' | 'load' | 'external' | 'ops' | 'unknown';
  path: string;
  ts: number;
};

type SessionError =
  | { source: 'load'; message: string }
  | { source: 'ops'; errors: WidgetOpError[] }
  | { source: 'publish'; message: string; paths?: string[] };

type PreviewSettings = {
  device: 'desktop' | 'mobile';
  theme: 'light' | 'dark';
  host: 'canvas' | 'column' | 'banner' | 'floating';
};

type LocaleState = {
  baseLocale: string;
  activeLocale: string;
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
  allowlist: string[];
  source: string | null;
  dirty: boolean;
  stale: boolean;
  loading: boolean;
  error: string | null;
};

type TokyoOverlay = {
  ops: LocalizationOp[];
  baseFingerprint: string | null;
  baseUpdatedAt: string | null;
  source: string | null;
};

type SubjectMode = 'devstudio' | 'minibob';

type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  baseInstanceData: Record<string, unknown>;
  isDirty: boolean;
  policy: Policy;
  upsell: { reasonKey: string; detail?: string; cta: 'signup' | 'upgrade' } | null;
  isPublishing: boolean;
  preview: PreviewSettings;
  locale: LocaleState;
  selectedPath: string | null;
  lastUpdate: UpdateMeta | null;
  undoSnapshot: Record<string, unknown> | null;
  error: SessionError | null;
  copilotThreads: Record<string, CopilotThread>;
  meta: {
    publicId?: string;
    workspaceId?: string;
    widgetname?: string;
    label?: string;
  } | null;
};

type WidgetBootstrapMessage = {
  type: 'devstudio:load-instance';
  widgetname: string;
  compiled: CompiledWidget;
  instanceData?: Record<string, unknown> | null;
  policy?: Policy;
  publicId?: string;
  workspaceId?: string;
  label?: string;
  subjectMode?: SubjectMode;
};

type DevstudioExportInstanceDataMessage = {
  type: 'devstudio:export-instance-data';
  requestId: string;
  persistAssets?: boolean;
  exportMode?: 'current' | 'base';
  assetScope?: 'workspace' | 'curated';
  assetPublicId?: string;
  assetWidgetType?: string;
};

type BobExportInstanceDataResponseMessage = {
  type: 'bob:export-instance-data';
  requestId: string;
  ok: boolean;
  error?: string;
  instanceData?: Record<string, unknown>;
  meta?: SessionState['meta'];
  isDirty?: boolean;
};

type BobPublishedMessage = {
  type: 'bob:published';
  publicId: string;
  workspaceId: string;
  widgetType: string;
  status: 'published';
  config: Record<string, unknown>;
};

const DEFAULT_PREVIEW: PreviewSettings = {
  device: 'desktop',
  theme: 'light',
  host: 'canvas',
};

const DEFAULT_LOCALE = 'en';
const DEFAULT_LOCALE_STATE: LocaleState = {
  baseLocale: DEFAULT_LOCALE,
  activeLocale: DEFAULT_LOCALE,
  baseOps: [],
  userOps: [],
  allowlist: [],
  source: null,
  dirty: false,
  stale: false,
  loading: false,
  error: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function assertPolicy(value: unknown): Policy {
  if (!isRecord(value)) throw new Error('[useWidgetSession] policy must be an object');
  if (value.v !== 1) throw new Error('[useWidgetSession] policy.v must be 1');
  if (typeof value.profile !== 'string' || !value.profile) throw new Error('[useWidgetSession] policy.profile must be a string');
  if (typeof value.role !== 'string' || !value.role) throw new Error('[useWidgetSession] policy.role must be a string');
  if (!isRecord(value.flags)) throw new Error('[useWidgetSession] policy.flags must be an object');
  if (!isRecord(value.caps)) throw new Error('[useWidgetSession] policy.caps must be an object');
  if (!isRecord(value.budgets)) throw new Error('[useWidgetSession] policy.budgets must be an object');
  return value as Policy;
}

function resolveSubjectModeFromUrl(): SubjectMode {
  if (typeof window === 'undefined') return 'devstudio';
  const params = new URLSearchParams(window.location.search);
  const subject = (params.get('subject') || '').trim().toLowerCase();
  if (subject === 'minibob') return 'minibob';
  if (subject === 'devstudio') return 'devstudio';
  // Backward compat: existing Minibob param.
  if (params.get('minibob') === 'true') return 'minibob';
  return 'devstudio';
}

function resolvePolicySubject(policy: Policy): 'devstudio' | 'minibob' | 'workspace' {
  if (policy.profile === 'devstudio') return 'devstudio';
  if (policy.profile === 'minibob') return 'minibob';
  return 'workspace';
}

function resolveReadOnlyFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const readonlyFlag = (params.get('readonly') || params.get('readOnly') || '').trim().toLowerCase();
  if (readonlyFlag === '1' || readonlyFlag === 'true' || readonlyFlag === 'yes') return true;
  const role = (params.get('role') || params.get('mode') || '').trim().toLowerCase();
  return role === 'viewer' || role === 'readonly' || role === 'read-only';
}

function resolveDevPolicy(profile: SubjectMode): Policy {
  const role: Policy['role'] = resolveReadOnlyFromUrl() ? 'viewer' : 'editor';
  return resolveCkPolicy({ profile, role });
}

function enforceReadOnlyPolicy(policy: Policy): Policy {
  if (!resolveReadOnlyFromUrl()) return policy;
  if (policy.role === 'viewer') return policy;
  return { ...policy, role: 'viewer' };
}

function extractUploadUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(?:blob|data):/i.test(trimmed)) return trimmed;
  const match = trimmed.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (match && match[2] && /^(?:blob|data):/i.test(match[2])) return match[2];
  return null;
}

function tryParseJsonValue(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^[{["]/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function collectUploadUrls(value: unknown, found: Set<string>): void {
  if (typeof value === 'string') {
    const direct = extractUploadUrl(value);
    if (direct) {
      found.add(direct);
      return;
    }
    const parsed = tryParseJsonValue(value);
    if (parsed != null) {
      collectUploadUrls(parsed, found);
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectUploadUrls(entry, found));
    return;
  }
  Object.values(value as Record<string, unknown>).forEach((entry) => collectUploadUrls(entry, found));
}

function countUploadOps(ops: WidgetOp[]): number {
  const found = new Set<string>();
  ops.forEach((op) => {
    if (!op || typeof op !== 'object') return;
    if (op.op !== 'set') return;
    collectUploadUrls((op as any).value, found);
  });
  return found.size;
}

function useWidgetSessionInternal() {
  const initialSubjectMode = resolveSubjectModeFromUrl();
  const initialPolicy = resolveDevPolicy(initialSubjectMode);

  const [state, setState] = useState<SessionState>(() => ({
    compiled: null,
    instanceData: {},
    baseInstanceData: {},
    isDirty: false,
    policy: initialPolicy,
    upsell: null,
    isPublishing: false,
    preview: DEFAULT_PREVIEW,
    locale: DEFAULT_LOCALE_STATE,
    selectedPath: null,
    lastUpdate: null,
    undoSnapshot: null,
    error: null,
    copilotThreads: {},
    meta: null,
  }));

  const stateRef = useRef(state);
  stateRef.current = state;
  const allowlistCacheRef = useRef<Map<string, string[]>>(new Map());
  const localeRequestRef = useRef(0);

  const applyOps = useCallback(
    (ops: WidgetOp[]): ApplyWidgetOpsResult => {
      const compiled = state.compiled;
      const localeState = state.locale;
      const isLocaleMode = localeState.activeLocale !== localeState.baseLocale;
      if (!compiled || compiled.controls.length === 0) {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex: 0, message: 'This widget did not compile with controls[]' }],
        };
        setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
        return result;
      }
      if (state.policy.role === 'viewer') {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex: 0, message: 'Read-only mode: editing is disabled.' }],
        };
        setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors }, upsell: null }));
        return result;
      }

      // Policy enforcement (gate on interaction; fail-closed).
      const denyOps = (
        opIndex: number,
        path: string | undefined,
        decision: { reasonKey: string; detail?: string }
      ) => {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex, path, message: decision.reasonKey }],
        };
        setState((prev) => ({
          ...prev,
          error: null,
          upsell: {
            reasonKey: decision.reasonKey,
            detail: decision.detail,
            cta: prev.policy.profile === 'minibob' ? 'signup' : 'upgrade',
          },
        }));
        return result;
      };

      const editsBudget = state.policy.budgets['budget.edits'];
      if (editsBudget) {
        const decision = canConsume(state.policy, 'budget.edits', 1);
        if (!decision.ok) return denyOps(0, ops[0]?.path, decision);
      }

      const uploadCount = countUploadOps(ops);
      const uploadsBudget = state.policy.budgets['budget.uploads'];
      if (uploadCount > 0 && uploadsBudget) {
        const decision = canConsume(state.policy, 'budget.uploads', uploadCount);
        if (!decision.ok) return denyOps(0, ops[0]?.path, decision);
      }

      let opsToApply = ops;

      if (isLocaleMode) {
        if (!localeState.allowlist.length) {
          const result: ApplyWidgetOpsResult = {
            ok: false,
            errors: [{ opIndex: 0, message: 'Localization allowlist not loaded' }],
          };
          setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
          return result;
        }

        const candidateOps = ops.filter((op) => op && op.op === 'set' && typeof (op as any).value === 'string') as LocalizationOp[];
        if (candidateOps.length === 0) {
          const result: ApplyWidgetOpsResult = {
            ok: false,
            errors: [{ opIndex: 0, message: 'Localized edits only support text fields' }],
          };
          setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
          return result;
        }

        const { filtered } = filterAllowlistedOps(candidateOps, localeState.allowlist);
        if (filtered.length === 0) {
          const result: ApplyWidgetOpsResult = {
            ok: false,
            errors: [{ opIndex: 0, message: 'This field is not localizable' }],
          };
          setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
          return result;
        }
        opsToApply = filtered;
      }

      const applied = applyWidgetOps({
        data: state.instanceData,
        ops: opsToApply,
        controls: compiled.controls,
      });

      if (!applied.ok) {
        setState((prev) => ({ ...prev, error: { source: 'ops', errors: applied.errors } }));
        return applied;
      }

      const violations = evaluateLimits({
        config: applied.data,
        limits: compiled.limits ?? null,
        policy: state.policy,
        context: 'ops',
      });
      if (violations.length > 0) {
        const first = violations[0];
        return denyOps(0, first.path, { reasonKey: first.reasonKey, detail: first.detail });
      }

      if (isLocaleMode) {
        const merged = mergeLocalizationOps(localeState.userOps, opsToApply as LocalizationOp[]);
        const localized = applyLocalizationOps(
          applyLocalizationOps(state.baseInstanceData, localeState.baseOps),
          merged
        );
        setState((prev) => ({
          ...prev,
          instanceData: localized,
          locale: { ...prev.locale, userOps: merged, dirty: true, error: null },
          undoSnapshot: null,
          error: null,
          upsell: null,
          policy: (() => {
            let next = prev.policy;
            if (editsBudget) next = consume(next, 'budget.edits', 1);
            if (uploadCount > 0 && uploadsBudget) next = consume(next, 'budget.uploads', uploadCount);
            return next;
          })(),
          lastUpdate: {
            source: 'ops',
            path: opsToApply[0]?.path || '',
            ts: Date.now(),
          },
        }));

        return applied;
      }

      setState((prev) => ({
        ...prev,
        undoSnapshot: prev.instanceData,
        instanceData: applied.data,
        baseInstanceData: applied.data,
        isDirty: true,
        error: null,
        upsell: null,
        policy: (() => {
          let next = prev.policy;
          if (editsBudget) next = consume(next, 'budget.edits', 1);
          if (uploadCount > 0 && uploadsBudget) next = consume(next, 'budget.uploads', uploadCount);
          return next;
        })(),
        lastUpdate: {
          source: 'ops',
          path: opsToApply[0]?.path || '',
          ts: Date.now(),
        },
      }));

      return applied;
    },
    [state.compiled, state.instanceData, state.baseInstanceData, state.policy, state.locale]
  );

  const undoLastOps = useCallback(() => {
    setState((prev) => {
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
  }, []);

  const commitLastOps = useCallback(() => {
    setState((prev) => {
      if (!prev.undoSnapshot) return prev;
      return { ...prev, undoSnapshot: null };
    });
  }, []);

  const loadLocaleAllowlist = useCallback(async (widgetType: string): Promise<string[]> => {
    const cached = allowlistCacheRef.current.get(widgetType);
    if (cached) return cached;

    const base = resolveTokyoBaseUrl();
    const res = await fetch(`${base}/widgets/${encodeURIComponent(widgetType)}/localization.json`, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to load localization allowlist (${res.status}) ${text}`.trim());
    }
    const json = (await res.json().catch(() => null)) as { v?: number; paths?: Array<{ path?: string }> } | null;
    if (!json || json.v !== 1 || !Array.isArray(json.paths)) {
      throw new Error('Invalid localization allowlist');
    }
    const allowlist = json.paths
      .map((entry) => (typeof entry?.path === 'string' ? entry.path.trim() : ''))
      .filter(Boolean);
    allowlistCacheRef.current.set(widgetType, allowlist);
    return allowlist;
  }, []);

  const loadParisLayer = useCallback(async (
    workspaceId: string,
    publicId: string,
    layer: string,
    layerKey: string,
    subject: 'devstudio' | 'minibob' | 'workspace'
  ): Promise<TokyoOverlay | null> => {
    const res = await fetch(
      `/api/paris/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
        publicId
      )}/layers/${encodeURIComponent(layer)}/${encodeURIComponent(layerKey)}?subject=${encodeURIComponent(subject)}`,
      { cache: 'no-store' }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Failed to load layer overlay (${res.status}) ${detail}`.trim());
    }
    const overlay = (await res.json().catch(() => null)) as any;
    const ops = Array.isArray(overlay?.ops) ? overlay.ops : [];
    const baseFingerprintRaw = typeof overlay?.baseFingerprint === 'string' ? overlay.baseFingerprint.trim() : '';
    const baseFingerprint = /^[a-f0-9]{64}$/i.test(baseFingerprintRaw) ? baseFingerprintRaw : null;
    const baseUpdatedAt = typeof overlay?.baseUpdatedAt === 'string' ? overlay.baseUpdatedAt : null;
    const source = typeof overlay?.source === 'string' ? overlay.source : null;
    const normalizedOps = ops
      .filter((op: any) => op && op.op === 'set' && typeof op.path === 'string' && typeof op.value === 'string')
      .map((op: any) => ({ op: 'set' as const, path: op.path, value: op.value }));
    return {
      ops: normalizedOps,
      baseFingerprint,
      baseUpdatedAt,
      source,
    };
  }, []);

  const setLocalePreview = useCallback(async (rawLocale: string) => {
    const normalized = normalizeLocaleToken(rawLocale) ?? DEFAULT_LOCALE;
    const snapshot = stateRef.current;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const workspaceId = snapshot.meta?.workspaceId ? String(snapshot.meta.workspaceId) : '';
    const widgetType = snapshot.compiled?.widgetname ?? snapshot.meta?.widgetname;
    const baseLocale = snapshot.locale.baseLocale;
    const subject = resolvePolicySubject(snapshot.policy);

    if (!publicId || !workspaceId || !widgetType) {
      setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          activeLocale: normalized,
          error: 'Missing instance context',
          loading: false,
          stale: false,
        },
      }));
      return;
    }

    const requestId = ++localeRequestRef.current;
    if (normalized === baseLocale) {
      setState((prev) => ({
        ...prev,
        instanceData: prev.baseInstanceData,
        locale: {
          ...prev.locale,
          activeLocale: normalized,
          baseOps: [],
          userOps: [],
          allowlist: prev.locale.allowlist,
          source: null,
          dirty: false,
          stale: false,
          loading: false,
          error: null,
        },
        undoSnapshot: null,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      locale: { ...prev.locale, activeLocale: normalized, loading: true, error: null, dirty: false, stale: false },
      undoSnapshot: null,
    }));

    try {
      const [allowlist, localeOverlay] = await Promise.all([
        loadLocaleAllowlist(widgetType),
        loadParisLayer(workspaceId, publicId, 'locale', normalized, subject),
      ]);

      if (localeRequestRef.current !== requestId) return;
      const source = localeOverlay?.source ?? null;
      if (!localeOverlay?.ops.length && isCuratedPublicId(publicId) && normalized !== baseLocale) {
        throw new Error('Missing locale overlay for curated instance');
      }
      const baseFiltered = filterAllowlistedOps(localeOverlay?.ops ?? [], allowlist);
      const userOverlay =
        (await loadParisLayer(workspaceId, publicId, 'user', normalized, subject)) ??
        (await loadParisLayer(workspaceId, publicId, 'user', 'global', subject));
      const userFiltered = filterAllowlistedOps(userOverlay?.ops ?? [], allowlist);
      let baseOps = baseFiltered.filtered;
      let userOps = userFiltered.filtered;
      let stale = false;
      if (!localeOverlay?.baseFingerprint && baseOps.length > 0 && isCuratedPublicId(publicId) && normalized !== baseLocale) {
        throw new Error('Missing baseFingerprint for curated locale overlay');
      }
      if (localeOverlay?.baseFingerprint) {
        const currentFingerprint = await computeBaseFingerprint(snapshot.baseInstanceData);
        stale = localeOverlay.baseFingerprint !== currentFingerprint;
      }
      if (userOverlay?.baseFingerprint) {
        const currentFingerprint = await computeBaseFingerprint(snapshot.baseInstanceData);
        if (userOverlay.baseFingerprint !== currentFingerprint) {
          stale = true;
          userOps = [];
        }
      } else if (userOverlay?.ops?.length) {
        throw new Error('Missing baseFingerprint for user overrides');
      }
      if (stale) {
        baseOps = [];
        userOps = [];
      }
      if (localeRequestRef.current !== requestId) return;
      const localized = applyLocalizationOps(
        applyLocalizationOps(snapshot.baseInstanceData, baseOps),
        userOps
      );

      setState((prev) => ({
        ...prev,
        instanceData: localized,
        locale: {
          ...prev.locale,
          activeLocale: normalized,
          baseOps,
          userOps,
          allowlist,
          source,
          dirty: false,
          stale,
          loading: false,
          error: null,
        },
      }));
    } catch (err) {
      if (localeRequestRef.current !== requestId) return;
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, activeLocale: normalized, loading: false, error: message, stale: false },
      }));
    }
  }, [loadLocaleAllowlist, loadParisLayer]);

  const saveLocaleOverrides = useCallback(async () => {
    const snapshot = stateRef.current;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const workspaceId = snapshot.meta?.workspaceId ? String(snapshot.meta.workspaceId) : '';
    const widgetType = snapshot.compiled?.widgetname ?? snapshot.meta?.widgetname;
    const locale = snapshot.locale.activeLocale;
    const subject = resolvePolicySubject(snapshot.policy);

    if (snapshot.policy.role === 'viewer') {
      setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Read-only mode: localization edits are disabled.' },
      }));
      return;
    }
    if (!publicId || !widgetType || !workspaceId) {
      setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Missing instance context' },
      }));
      return;
    }
    if (locale === snapshot.locale.baseLocale) return;
    if (!snapshot.locale.dirty && !snapshot.locale.stale) {
      setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'No localized changes to save' },
      }));
      return;
    }

    try {
      const baseFingerprint = await computeBaseFingerprint(snapshot.baseInstanceData);
      const userOps = snapshot.locale.userOps;
      if (!userOps.length) {
        setState((prev) => ({
          ...prev,
          locale: { ...prev.locale, error: 'No localized changes to save' },
        }));
        return;
      }
      const res = await fetch(
        `/api/paris/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
          publicId
        )}/layers/user/${encodeURIComponent(locale)}?subject=${encodeURIComponent(subject)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ops: userOps,
            baseFingerprint,
            source: 'user',
            widgetType,
          }),
        }
      );
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        const errorCode = json?.error?.code || json?.error?.reasonKey;
        let message = json?.error?.message || errorCode || 'Failed to save locale overrides';
        if (errorCode === 'FINGERPRINT_MISMATCH') {
          message = 'Base content changed. Switch to Base, publish, then try saving overrides again.';
        }
        setState((prev) => ({
          ...prev,
          locale: { ...prev.locale, error: message, loading: false },
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          userOps,
          dirty: false,
          stale: false,
          error: null,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: message },
      }));
    }
  }, []);

  const revertLocaleOverrides = useCallback(async () => {
    const snapshot = stateRef.current;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const workspaceId = snapshot.meta?.workspaceId ? String(snapshot.meta.workspaceId) : '';
    const locale = snapshot.locale.activeLocale;
    const subject = resolvePolicySubject(snapshot.policy);
    if (snapshot.policy.role === 'viewer') {
      setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Read-only mode: localization edits are disabled.' },
      }));
      return;
    }
    if (!publicId || !workspaceId) return;
    if (!isCuratedPublicId(publicId) && !workspaceId) {
      setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Missing workspace context' },
      }));
      return;
    }
    if (locale === snapshot.locale.baseLocale) return;
    if (snapshot.locale.userOps.length === 0) return;

    try {
      const res = await fetch(
        `/api/paris/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
          publicId
        )}/layers/user/${encodeURIComponent(locale)}?subject=${encodeURIComponent(subject)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as any;
        const errorCode = json?.error?.code || json?.error?.reasonKey;
        const message = json?.error?.message || errorCode || 'Failed to revert locale overrides';
        setState((prev) => ({
          ...prev,
          locale: { ...prev.locale, error: message },
        }));
        return;
      }
      await setLocalePreview(locale);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: message },
      }));
    }
  }, [setLocalePreview]);

  const loadInstance = useCallback(async (message: WidgetBootstrapMessage) => {
    try {
      const compiled = message.compiled;
      if (!compiled) {
        throw new Error('[useWidgetSession] Missing compiled widget payload');
      }
      if (compiled.controls.length === 0) {
        throw new Error('[useWidgetSession] Widget compiled without controls[]');
      }

      if (!compiled.defaults || typeof compiled.defaults !== 'object' || Array.isArray(compiled.defaults)) {
        throw new Error('[useWidgetSession] compiled.defaults must be an object');
      }
      const defaults = compiled.defaults as Record<string, unknown>;

      let resolved: Record<string, unknown> = {};
      let nextWorkspaceId = message.workspaceId;

      const nextSubjectMode: SubjectMode = message.subjectMode ?? resolveSubjectModeFromUrl();
      let nextPolicy: Policy = resolveDevPolicy(nextSubjectMode);

      const incoming = message.instanceData as Record<string, unknown> | null | undefined;
      if (incoming != null && (!incoming || typeof incoming !== 'object' || Array.isArray(incoming))) {
        throw new Error('[useWidgetSession] instanceData must be an object');
      }

      if (message.policy && typeof message.policy === 'object') {
        nextPolicy = assertPolicy(message.policy);
      }

      if (incoming == null && message.publicId && message.workspaceId && !message.policy) {
        const url = `/api/paris/instance/${encodeURIComponent(message.publicId)}?workspaceId=${encodeURIComponent(
          message.workspaceId
        )}&subject=${encodeURIComponent(nextSubjectMode)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`[useWidgetSession] Failed to load instance from Paris (HTTP ${res.status})`);
        const json = (await res.json().catch(() => null)) as any;
        if (!json || typeof json !== 'object') {
          throw new Error('[useWidgetSession] Paris returned invalid JSON');
        }
        if (json.error) {
          const reasonKey = json.error?.reasonKey ? String(json.error.reasonKey) : 'coreui.errors.unknown';
          throw new Error(reasonKey);
        }
        resolved = json?.config && typeof json.config === 'object' && !Array.isArray(json.config)
          ? structuredClone(json.config)
          : structuredClone(defaults);
        if (json.policy && typeof json.policy === 'object') nextPolicy = assertPolicy(json.policy);
        else nextPolicy = resolveDevPolicy(nextSubjectMode);
        nextWorkspaceId = message.workspaceId;
      } else {
        resolved = incoming == null ? structuredClone(defaults) : structuredClone(incoming);
        if (!message.policy) nextPolicy = resolveDevPolicy(nextSubjectMode);
      }

      nextPolicy = enforceReadOnlyPolicy(nextPolicy);
      resolved = sanitizeConfig({
        config: resolved,
        limits: compiled.limits ?? null,
        policy: nextPolicy,
        context: 'load',
      });

      setState((prev) => ({
        ...prev,
        compiled,
        instanceData: resolved,
        baseInstanceData: resolved,
        isDirty: false,
        policy: nextPolicy,
        selectedPath: null,
        error: null,
        upsell: null,
        locale: { ...DEFAULT_LOCALE_STATE },
        lastUpdate: {
          source: 'load',
          path: '',
          ts: Date.now(),
        },
        undoSnapshot: null,
        meta: {
          publicId: message.publicId,
          workspaceId: nextWorkspaceId,
          widgetname: compiled.widgetname,
          label: message.label ?? compiled.displayName,
        },
      }));
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useWidgetSession] Failed to load instance', err, message);
      }
      const messageText = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        compiled: null,
        instanceData: {},
        baseInstanceData: {},
        isDirty: false,
        error: { source: 'load', message: messageText },
        upsell: null,
        locale: { ...DEFAULT_LOCALE_STATE },
        meta: null,
      }));
    }
  }, []);

  const dismissUpsell = useCallback(() => {
    setState((prev) => ({ ...prev, upsell: null }));
  }, []);

  const requestUpsell = useCallback((reasonKey: string, detail?: string) => {
    if (!reasonKey) return;
    setState((prev) => ({
      ...prev,
      upsell: {
        reasonKey,
        detail,
        cta: prev.policy.profile === 'minibob' ? 'signup' : 'upgrade',
      },
    }));
  }, []);

  const publish = useCallback(async () => {
    const publicId = state.meta?.publicId;
    const workspaceId = state.meta?.workspaceId;
    const widgetType = state.meta?.widgetname;
    if (!publicId || !workspaceId) {
      setState((prev) => ({
        ...prev,
        error: { source: 'publish', message: 'coreui.errors.publish.missingInstanceContext' },
      }));
      return;
    }
    if (!widgetType) {
      setState((prev) => ({
        ...prev,
        error: { source: 'publish', message: 'coreui.errors.widgetType.invalid' },
      }));
      return;
    }
    if (state.policy.role === 'viewer') {
      setState((prev) => ({
        ...prev,
        error: { source: 'publish', message: 'Read-only mode: publishing is disabled.' },
      }));
      return;
    }

    const gate = can(state.policy, 'instance.publish');
    if (!gate.allow) {
      setState((prev) => ({
        ...prev,
        error: null,
        upsell: {
          reasonKey: gate.reasonKey,
          detail: gate.detail,
          cta: prev.policy.profile === 'minibob' ? 'signup' : 'upgrade',
        },
      }));
      return;
    }

    const subject = state.policy.profile === 'devstudio' || state.policy.profile === 'minibob' ? state.policy.profile : 'workspace';

    setState((prev) => ({ ...prev, isPublishing: true, error: null }));
    try {
      const isCurated = isCuratedPublicId(publicId);
      const persisted = await persistConfigAssetsToTokyo(state.baseInstanceData, {
        scope: isCurated ? 'curated' : 'workspace',
        workspaceId,
        publicId,
        widgetType,
      });
      const res = await fetch(
        `/api/paris/instance/${encodeURIComponent(publicId)}?workspaceId=${encodeURIComponent(
          workspaceId
        )}&subject=${encodeURIComponent(subject)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ config: persisted, status: 'published' }),
        }
      );

      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        const err = json?.error;
        if (err?.kind === 'DENY' && err?.upsell === 'UP') {
          setState((prev) => ({
            ...prev,
            isPublishing: false,
            error: null,
            upsell: {
              reasonKey: err.reasonKey || 'coreui.errors.unknown',
              detail: err.detail,
              cta: prev.policy.profile === 'minibob' ? 'signup' : 'upgrade',
            },
          }));
          return;
        }
        if (err?.kind === 'VALIDATION') {
          setState((prev) => ({
            ...prev,
            isPublishing: false,
            error: { source: 'publish', message: err.reasonKey || 'coreui.errors.publish.failed', paths: err.paths },
          }));
          return;
        }
        setState((prev) => ({
          ...prev,
          isPublishing: false,
          error: { source: 'publish', message: err?.reasonKey || 'coreui.errors.publish.failed' },
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isPublishing: false,
        isDirty: false,
        error: null,
        upsell: null,
        baseInstanceData:
          json?.config && typeof json.config === 'object' && !Array.isArray(json.config) ? json.config : prev.baseInstanceData,
        instanceData: (() => {
          const nextBase =
            json?.config && typeof json.config === 'object' && !Array.isArray(json.config) ? json.config : prev.baseInstanceData;
          if (prev.locale.activeLocale !== prev.locale.baseLocale) {
            return applyLocalizationOps(applyLocalizationOps(nextBase, prev.locale.baseOps), prev.locale.userOps);
          }
          return nextBase;
        })(),
        policy: json?.policy && typeof json.policy === 'object' ? assertPolicy(json.policy) : prev.policy,
      }));

      try {
        const message: BobPublishedMessage = {
          type: 'bob:published',
          publicId,
          workspaceId,
          widgetType,
          status: 'published',
          config: persisted,
        };
        window.parent?.postMessage(message, '*');
      } catch {}
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, isPublishing: false, error: { source: 'publish', message: messageText } }));
    }
  }, [
    state.baseInstanceData,
    state.meta?.publicId,
    state.meta?.workspaceId,
    state.meta?.widgetname,
    state.policy,
  ]);

  const loadFromUrlParams = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const workspaceId = (params.get('workspaceId') || '').trim();
    const publicId = (params.get('publicId') || '').trim();
    if (!workspaceId || !publicId) return;

    const subject = resolveSubjectModeFromUrl();
    const instanceUrl = `/api/paris/instance/${encodeURIComponent(publicId)}?workspaceId=${encodeURIComponent(
      workspaceId
    )}&subject=${encodeURIComponent(subject)}`;
    const instanceRes = await fetch(instanceUrl, { cache: 'no-store' });
    if (!instanceRes.ok) {
      throw new Error(`[useWidgetSession] Failed to load instance (HTTP ${instanceRes.status})`);
    }
    const instanceJson = (await instanceRes.json().catch(() => null)) as any;
    if (!instanceJson || typeof instanceJson !== 'object') {
      throw new Error('[useWidgetSession] Paris returned invalid JSON');
    }
    if (instanceJson.error) {
      const reasonKey = instanceJson.error?.reasonKey ? String(instanceJson.error.reasonKey) : 'coreui.errors.unknown';
      throw new Error(reasonKey);
    }
    const widgetType = typeof instanceJson.widgetType === 'string' ? instanceJson.widgetType : '';
    if (!widgetType) {
      throw new Error('[useWidgetSession] Missing widgetType in instance payload');
    }

    const compiledRes = await fetch(`/api/widgets/${encodeURIComponent(widgetType)}/compiled`, { cache: 'no-store' });
    if (!compiledRes.ok) {
      throw new Error(`[useWidgetSession] Failed to compile widget ${widgetType} (HTTP ${compiledRes.status})`);
    }
    const compiled = (await compiledRes.json().catch(() => null)) as CompiledWidget | null;
    if (!compiled) throw new Error('[useWidgetSession] Invalid compiled widget payload');
    await loadInstance({
      type: 'devstudio:load-instance',
      widgetname: widgetType,
      compiled,
      instanceData: instanceJson.config,
      policy: instanceJson.policy,
      publicId: instanceJson.publicId ?? publicId,
      workspaceId,
      label: instanceJson.publicId ?? publicId,
      subjectMode: subject,
    });
  }, [loadInstance]);

  const setCopilotThread = useCallback((key: string, next: CopilotThread) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      copilotThreads: { ...prev.copilotThreads, [trimmed]: next },
    }));
  }, []);

  const updateCopilotThread = useCallback(
    (key: string, updater: (current: CopilotThread | null) => CopilotThread) => {
      const trimmed = key.trim();
      if (!trimmed) return;
      setState((prev) => {
        const current = prev.copilotThreads[trimmed] ?? null;
        const next = updater(current);
        return { ...prev, copilotThreads: { ...prev.copilotThreads, [trimmed]: next } };
      });
    },
    []
  );

  const consumeBudget = useCallback(
    (key: BudgetKey, amount = 1): BudgetDecision => {
      const budget = state.policy.budgets[key];
      if (!budget) return { ok: true, nextUsed: 0 };

      const decision = canConsume(state.policy, key, amount);
      if (!decision.ok) {
        setState((prev) => ({
          ...prev,
          error: null,
          upsell: {
            reasonKey: decision.reasonKey,
            detail: decision.detail,
            cta: prev.policy.profile === 'minibob' ? 'signup' : 'upgrade',
          },
        }));
        return decision;
      }

      setState((prev) => ({
        ...prev,
        policy: consume(prev.policy, key, amount),
        upsell: null,
      }));
      return decision;
    },
    [state.policy]
  );

  const setPreview = useCallback((updates: Partial<PreviewSettings>) => {
    setState((prev) => ({
      ...prev,
      preview: { ...prev.preview, ...updates },
    }));
  }, []);

  const setSelectedPath = useCallback((path: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedPath: typeof path === 'string' && path.trim() ? path.trim() : null,
    }));
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as (WidgetBootstrapMessage | DevstudioExportInstanceDataMessage) | undefined;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'devstudio:load-instance') {
        if (process.env.NODE_ENV === 'development') {
          console.log('[useWidgetSession] load-instance payload', data);
        }
        loadInstance(data);
        return;
      }

      if (data.type === 'devstudio:export-instance-data') {
        const requestId = typeof data.requestId === 'string' ? data.requestId : '';
        if (!requestId) return;
        const snapshot = stateRef.current;
        const persistAssets = (data as DevstudioExportInstanceDataMessage).persistAssets === true;
        const exportMode = (data as DevstudioExportInstanceDataMessage).exportMode === 'current' ? 'current' : 'base';
        const exportScope = (data as DevstudioExportInstanceDataMessage).assetScope === 'curated' ? 'curated' : 'workspace';

        (async () => {
          try {
            const baseData = exportMode === 'current' ? snapshot.instanceData : snapshot.baseInstanceData;
            const instanceData = persistAssets
              ? (() => {
                  const publicId = (data as DevstudioExportInstanceDataMessage).assetPublicId || snapshot.meta?.publicId;
                  const widgetType = (data as DevstudioExportInstanceDataMessage).assetWidgetType || snapshot.meta?.widgetname;
                  const workspaceId = snapshot.meta?.workspaceId;
                  if (exportScope === 'workspace' && !workspaceId) {
                    throw new Error('[Bob] Missing workspaceId for asset persistence');
                  }
                  if (exportScope === 'curated' && (!publicId || !widgetType)) {
                    throw new Error('[Bob] Missing publicId or widgetType for curated asset persistence');
                  }
                  return persistConfigAssetsToTokyo(baseData, {
                    scope: exportScope,
                    workspaceId,
                    publicId,
                    widgetType,
                  });
                })()
              : baseData;

            const reply: BobExportInstanceDataResponseMessage = {
              type: 'bob:export-instance-data',
              requestId,
              ok: true,
              instanceData: await Promise.resolve(instanceData),
              meta: snapshot.meta,
              isDirty: snapshot.isDirty,
            };

            const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
            window.parent?.postMessage(reply, targetOrigin);
          } catch (err) {
            const messageText = err instanceof Error ? err.message : String(err);
            const reply: BobExportInstanceDataResponseMessage = {
              type: 'bob:export-instance-data',
              requestId,
              ok: false,
              error: messageText,
            };
            const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
            window.parent?.postMessage(reply, targetOrigin);
          }
        })();
      }
    }

    window.addEventListener('message', handleMessage);
    if (window.parent) {
      window.parent.postMessage({ type: 'bob:session-ready' }, '*');
    }
    loadFromUrlParams().catch((err) => {
      const messageText = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        compiled: null,
        instanceData: {},
        baseInstanceData: {},
        isDirty: false,
        error: { source: 'load', message: messageText },
        upsell: null,
        locale: { ...DEFAULT_LOCALE_STATE },
        meta: null,
      }));
    });
    return () => window.removeEventListener('message', handleMessage);
  }, [loadFromUrlParams, loadInstance]);

  const value = useMemo(
    () => ({
      compiled: state.compiled,
      instanceData: state.instanceData,
      baseInstanceData: state.baseInstanceData,
      isDirty: state.isDirty,
      isMinibob: state.policy.profile === 'minibob',
      policy: state.policy,
      upsell: state.upsell,
      isPublishing: state.isPublishing,
      preview: state.preview,
      locale: state.locale,
      selectedPath: state.selectedPath,
      lastUpdate: state.lastUpdate,
      error: state.error,
      meta: state.meta,
      canUndo: Boolean(state.undoSnapshot) && state.locale.activeLocale === state.locale.baseLocale,
      copilotThreads: state.copilotThreads,
      applyOps,
      undoLastOps,
      commitLastOps,
      publish,
      dismissUpsell,
      requestUpsell,
      setSelectedPath,
      setPreview,
      setLocalePreview,
      saveLocaleOverrides,
      revertLocaleOverrides,
      loadInstance,
      consumeBudget,
      setCopilotThread,
      updateCopilotThread,
    }),
    [
      state,
      applyOps,
      undoLastOps,
      commitLastOps,
      publish,
      dismissUpsell,
      requestUpsell,
      loadInstance,
      setPreview,
      setLocalePreview,
      saveLocaleOverrides,
      revertLocaleOverrides,
      setSelectedPath,
      consumeBudget,
      setCopilotThread,
      updateCopilotThread,
    ]
  );

  return value;
}

const WidgetSessionContext = createContext<ReturnType<typeof useWidgetSessionInternal> | null>(null);

export function WidgetSessionProvider({ children }: { children: ReactNode }) {
  const value = useWidgetSessionInternal();
  return <WidgetSessionContext.Provider value={value}>{children}</WidgetSessionContext.Provider>;
}

export function useWidgetSession() {
  const context = useContext(WidgetSessionContext);
  if (!context) {
    throw new Error('useWidgetSession must be used within WidgetSessionProvider');
  }
  return context;
}
