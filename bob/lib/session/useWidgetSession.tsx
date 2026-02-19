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
import {
  applyLocalizationOps,
  buildL10nSnapshot,
  computeL10nFingerprint,
  filterAllowlistedOps,
  isCuratedPublicId,
  mergeLocalizationOps,
  normalizeLocaleToken,
  type AllowlistEntry,
  type LocalizationOp,
} from '../l10n/instance';
import { applyWidgetNormalizationRules } from '../compiler/modules/normalization';
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

type EnforcementState = {
  mode: 'frozen';
  periodKey: string;
  frozenAt: string;
  resetAt: string;
};

type PreviewSettings = {
  device: 'desktop' | 'mobile';
  theme: 'light' | 'dark';
  host: 'canvas' | 'column' | 'banner' | 'floating';
};

type LocaleOverlayEntry = {
  locale: string;
  source: string | null;
  baseFingerprint: string | null;
  baseUpdatedAt: string | null;
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
  hasUserOps: boolean;
};

type LocaleSyncStage = 'idle' | 'queuing' | 'translating' | 'ready' | 'failed';

type LocaleState = {
  baseLocale: string;
  activeLocale: string;
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
  allowlist: AllowlistEntry[];
  availableLocales: string[];
  overlayEntries: LocaleOverlayEntry[];
  workspaceLocalesInvalid: string | null;
  source: string | null;
  dirty: boolean;
  stale: boolean;
  loading: boolean;
  error: string | null;
  sync: {
    stage: LocaleSyncStage;
    detail: string | null;
    lastUpdatedAt: string | null;
    lastError: string | null;
  };
};

type SubjectMode = 'devstudio' | 'minibob' | 'workspace';
type BootMode = 'message' | 'url';

type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  baseInstanceData: Record<string, unknown>;
  publishedBaseInstanceData: Record<string, unknown>;
  previewData: Record<string, unknown> | null;
  previewOps: WidgetOp[] | null;
  isDirty: boolean;
  minibobPersonalizationUsed: boolean;
  policy: Policy;
  enforcement: EnforcementState | null;
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
    ownerAccountId?: string;
    widgetname?: string;
    label?: string;
  } | null;
};

type EditorOpenMessage = {
  type: 'ck:open-editor';
  requestId?: string;
  sessionId?: string;
  widgetname: string;
  compiled: CompiledWidget;
  instanceData?: Record<string, unknown> | null;
  localization?: unknown;
  policy?: Policy;
  enforcement?: unknown;
  publicId?: string;
  workspaceId?: string;
  ownerAccountId?: string;
  label?: string;
  subjectMode?: SubjectMode;
};

const GLOBAL_TYPOGRAPHY_ROLE_SCALES: Record<string, Record<'xs' | 's' | 'm' | 'l' | 'xl', string>> = {
  title: { xs: '20px', s: '28px', m: '36px', l: '44px', xl: '60px' },
  body: { xs: '14px', s: '16px', m: '18px', l: '22px', xl: '24px' },
  section: { xs: '12px', s: '13px', m: '14px', l: '16px', xl: '18px' },
  question: { xs: '14px', s: '16px', m: '18px', l: '22px', xl: '24px' },
  answer: { xs: '14px', s: '16px', m: '18px', l: '22px', xl: '24px' },
  button: { xs: '13px', s: '15px', m: '18px', l: '20px', xl: '24px' },
};

function applyWidgetNormalizations(
  normalization: CompiledWidget['normalization'],
  config: Record<string, unknown>,
): Record<string, unknown> {
  const next = applyWidgetNormalizationRules(config, normalization);
  enforceGlobalTypographyRoleScales(next);
  return next;
}

function enforceGlobalTypographyRoleScales(config: Record<string, unknown>) {
  const typography = config.typography;
  if (!isPlainRecord(typography)) return;

  const roles = typography.roles;
  if (!isPlainRecord(roles)) return;

  const globalFamily =
    typeof typography.globalFamily === 'string' && typography.globalFamily.trim()
      ? typography.globalFamily.trim()
      : 'Inter';

  Object.values(roles).forEach((roleValue) => {
    if (!isPlainRecord(roleValue)) return;
    const family =
      typeof roleValue.family === 'string' && roleValue.family.trim()
        ? roleValue.family.trim()
        : globalFamily;
    roleValue.family = family;

    const sizePreset =
      typeof roleValue.sizePreset === 'string' && roleValue.sizePreset.trim()
        ? roleValue.sizePreset.trim()
        : 'm';
    roleValue.sizePreset = sizePreset;

    const weight =
      typeof roleValue.weight === 'string' && roleValue.weight.trim()
        ? roleValue.weight.trim()
        : '400';
    roleValue.weight = weight;

    const fontStyle =
      typeof roleValue.fontStyle === 'string' && roleValue.fontStyle.trim()
        ? roleValue.fontStyle.trim()
        : 'normal';
    roleValue.fontStyle = fontStyle;

    if (typeof roleValue.color === 'string') {
      const trimmed = roleValue.color.trim();
      roleValue.color = trimmed || '#131313';
    } else if (!isPlainRecord(roleValue.color)) {
      // Keep CKFill-compatible objects intact; only default when color is truly missing/invalid.
      roleValue.color = '#131313';
    }

    const lineHeightPreset =
      typeof roleValue.lineHeightPreset === 'string' && roleValue.lineHeightPreset.trim()
        ? roleValue.lineHeightPreset.trim()
        : 'normal';
    roleValue.lineHeightPreset = lineHeightPreset;
    if (!Object.prototype.hasOwnProperty.call(roleValue, 'lineHeightCustom')) {
      roleValue.lineHeightCustom = 1.4;
    }

    const trackingPreset =
      typeof roleValue.trackingPreset === 'string' && roleValue.trackingPreset.trim()
        ? roleValue.trackingPreset.trim()
        : 'normal';
    roleValue.trackingPreset = trackingPreset;
    if (!Object.prototype.hasOwnProperty.call(roleValue, 'trackingCustom')) {
      roleValue.trackingCustom = 0;
    }
  });

  const roleScales = isPlainRecord(typography.roleScales)
    ? (typography.roleScales as Record<string, unknown>)
    : ((typography.roleScales = {}) as Record<string, unknown>);

  Object.entries(GLOBAL_TYPOGRAPHY_ROLE_SCALES).forEach(([roleKey, presetMap]) => {
    if (!isPlainRecord(roles[roleKey])) return;
    const currentRoleScale = isPlainRecord(roleScales[roleKey])
      ? (roleScales[roleKey] as Record<string, unknown>)
      : ((roleScales[roleKey] = {}) as Record<string, unknown>);
    currentRoleScale.xs = presetMap.xs;
    currentRoleScale.s = presetMap.s;
    currentRoleScale.m = presetMap.m;
    currentRoleScale.l = presetMap.l;
    currentRoleScale.xl = presetMap.xl;
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractPrimaryUrl(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^(?:https?:\/\/|\/)/i.test(value)) return value;
  const match = value.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (match && match[2]) return match[2];
  return null;
}

function replacePrimaryUrl(raw: string, nextUrl: string): string {
  const value = String(raw || '');
  const match = value.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (match && match[2]) return value.replace(match[2], nextUrl);
  return nextUrl;
}

function isTokyoAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith('/arsenale/a/') ||
    pathname.startsWith('/arsenale/o/') ||
    pathname.startsWith('/widgets/') ||
    pathname.startsWith('/themes/') ||
    pathname.startsWith('/dieter/')
  );
}

function canonicalizeTokyoAssetUrlsInConfig(config: Record<string, unknown>): Record<string, unknown> {
  const visit = (node: unknown): string | void => {
    if (typeof node === 'string') {
      const primaryUrl = extractPrimaryUrl(node);
      if (!primaryUrl || primaryUrl.startsWith('/')) return;
      if (!/^https?:\/\//i.test(primaryUrl)) return;

      try {
        const parsed = new URL(primaryUrl);
        if (!isTokyoAssetPath(parsed.pathname)) return;
        const relative = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        return replacePrimaryUrl(node, relative);
      } catch {
        return;
      }
    }

    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        const replaced = visit(node[i]);
        if (typeof replaced === 'string') node[i] = replaced;
      }
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const replaced = visit(value);
      if (typeof replaced === 'string') (node as Record<string, unknown>)[key] = replaced;
    }
  };

  visit(config);
  return config;
}

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

type BobSessionReadyMessage = {
  type: 'bob:session-ready';
  sessionId: string;
  bootMode: BootMode;
};

type BobOpenEditorAckMessage = {
  type: 'bob:open-editor-ack';
  requestId: string;
  sessionId: string;
};

type BobOpenEditorAppliedMessage = {
  type: 'bob:open-editor-applied';
  requestId: string;
  sessionId: string;
  publicId?: string;
  widgetname?: string;
};

type BobOpenEditorFailedMessage = {
  type: 'bob:open-editor-failed';
  requestId?: string;
  sessionId?: string;
  reasonKey: string;
  message?: string;
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
  availableLocales: [DEFAULT_LOCALE],
  overlayEntries: [],
  workspaceLocalesInvalid: null,
  source: null,
  dirty: false,
  stale: false,
  loading: false,
  error: null,
  sync: {
    stage: 'idle',
    detail: null,
    lastUpdatedAt: null,
    lastError: null,
  },
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

function normalizeEnforcement(raw: unknown): EnforcementState | null {
  if (!isRecord(raw)) return null;
  if ((raw as any).mode !== 'frozen') return null;
  const resetAt = typeof (raw as any).resetAt === 'string' ? (raw as any).resetAt : '';
  if (!resetAt) return null;
  const resetMs = Date.parse(resetAt);
  if (!Number.isFinite(resetMs) || resetMs <= Date.now()) return null;
  return {
    mode: 'frozen',
    periodKey: typeof (raw as any).periodKey === 'string' ? (raw as any).periodKey : '',
    frozenAt: typeof (raw as any).frozenAt === 'string' ? (raw as any).frozenAt : '',
    resetAt,
  };
}

function normalizeLocalizationOps(raw: unknown): LocalizationOp[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const op = entry.op;
      const path = entry.path;
      const value = entry.value;
      if (op !== 'set') return null;
      if (typeof path !== 'string' || !path.trim()) return null;
      if (typeof value !== 'string') return null;
      return { op: 'set' as const, path: path.trim(), value };
    })
    .filter((entry): entry is LocalizationOp => Boolean(entry));
}

function normalizeLocalizationSnapshotForOpen(raw: unknown): {
  availableLocales: string[];
  overlayEntries: LocaleOverlayEntry[];
  workspaceLocalesInvalid: string | null;
} {
  if (!isRecord(raw)) {
    return {
      availableLocales: [DEFAULT_LOCALE],
      overlayEntries: [],
      workspaceLocalesInvalid: null,
    };
  }

  const workspaceLocales = Array.isArray(raw.workspaceLocales)
    ? raw.workspaceLocales
        .map((entry) => normalizeLocaleToken(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  const overlayEntriesMap = new Map<string, LocaleOverlayEntry>();
  if (Array.isArray(raw.localeOverlays)) {
    raw.localeOverlays.forEach((entry) => {
      if (!isRecord(entry)) return;
      const locale = normalizeLocaleToken(entry.locale);
      if (!locale) return;
      const source = typeof entry.source === 'string' && entry.source.trim() ? entry.source.trim() : null;
      const baseFingerprint =
        typeof entry.baseFingerprint === 'string' && /^[a-f0-9]{64}$/i.test(entry.baseFingerprint.trim())
          ? entry.baseFingerprint.trim()
          : null;
      const baseUpdatedAt = typeof entry.baseUpdatedAt === 'string' ? entry.baseUpdatedAt : null;
      const baseOps = normalizeLocalizationOps(entry.baseOps);
      const userOps = normalizeLocalizationOps(entry.userOps);
      overlayEntriesMap.set(locale, {
        locale,
        source,
        baseFingerprint,
        baseUpdatedAt,
        baseOps,
        userOps,
        hasUserOps: typeof entry.hasUserOps === 'boolean' ? entry.hasUserOps : userOps.length > 0,
      });
    });
  }

  const normalizedLocales = Array.from(
    new Set([
      DEFAULT_LOCALE,
      ...workspaceLocales,
      ...Array.from(overlayEntriesMap.keys()),
    ]),
  );
  const baseFirst = [DEFAULT_LOCALE, ...normalizedLocales.filter((locale) => locale !== DEFAULT_LOCALE).sort()];

  return {
    availableLocales: baseFirst,
    overlayEntries: Array.from(overlayEntriesMap.values()).sort((a, b) => a.locale.localeCompare(b.locale)),
    workspaceLocalesInvalid:
      typeof raw.invalidWorkspaceLocales === 'string' && raw.invalidWorkspaceLocales.trim()
        ? raw.invalidWorkspaceLocales.trim()
        : null,
  };
}

function resolveLocaleOverlayEntry(entries: LocaleOverlayEntry[], locale: string): LocaleOverlayEntry | null {
  const normalized = normalizeLocaleToken(locale);
  if (!normalized) return null;
  return entries.find((entry) => entry.locale === normalized) ?? null;
}

function upsertLocaleOverlayEntry(
  entries: LocaleOverlayEntry[],
  locale: string,
  mutate: (current: LocaleOverlayEntry | null) => LocaleOverlayEntry,
): LocaleOverlayEntry[] {
  const normalized = normalizeLocaleToken(locale);
  if (!normalized) return entries;
  const nextEntries = entries.slice();
  const index = nextEntries.findIndex((entry) => entry.locale === normalized);
  const current = index >= 0 ? nextEntries[index] : null;
  const next = mutate(current);
  if (index >= 0) {
    nextEntries[index] = next;
  } else {
    nextEntries.push(next);
  }
  return nextEntries.sort((a, b) => a.locale.localeCompare(b.locale));
}

function resolveSubjectModeFromUrl(): SubjectMode {
  if (typeof window === 'undefined') return 'devstudio';
  const params = new URLSearchParams(window.location.search);
  const subject = (params.get('subject') || '').trim().toLowerCase();
  if (subject === 'workspace') return 'workspace';
  if (subject === 'minibob') return 'minibob';
  if (subject === 'devstudio') return 'devstudio';
  return 'devstudio';
}

function resolveBootModeFromUrl(): BootMode {
  if (typeof window === 'undefined') return 'message';
  const params = new URLSearchParams(window.location.search);
  const boot = (params.get('boot') || '').trim().toLowerCase();
  return boot === 'url' ? 'url' : 'message';
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
  const fallbackProfile = profile === 'workspace' ? 'free' : profile;
  return resolveCkPolicy({ profile: fallbackProfile, role });
}

function enforceReadOnlyPolicy(policy: Policy): Policy {
  if (!resolveReadOnlyFromUrl()) return policy;
  if (policy.role === 'viewer') return policy;
  return { ...policy, role: 'viewer' };
}

function useWidgetSessionInternal() {
  const initialSubjectMode = resolveSubjectModeFromUrl();
  const initialPolicy = resolveDevPolicy(initialSubjectMode);

  const [state, setState] = useState<SessionState>(() => ({
    compiled: null,
    instanceData: {},
    baseInstanceData: {},
    publishedBaseInstanceData: {},
    previewData: null,
    previewOps: null,
    isDirty: false,
    minibobPersonalizationUsed: false,
    policy: initialPolicy,
    enforcement: null,
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
  const previewOpsRef = useRef<WidgetOp[] | null>(null);
  const pendingMinibobInjectionRef = useRef<Record<string, unknown> | null>(null);
  const allowlistCacheRef = useRef<Map<string, AllowlistEntry[]>>(new Map());
  const localeRequestRef = useRef(0);
  const localeSyncRunRef = useRef(0);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const openRequestStatusRef = useRef<
    Map<string, { status: 'processing' | 'applied' | 'failed'; publicId?: string; widgetname?: string; error?: string }>
  >(new Map());

  useEffect(() => {
    previewOpsRef.current = state.previewOps;
  }, [state.previewOps]);

  const applyMinibobInjectedState = useCallback((nextState: Record<string, unknown>): boolean => {
    const snapshot = stateRef.current;
    const compiled = snapshot.compiled;
    if (!compiled || compiled.controls.length === 0) return false;
    if (!compiled.defaults || typeof compiled.defaults !== 'object' || Array.isArray(compiled.defaults)) return false;

    const defaults = compiled.defaults as Record<string, unknown>;
    let resolved: Record<string, unknown> = structuredClone(nextState);

    resolved = applyDefaultsIntoConfig(compiled.normalization, defaults, resolved);
    resolved = sanitizeConfig({
      config: resolved,
      limits: compiled.limits ?? null,
      policy: snapshot.policy,
      context: 'load',
    });
    resolved = applyWidgetNormalizations(compiled.normalization, resolved);

    const baseNext = resolved;
    const instanceNext =
      snapshot.locale.activeLocale !== snapshot.locale.baseLocale
        ? applyLocalizationOps(applyLocalizationOps(baseNext, snapshot.locale.baseOps), snapshot.locale.userOps)
        : baseNext;

    setState((prev) => ({
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
  }, []);

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

      if (state.enforcement?.mode === 'frozen') {
        return denyOps(0, ops[0]?.path, {
          reasonKey: 'coreui.upsell.reason.viewsFrozen',
          detail: `Frozen until ${state.enforcement.resetAt}`,
        });
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

      const normalizedData = applyWidgetNormalizations(compiled.normalization, applied.data);

      const violations = evaluateLimits({
        config: normalizedData,
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
          policy: prev.policy,
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
    [state.compiled, state.instanceData, state.baseInstanceData, state.policy, state.locale]
  );

  const clearPreviewOps = useCallback(() => {
    previewOpsRef.current = null;
    setState((prev) => {
      if (!prev.previewOps && !prev.previewData) return prev;
      return { ...prev, previewOps: null, previewData: null };
    });
  }, []);

  const setPreviewOps = useCallback((ops: WidgetOp[]): ApplyWidgetOpsResult => {
    const snapshot = stateRef.current;
    if (!Array.isArray(ops) || ops.length === 0) {
      return { ok: false, errors: [{ opIndex: 0, message: 'Ops must be a non-empty array' }] };
    }

    const compiled = snapshot.compiled;
    if (!compiled || compiled.controls.length === 0) {
      return { ok: false, errors: [{ opIndex: 0, message: 'This widget did not compile with controls[]' }] };
    }

    if (snapshot.policy.role === 'viewer') {
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
      policy: snapshot.policy,
      context: 'ops',
    });
    if (violations.length > 0) {
      const first = violations[0];
      return { ok: false, errors: [{ opIndex: 0, path: first.path, message: first.reasonKey }] };
    }

    setState((prev) => ({
      ...prev,
      previewData: normalizedData,
      previewOps: opsToApply,
    }));

    return applied;
  }, []);

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

  useEffect(() => {
    if (!previewOpsRef.current) return;
    previewOpsRef.current = null;
    setState((prev) => {
      if (!prev.previewOps && !prev.previewData) return prev;
      return { ...prev, previewOps: null, previewData: null };
    });
  }, [state.instanceData]);

  const loadLocaleAllowlist = useCallback(async (widgetType: string): Promise<AllowlistEntry[]> => {
    const cached = allowlistCacheRef.current.get(widgetType);
    if (cached) return cached;

    const base = resolveTokyoBaseUrl();
    const res = await fetch(`${base}/widgets/${encodeURIComponent(widgetType)}/localization.json`, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to load localization allowlist (${res.status}) ${text}`.trim());
    }
    const json = (await res.json().catch(() => null)) as {
      v?: number;
      paths?: Array<{ path?: string; type?: string }>;
    } | null;
    if (!json || json.v !== 1 || !Array.isArray(json.paths)) {
      throw new Error('Invalid localization allowlist');
    }
    const allowlist = json.paths
      .map((entry) => {
        const path = typeof entry?.path === 'string' ? entry.path.trim() : '';
        const type: AllowlistEntry['type'] = entry?.type === 'richtext' ? 'richtext' : 'string';
        return { path, type };
      })
      .filter((entry) => entry.path);
    allowlistCacheRef.current.set(widgetType, allowlist);
    return allowlist;
  }, []);

  useEffect(() => {
    const widgetType = state.compiled?.widgetname ?? state.meta?.widgetname;
    if (!widgetType) return;
    if (state.locale.allowlist.length) return;

    let cancelled = false;
    loadLocaleAllowlist(widgetType)
      .then((allowlist) => {
        if (cancelled) return;
        setState((prev) => {
          if (prev.locale.allowlist.length) return prev;
          return { ...prev, locale: { ...prev.locale, allowlist } };
        });
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useWidgetSession] Failed to load localization allowlist', err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadLocaleAllowlist, state.compiled?.widgetname, state.locale.allowlist.length, state.meta?.widgetname]);

  // [Minibob Bridge] Listen for direct state injection from Prague Personalization
  useEffect(() => {
    // Check mode directly from URL/Context instead of state.meta (which lacks this prop)
    const mode = resolveSubjectModeFromUrl();
    if (mode !== 'minibob') return;

    const handler = (event: MessageEvent) => {
      // Basic origin check could go here if needed, but for now we rely on the specific protocol
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Protocol: ck:minibob-preview-state
      // Expects: { type: '...', state: Record<string, unknown> }
      if (data.type !== 'ck:minibob-preview-state') return;

      const requestId = typeof (data as any).requestId === 'string' ? (data as any).requestId.trim() : '';
      const nextState = data.state;
      if (!isRecord(nextState)) return;

      let applied = false;
      try {
        applied = applyMinibobInjectedState(nextState);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useWidgetSession] Minibob state injection rejected', err);
        }
      }

      if (!applied) {
        try {
          pendingMinibobInjectionRef.current = structuredClone(nextState);
        } catch {
          pendingMinibobInjectionRef.current = nextState;
        }
      }

      if (requestId) {
        try {
          const target =
            event.source && typeof (event.source as Window).postMessage === 'function'
              ? (event.source as Window)
              : window.parent;
          const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
          target?.postMessage({ type: 'ck:minibob-preview-state-applied', requestId, ok: applied }, targetOrigin);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [applyMinibobInjectedState]);

  useEffect(() => {
    const mode = resolveSubjectModeFromUrl();
    if (mode !== 'minibob') return;
    if (!state.compiled) return;
    const pending = pendingMinibobInjectionRef.current;
    if (!pending) return;

    try {
      if (applyMinibobInjectedState(pending)) {
        pendingMinibobInjectionRef.current = null;
      }
    } catch {
      // ignore
    }
  }, [applyMinibobInjectedState, state.compiled]);

  const setLocalePreview = useCallback(async (rawLocale: string) => {
    const normalized = normalizeLocaleToken(rawLocale) ?? DEFAULT_LOCALE;
    const snapshot = stateRef.current;
    const widgetType = snapshot.compiled?.widgetname ?? snapshot.meta?.widgetname;
    const baseLocale = snapshot.locale.baseLocale;
    if (!widgetType) {
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
      const allowlist = await loadLocaleAllowlist(widgetType);

      if (localeRequestRef.current !== requestId) return;
      const overlayEntry = resolveLocaleOverlayEntry(snapshot.locale.overlayEntries, normalized);
      const source = overlayEntry?.source ?? null;
      const l10nSnapshot = buildL10nSnapshot(snapshot.baseInstanceData, allowlist);
      const snapshotPaths = new Set(Object.keys(l10nSnapshot));
      const hasSnapshot = snapshotPaths.size > 0;
      const baseFiltered = filterAllowlistedOps(overlayEntry?.baseOps ?? [], allowlist);
      const userFiltered = filterAllowlistedOps(overlayEntry?.userOps ?? [], allowlist);
      const baseOps = baseFiltered.filtered.filter((op) => snapshotPaths.has(op.path));
      const userOps = userFiltered.filtered.filter((op) => snapshotPaths.has(op.path));
      let stale = false;
      const currentFingerprint = await computeL10nFingerprint(snapshot.baseInstanceData, allowlist);
      if (hasSnapshot) {
        if (!overlayEntry?.baseFingerprint) {
          stale = true;
          if (process.env.NODE_ENV === 'development' && overlayEntry && overlayEntry.baseOps.length > 0) {
            console.warn('[useWidgetSession] Missing baseFingerprint for locale overlay', {
              locale: normalized,
            });
          }
        } else if (overlayEntry.baseFingerprint !== currentFingerprint) {
          stale = true;
        }
        if (overlayEntry && overlayEntry.userOps.length > 0) {
          if (!overlayEntry.baseFingerprint) {
            stale = true;
            if (process.env.NODE_ENV === 'development') {
              console.warn('[useWidgetSession] Missing baseFingerprint for user overrides', {
                locale: normalized,
              });
            }
          } else if (overlayEntry.baseFingerprint !== currentFingerprint) {
            stale = true;
          }
        }
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
  }, [loadLocaleAllowlist]);

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
      const allowlist = snapshot.locale.allowlist.length
        ? snapshot.locale.allowlist
        : await loadLocaleAllowlist(widgetType);
      const baseFingerprint = await computeL10nFingerprint(snapshot.baseInstanceData, allowlist);
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
          message = 'Base content changed. Switch to Base, click "Save", refresh translations, then try saving overrides again.';
        }
        setState((prev) => ({
          ...prev,
          locale: { ...prev.locale, error: message, loading: false },
        }));
        return;
      }
      const persistedBaseFingerprint =
        typeof json?.baseFingerprint === 'string' && /^[a-f0-9]{64}$/i.test(json.baseFingerprint)
          ? json.baseFingerprint
          : baseFingerprint;
      const persistedBaseUpdatedAt =
        typeof json?.baseUpdatedAt === 'string' ? json.baseUpdatedAt : null;
      setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          overlayEntries: upsertLocaleOverlayEntry(prev.locale.overlayEntries, locale, (current) => ({
            locale,
            source: current?.source ?? 'user',
            baseFingerprint: persistedBaseFingerprint,
            baseUpdatedAt: persistedBaseUpdatedAt ?? current?.baseUpdatedAt ?? null,
            baseOps: current?.baseOps ?? [],
            userOps,
            hasUserOps: userOps.length > 0,
          })),
          availableLocales: prev.locale.availableLocales.includes(locale)
            ? prev.locale.availableLocales
            : [prev.locale.baseLocale, ...prev.locale.availableLocales.filter((entry) => entry !== prev.locale.baseLocale), locale]
                .filter((entry, index, all) => all.indexOf(entry) === index)
                .sort((a, b) => (a === prev.locale.baseLocale ? -1 : b === prev.locale.baseLocale ? 1 : a.localeCompare(b))),
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
  }, [loadLocaleAllowlist]);

  const refreshLocaleTranslations = useCallback(async () => {
    const rehydrateLocalizationSnapshot = async (args: {
      publicId: string;
      workspaceId: string;
      subject: 'devstudio' | 'minibob' | 'workspace';
    }): Promise<{ ok: true } | { ok: false; message: string }> => {
      try {
        const res = await fetch(
          `/api/paris/workspaces/${encodeURIComponent(args.workspaceId)}/instance/${encodeURIComponent(
            args.publicId
          )}?subject=${encodeURIComponent(args.subject)}`,
          { cache: 'no-store' }
        );
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          const message =
            json?.error?.message ||
            json?.error?.reasonKey ||
            json?.error?.code ||
            `Failed to reload localization snapshot (HTTP ${res.status})`;
          setState((prev) => ({
            ...prev,
            locale: { ...prev.locale, loading: false, error: message },
          }));
          return { ok: false, message };
        }
        if (!json || typeof json !== 'object') {
          const message = 'Failed to reload localization snapshot';
          setState((prev) => ({
            ...prev,
            locale: { ...prev.locale, loading: false, error: message },
          }));
          return { ok: false, message };
        }

        const localizationSnapshot = normalizeLocalizationSnapshotForOpen(json.localization);
        const current = stateRef.current;
        const widgetType = current.compiled?.widgetname ?? current.meta?.widgetname;
        const baseLocale = current.locale.baseLocale;
        const activeLocale = normalizeLocaleToken(current.locale.activeLocale) ?? baseLocale;
        let allowlist = current.locale.allowlist;
        if (!allowlist.length && widgetType) {
          allowlist = await loadLocaleAllowlist(widgetType);
        }

        let nextInstanceData = current.baseInstanceData;
        let nextBaseOps: LocalizationOp[] = [];
        let nextUserOps: LocalizationOp[] = [];
        let nextSource: string | null = null;
        let nextStale = false;

        if (activeLocale !== baseLocale) {
          const overlayEntry = resolveLocaleOverlayEntry(localizationSnapshot.overlayEntries, activeLocale);
          const l10nSnapshot = buildL10nSnapshot(current.baseInstanceData, allowlist);
          const snapshotPaths = new Set(Object.keys(l10nSnapshot));
          const hasSnapshot = snapshotPaths.size > 0;
          const baseFiltered = filterAllowlistedOps(overlayEntry?.baseOps ?? [], allowlist);
          const userFiltered = filterAllowlistedOps(overlayEntry?.userOps ?? [], allowlist);
          nextBaseOps = baseFiltered.filtered.filter((op) => snapshotPaths.has(op.path));
          nextUserOps = userFiltered.filtered.filter((op) => snapshotPaths.has(op.path));
          nextSource = overlayEntry?.source ?? null;
          const currentFingerprint = await computeL10nFingerprint(current.baseInstanceData, allowlist);
          if (hasSnapshot) {
            if (!overlayEntry?.baseFingerprint) {
              nextStale = true;
            } else if (overlayEntry.baseFingerprint !== currentFingerprint) {
              nextStale = true;
            }
            if (overlayEntry && nextUserOps.length > 0) {
              if (!overlayEntry.baseFingerprint) {
                nextStale = true;
              } else if (overlayEntry.baseFingerprint !== currentFingerprint) {
                nextStale = true;
              }
            }
          }
          nextInstanceData = applyLocalizationOps(
            applyLocalizationOps(current.baseInstanceData, nextBaseOps),
            nextUserOps
          );
        }

        setState((prev) => ({
          ...prev,
          instanceData: nextInstanceData,
          locale: {
            ...prev.locale,
            availableLocales: localizationSnapshot.availableLocales,
            overlayEntries: localizationSnapshot.overlayEntries,
            workspaceLocalesInvalid: localizationSnapshot.workspaceLocalesInvalid,
            activeLocale,
            baseOps: nextBaseOps,
            userOps: nextUserOps,
            source: nextSource,
            dirty: false,
            stale: nextStale,
            loading: false,
            error: null,
            allowlist,
          },
        }));
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState((prev) => ({
          ...prev,
          locale: { ...prev.locale, loading: false, error: message },
        }));
        return { ok: false, message };
      }
    };

    const readPublishStatus = async (args: {
      publicId: string;
      workspaceId: string;
      subject: 'devstudio' | 'minibob' | 'workspace';
    }): Promise<
      | { stage: 'ready'; detail: string | null }
      | { stage: 'translating'; detail: string | null }
      | { stage: 'failed'; detail: string }
    > => {
      try {
        const res = await fetch(
          `/api/paris/workspaces/${encodeURIComponent(args.workspaceId)}/instances/${encodeURIComponent(
            args.publicId
          )}/publish/status?subject=${encodeURIComponent(args.subject)}&_t=${Date.now()}`,
          { cache: 'no-store' }
        );
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          const detail =
            json?.error?.message ||
            json?.error?.reasonKey ||
            json?.error?.code ||
            `Failed to load translation status (HTTP ${res.status})`;
          return { stage: 'failed', detail };
        }

        const summary = json?.summary && typeof json.summary === 'object' ? json.summary : {};
        const l10n = summary?.l10n && typeof summary.l10n === 'object' ? summary.l10n : {};
        const failedTerminal = typeof l10n.failedTerminal === 'number' ? l10n.failedTerminal : 0;
        const inFlight = typeof l10n.inFlight === 'number' ? l10n.inFlight : 0;
        const retrying = typeof l10n.retrying === 'number' ? l10n.retrying : 0;
        const awaitingL10n = typeof summary.awaitingL10n === 'number' ? summary.awaitingL10n : 0;
        const awaitingSnapshot = typeof summary.awaitingSnapshot === 'number' ? summary.awaitingSnapshot : 0;
        const failed = typeof summary.failed === 'number' ? summary.failed : 0;
        const unpublished = typeof summary.unpublished === 'number' ? summary.unpublished : 0;
        const nextActionLabel =
          typeof json?.pipeline?.l10n?.nextAction?.label === 'string'
            ? json.pipeline.l10n.nextAction.label.trim()
            : '';
        const firstLocaleError = Array.isArray(json?.locales)
          ? json.locales.find((entry: any) => typeof entry?.l10n?.lastError === 'string' && entry.l10n.lastError.trim())
          : null;
        const localeError =
          firstLocaleError && typeof firstLocaleError.l10n.lastError === 'string'
            ? firstLocaleError.l10n.lastError.trim()
            : '';

        if (unpublished > 0) {
          return { stage: 'failed', detail: 'Instance is unpublished. Publish base content before translating.' };
        }
        if (failedTerminal > 0 || failed > 0) {
          return { stage: 'failed', detail: localeError || nextActionLabel || 'Translation failed for one or more locales.' };
        }
        if (inFlight > 0) {
          return {
            stage: 'translating',
            detail: `${inFlight} locale translation job${inFlight === 1 ? '' : 's'} running.`,
          };
        }
        if (retrying > 0) {
          return { stage: 'translating', detail: `${retrying} locale${retrying === 1 ? '' : 's'} retrying.` };
        }
        if (awaitingSnapshot > 0) {
          return { stage: 'translating', detail: 'Waiting for localized snapshot publish.' };
        }
        if (awaitingL10n > 0) {
          return {
            stage: 'translating',
            detail: `${awaitingL10n} locale${awaitingL10n === 1 ? '' : 's'} queued for translation.`,
          };
        }
        return { stage: 'ready', detail: nextActionLabel || null };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return { stage: 'failed', detail };
      }
    };

    const pollUntilSynced = async (args: {
      runId: number;
      publicId: string;
      workspaceId: string;
      subject: 'devstudio' | 'minibob' | 'workspace';
    }) => {
      const startedAt = Date.now();
      const pollIntervalMs = 1500;
      const timeoutMs = 45_000;

      while (args.runId === localeSyncRunRef.current) {
        const status = await readPublishStatus({
          publicId: args.publicId,
          workspaceId: args.workspaceId,
          subject: args.subject,
        });
        if (args.runId !== localeSyncRunRef.current) return;

        if (status.stage === 'failed') {
          const nowIso = new Date().toISOString();
          setState((prev) => ({
            ...prev,
            locale: {
              ...prev.locale,
              loading: false,
              error: status.detail,
              sync: {
                stage: 'failed',
                detail: status.detail,
                lastUpdatedAt: nowIso,
                lastError: status.detail,
              },
            },
          }));
          return;
        }

        if (status.stage === 'ready') {
          const hydrated = await rehydrateLocalizationSnapshot({
            publicId: args.publicId,
            workspaceId: args.workspaceId,
            subject: args.subject,
          });
          if (args.runId !== localeSyncRunRef.current) return;
          const nowIso = new Date().toISOString();
          if (!hydrated.ok) {
            setState((prev) => ({
              ...prev,
              locale: {
                ...prev.locale,
                loading: false,
                error: hydrated.message,
                sync: {
                  stage: 'failed',
                  detail: hydrated.message,
                  lastUpdatedAt: nowIso,
                  lastError: hydrated.message,
                },
              },
            }));
            return;
          }
          setState((prev) => ({
            ...prev,
            locale: {
              ...prev.locale,
              loading: false,
              error: null,
              sync: {
                stage: 'ready',
                detail: 'Translations synced.',
                lastUpdatedAt: nowIso,
                lastError: null,
              },
            },
          }));
          return;
        }

        setState((prev) => ({
          ...prev,
          locale: {
            ...prev.locale,
            loading: false,
            error: null,
            sync: {
              ...prev.locale.sync,
              stage: 'translating',
              detail: status.detail || 'Translations are running.',
              lastError: null,
            },
          },
        }));

        if (Date.now() - startedAt >= timeoutMs) {
          setState((prev) => ({
            ...prev,
            locale: {
              ...prev.locale,
              loading: false,
              error: null,
              sync: {
                ...prev.locale.sync,
                stage: 'translating',
                detail: 'Translations are still processing. You can keep editing; sync will complete shortly.',
                lastError: null,
              },
            },
          }));
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    };

    const snapshot = stateRef.current;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const workspaceId = snapshot.meta?.workspaceId ? String(snapshot.meta.workspaceId) : '';
    const subject = resolvePolicySubject(snapshot.policy);

    if (snapshot.policy.role === 'viewer') {
      const message = 'Read-only mode: translation refresh is disabled.';
      setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          error: message,
          loading: false,
          sync: {
            stage: 'failed',
            detail: message,
            lastUpdatedAt: new Date().toISOString(),
            lastError: message,
          },
        },
      }));
      return { ok: false as const, message };
    }
    if (!publicId || !workspaceId) {
      const message = 'Missing instance context';
      setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          error: message,
          loading: false,
          sync: {
            stage: 'failed',
            detail: message,
            lastUpdatedAt: new Date().toISOString(),
            lastError: message,
          },
        },
      }));
      return { ok: false as const, message };
    }
    if (snapshot.isDirty) {
      const message = 'Base content changed. Click "Save" first, then refresh translations.';
      setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          error: message,
          loading: false,
          sync: {
            stage: 'failed',
            detail: message,
            lastUpdatedAt: new Date().toISOString(),
            lastError: message,
          },
        },
      }));
      return { ok: false as const, message };
    }
    if (snapshot.locale.activeLocale !== snapshot.locale.baseLocale && snapshot.locale.dirty) {
      const message = 'Save or revert locale overrides before refreshing translations.';
      setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          error: message,
          loading: false,
          sync: {
            stage: 'failed',
            detail: message,
            lastUpdatedAt: new Date().toISOString(),
            lastError: message,
          },
        },
      }));
      return { ok: false as const, message };
    }

    const runId = ++localeSyncRunRef.current;
    setState((prev) => ({
      ...prev,
      locale: {
        ...prev.locale,
        loading: true,
        error: null,
        sync: {
          stage: 'queuing',
          detail: 'Queuing translation jobs...',
          lastUpdatedAt: prev.locale.sync.lastUpdatedAt,
          lastError: null,
        },
      },
    }));

    try {
      const res = await fetch(
        `/api/paris/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
          publicId
        )}/l10n/enqueue-selected?subject=${encodeURIComponent(subject)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        },
      );
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        const message =
          json?.error?.message ||
          json?.error?.reasonKey ||
          json?.error?.code ||
          `Failed to refresh translations (HTTP ${res.status})`;
        setState((prev) => ({
          ...prev,
          locale: {
            ...prev.locale,
            loading: false,
            error: message,
            sync: {
              stage: 'failed',
              detail: message,
              lastUpdatedAt: new Date().toISOString(),
              lastError: message,
            },
          },
        }));
        return { ok: false as const, message };
      }
      const queued = typeof json?.queued === 'number' ? json.queued : 0;
      const skipped = typeof json?.skipped === 'number' ? json.skipped : 0;
      setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          loading: false,
          error: null,
          sync: {
            stage: 'translating',
            detail:
              queued > 0
                ? `Queued ${queued} translation job${queued === 1 ? '' : 's'}.`
                : 'Checking translation status...',
            lastUpdatedAt: prev.locale.sync.lastUpdatedAt,
            lastError: null,
          },
        },
      }));
      void pollUntilSynced({ runId, publicId, workspaceId, subject });
      return { ok: true as const, queued, skipped };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          loading: false,
          error: message,
          sync: {
            stage: 'failed',
            detail: message,
            lastUpdatedAt: new Date().toISOString(),
            lastError: message,
          },
        },
      }));
      return { ok: false as const, message };
    }
  }, [loadLocaleAllowlist]);

  const revertLocaleOverrides = useCallback(async () => {
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
    if (!publicId || !workspaceId) return;
    if (!widgetType) {
      setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Missing widget context' },
      }));
      return;
    }
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
      const allowlist = snapshot.locale.allowlist.length
        ? snapshot.locale.allowlist
        : await loadLocaleAllowlist(widgetType);
      const overlayEntry = resolveLocaleOverlayEntry(snapshot.locale.overlayEntries, locale);
      const l10nSnapshot = buildL10nSnapshot(snapshot.baseInstanceData, allowlist);
      const snapshotPaths = new Set(Object.keys(l10nSnapshot));
      const baseFiltered = filterAllowlistedOps(overlayEntry?.baseOps ?? [], allowlist);
      const baseOps = baseFiltered.filtered.filter((op) => snapshotPaths.has(op.path));
      const currentFingerprint = await computeL10nFingerprint(snapshot.baseInstanceData, allowlist);
      const stale =
        snapshotPaths.size > 0 &&
        ((!overlayEntry?.baseFingerprint && (overlayEntry?.baseOps.length ?? 0) > 0) ||
          (overlayEntry?.baseFingerprint ? overlayEntry.baseFingerprint !== currentFingerprint : false));
      const localized = applyLocalizationOps(snapshot.baseInstanceData, baseOps);

      setState((prev) => ({
        ...prev,
        instanceData: localized,
        locale: {
          ...prev.locale,
          overlayEntries: upsertLocaleOverlayEntry(prev.locale.overlayEntries, locale, (current) => ({
            locale,
            source: current?.source ?? overlayEntry?.source ?? null,
            baseFingerprint: current?.baseFingerprint ?? overlayEntry?.baseFingerprint ?? null,
            baseUpdatedAt: current?.baseUpdatedAt ?? overlayEntry?.baseUpdatedAt ?? null,
            baseOps: current?.baseOps ?? overlayEntry?.baseOps ?? [],
            userOps: [],
            hasUserOps: false,
          })),
          baseOps,
          userOps: [],
          allowlist,
          source: overlayEntry?.source ?? null,
          dirty: false,
          stale,
          loading: false,
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
  }, [loadLocaleAllowlist]);

  const loadInstance = useCallback(
    async (
      message: EditorOpenMessage,
    ): Promise<{ ok: true; publicId?: string; widgetname?: string } | { ok: false; error: string }> => {
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
      const nextWorkspaceId = message.workspaceId;
      const nextOwnerAccountId = message.ownerAccountId;
      const nextEnforcement: EnforcementState | null = normalizeEnforcement(message.enforcement);
      let nextLabel = typeof message.label === 'string' && message.label.trim() ? message.label.trim() : '';
      const nextLocalizationSnapshotRaw: unknown = message.localization;

      const nextSubjectMode: SubjectMode = message.subjectMode ?? resolveSubjectModeFromUrl();
      let nextPolicy: Policy = resolveDevPolicy(nextSubjectMode);

      const incoming = message.instanceData as Record<string, unknown> | null | undefined;
      if (incoming != null && (!incoming || typeof incoming !== 'object' || Array.isArray(incoming))) {
        throw new Error('[useWidgetSession] instanceData must be an object');
      }

      if (message.policy && typeof message.policy === 'object') {
        nextPolicy = assertPolicy(message.policy);
      }

      if (incoming == null && message.publicId && message.workspaceId) {
        throw new Error('[useWidgetSession] Missing instanceData in open-editor payload');
      }
      resolved = incoming == null ? structuredClone(defaults) : structuredClone(incoming);
      resolved = canonicalizeTokyoAssetUrlsInConfig(resolved);
      if (!message.policy) nextPolicy = resolveDevPolicy(nextSubjectMode);

      if (!nextLabel) {
        nextLabel = String(message.publicId || '').trim() || 'Untitled widget';
      }

      nextPolicy = enforceReadOnlyPolicy(nextPolicy);
      resolved = applyDefaultsIntoConfig(compiled.normalization, defaults, resolved);
      resolved = sanitizeConfig({
        config: resolved,
        limits: compiled.limits ?? null,
        policy: nextPolicy,
        context: 'load',
      });
      resolved = applyWidgetNormalizations(compiled.normalization, resolved);
      const localizationSnapshot = normalizeLocalizationSnapshotForOpen(nextLocalizationSnapshotRaw);

      setState((prev) => ({
        ...prev,
        compiled,
        instanceData: resolved,
        baseInstanceData: resolved,
        publishedBaseInstanceData: structuredClone(resolved),
        isDirty: false,
        minibobPersonalizationUsed: false,
        policy: nextPolicy,
        enforcement: nextEnforcement,
        selectedPath: null,
        error: null,
        upsell: null,
        locale: {
          ...DEFAULT_LOCALE_STATE,
          availableLocales: localizationSnapshot.availableLocales,
          overlayEntries: localizationSnapshot.overlayEntries,
          workspaceLocalesInvalid: localizationSnapshot.workspaceLocalesInvalid,
        },
        lastUpdate: {
          source: 'load',
          path: '',
          ts: Date.now(),
        },
        undoSnapshot: null,
        meta: {
          publicId: message.publicId,
          workspaceId: nextWorkspaceId,
          ownerAccountId: nextOwnerAccountId,
          widgetname: compiled.widgetname,
          label: nextLabel,
        },
      }));
      return {
        ok: true,
        publicId: message.publicId,
        widgetname: compiled.widgetname,
      };
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
        publishedBaseInstanceData: {},
        isDirty: false,
        minibobPersonalizationUsed: false,
        error: { source: 'load', message: messageText },
        upsell: null,
        enforcement: null,
        locale: { ...DEFAULT_LOCALE_STATE },
        meta: null,
      }));
      return { ok: false, error: messageText };
    }
    },
    [],
  );

  function applyDefaultsIntoConfig(
    normalization: CompiledWidget['normalization'],
    defaults: Record<string, unknown>,
    config: Record<string, unknown>,
  ) {
    const merge = (defaultsValue: unknown, targetValue: unknown): void => {
      if (!defaultsValue || typeof defaultsValue !== 'object' || Array.isArray(defaultsValue)) return;
      if (!targetValue || typeof targetValue !== 'object' || Array.isArray(targetValue)) return;

      const defaultsObj = defaultsValue as Record<string, unknown>;
      const targetObj = targetValue as Record<string, unknown>;

      Object.entries(defaultsObj).forEach(([key, dv]) => {
        if (key in targetObj) {
          merge(dv, targetObj[key]);
          return;
        }
        targetObj[key] = structuredClone(dv);
      });
    };

    merge(defaults, config);
    return applyWidgetNormalizations(normalization, config);
  }

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
    if (state.enforcement?.mode === 'frozen') {
      setState((prev) => ({
        ...prev,
        error: null,
        upsell: {
          reasonKey: 'coreui.upsell.reason.viewsFrozen',
          detail: `Frozen until ${state.enforcement?.resetAt}`,
          cta: prev.policy.profile === 'minibob' ? 'signup' : 'upgrade',
        },
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
      const configToPublish = state.baseInstanceData;
      const res = await fetch(
        `/api/paris/workspaces/${encodeURIComponent(workspaceId)}/instance/${encodeURIComponent(
          publicId
        )}?subject=${encodeURIComponent(subject)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ config: configToPublish, status: 'published' }),
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
        publishedBaseInstanceData:
          json?.config && typeof json.config === 'object' && !Array.isArray(json.config)
            ? structuredClone(json.config)
            : prev.publishedBaseInstanceData,
        baseInstanceData:
          json?.config && typeof json.config === 'object' && !Array.isArray(json.config)
            ? structuredClone(json.config)
            : prev.baseInstanceData,
        instanceData: (() => {
          const nextBase =
            json?.config && typeof json.config === 'object' && !Array.isArray(json.config) ? json.config : prev.baseInstanceData;
          if (prev.locale.activeLocale !== prev.locale.baseLocale) {
            return applyLocalizationOps(applyLocalizationOps(nextBase, prev.locale.baseOps), prev.locale.userOps);
          }
          return nextBase;
        })(),
        policy: json?.policy && typeof json.policy === 'object' ? assertPolicy(json.policy) : prev.policy,
        enforcement: Object.prototype.hasOwnProperty.call(json ?? {}, 'enforcement')
          ? normalizeEnforcement(json?.enforcement)
          : prev.enforcement,
      }));

      try {
        const message: BobPublishedMessage = {
          type: 'bob:published',
          publicId,
          workspaceId,
          widgetType,
          status: 'published',
          config: configToPublish,
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

  const discardChanges = useCallback(() => {
    setState((prev) => {
      const nextBase = structuredClone(prev.publishedBaseInstanceData);
      const nextInstance =
        prev.locale.activeLocale !== prev.locale.baseLocale
          ? applyLocalizationOps(applyLocalizationOps(nextBase, prev.locale.baseOps), prev.locale.userOps)
          : nextBase;
      return {
        ...prev,
        baseInstanceData: nextBase,
        instanceData: nextInstance,
        isDirty: false,
        undoSnapshot: null,
        error: null,
        upsell: null,
        lastUpdate: { source: 'load', path: '', ts: Date.now() },
      };
    });
  }, []);

  const loadFromUrlParams = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const workspaceId = (params.get('workspaceId') || '').trim();
    const publicId = (params.get('publicId') || '').trim();
    if (!publicId) return;

    const subject = resolveSubjectModeFromUrl();
    if (!workspaceId && subject !== 'minibob') return;

    const instanceUrl =
      subject === 'minibob'
        ? `/api/paris/instance/${encodeURIComponent(publicId)}?subject=${encodeURIComponent(subject)}`
        : `/api/paris/workspaces/${encodeURIComponent(workspaceId)}/instance/${encodeURIComponent(
            publicId,
          )}?subject=${encodeURIComponent(subject)}`;
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
    const displayName =
      typeof instanceJson.displayName === 'string' && instanceJson.displayName.trim()
        ? instanceJson.displayName.trim()
        : String(instanceJson.publicId ?? publicId).trim() || 'Untitled widget';

    const compiledRes = await fetch(`/api/widgets/${encodeURIComponent(widgetType)}/compiled`, { cache: 'no-store' });
    if (!compiledRes.ok) {
      throw new Error(`[useWidgetSession] Failed to compile widget ${widgetType} (HTTP ${compiledRes.status})`);
    }
    const compiled = (await compiledRes.json().catch(() => null)) as CompiledWidget | null;
    if (!compiled) throw new Error('[useWidgetSession] Invalid compiled widget payload');

    await loadInstance({
      type: 'ck:open-editor',
      widgetname: widgetType,
      compiled,
      instanceData: instanceJson.config,
      localization: instanceJson.localization,
      policy: instanceJson.policy,
      enforcement: instanceJson.enforcement,
      publicId: instanceJson.publicId ?? publicId,
      workspaceId,
      ownerAccountId:
        typeof instanceJson.ownerAccountId === 'string' ? instanceJson.ownerAccountId : undefined,
      label: displayName,
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

  const setInstanceLabel = useCallback((label: string) => {
    const trimmed = String(label || '').trim();
    setState((prev) => {
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
  }, []);

  useEffect(() => {
    const bootMode = resolveBootModeFromUrl();
    const postToParent = (
      payload:
        | BobSessionReadyMessage
        | BobOpenEditorAckMessage
        | BobOpenEditorAppliedMessage
        | BobOpenEditorFailedMessage
        | BobExportInstanceDataResponseMessage
        | BobPublishedMessage,
      origin: string,
    ) => {
      try {
        window.parent?.postMessage(payload, origin);
      } catch {}
    };

    function handleMessage(event: MessageEvent) {
      const data = event.data as (EditorOpenMessage | DevstudioExportInstanceDataMessage) | undefined;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'ck:open-editor') {
        if (bootMode !== 'message') return;
        const requestId = typeof data.requestId === 'string' ? data.requestId.trim() : '';
        const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
        const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
        if (!requestId || !sessionId) {
          postToParent(
            {
              type: 'bob:open-editor-failed',
              reasonKey: 'coreui.errors.builder.open.invalidRequest',
              message: 'Missing requestId/sessionId',
            },
            targetOrigin,
          );
          return;
        }
        if (sessionId !== sessionIdRef.current) {
          postToParent(
            {
              type: 'bob:open-editor-failed',
              requestId,
              sessionId,
              reasonKey: 'coreui.errors.builder.open.sessionMismatch',
              message: 'Session mismatch',
            },
            targetOrigin,
          );
          return;
        }

        const existing = openRequestStatusRef.current.get(requestId);
        postToParent(
          {
            type: 'bob:open-editor-ack',
            requestId,
            sessionId,
          },
          targetOrigin,
        );
        if (existing) {
          if (existing.status === 'applied') {
            postToParent(
              {
                type: 'bob:open-editor-applied',
                requestId,
                sessionId,
                publicId: existing.publicId,
                widgetname: existing.widgetname,
              },
              targetOrigin,
            );
          } else if (existing.status === 'failed') {
            postToParent(
              {
                type: 'bob:open-editor-failed',
                requestId,
                sessionId,
                reasonKey: existing.error || 'coreui.errors.builder.open.failed',
                message: existing.error,
              },
              targetOrigin,
            );
          }
          return;
        }

        openRequestStatusRef.current.set(requestId, { status: 'processing' });
        if (openRequestStatusRef.current.size > 50) {
          const oldest = openRequestStatusRef.current.keys().next().value;
          if (oldest) openRequestStatusRef.current.delete(oldest);
        }
        if (process.env.NODE_ENV === 'development') {
          console.log('[useWidgetSession] load-instance payload', data);
        }
        void loadInstance(data).then((result) => {
          if (result.ok) {
            openRequestStatusRef.current.set(requestId, {
              status: 'applied',
              publicId: result.publicId,
              widgetname: result.widgetname,
            });
            postToParent(
              {
                type: 'bob:open-editor-applied',
                requestId,
                sessionId,
                publicId: result.publicId,
                widgetname: result.widgetname,
              },
              targetOrigin,
            );
            return;
          }
          openRequestStatusRef.current.set(requestId, {
            status: 'failed',
            error: result.error,
          });
          postToParent(
            {
              type: 'bob:open-editor-failed',
              requestId,
              sessionId,
              reasonKey: result.error || 'coreui.errors.builder.open.failed',
              message: result.error,
            },
            targetOrigin,
          );
        });
        return;
      }

      if (data.type === 'devstudio:export-instance-data') {
        const requestId = typeof data.requestId === 'string' ? data.requestId : '';
        if (!requestId) return;
        const snapshot = stateRef.current;
        const exportMode = (data as DevstudioExportInstanceDataMessage).exportMode === 'current' ? 'current' : 'base';

        (async () => {
          try {
            const instanceData = exportMode === 'current' ? snapshot.instanceData : snapshot.baseInstanceData;

            const reply: BobExportInstanceDataResponseMessage = {
              type: 'bob:export-instance-data',
              requestId,
              ok: true,
              instanceData,
              meta: snapshot.meta,
              isDirty: snapshot.isDirty,
            };

            const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
            postToParent(reply, targetOrigin);
          } catch (err) {
            const messageText = err instanceof Error ? err.message : String(err);
            const reply: BobExportInstanceDataResponseMessage = {
              type: 'bob:export-instance-data',
              requestId,
              ok: false,
              error: messageText,
            };
            const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
            postToParent(reply, targetOrigin);
          }
        })();
      }
    }

    window.addEventListener('message', handleMessage);
    if (window.parent) {
      postToParent(
        {
          type: 'bob:session-ready',
          sessionId: sessionIdRef.current,
          bootMode,
        },
        '*',
      );
    }
    if (bootMode === 'url') {
      loadFromUrlParams().catch((err) => {
        const messageText = err instanceof Error ? err.message : String(err);
        setState((prev) => ({
          ...prev,
          compiled: null,
          instanceData: {},
          baseInstanceData: {},
          isDirty: false,
          minibobPersonalizationUsed: false,
          error: { source: 'load', message: messageText },
          upsell: null,
          locale: { ...DEFAULT_LOCALE_STATE },
          meta: null,
        }));
      });
    }
    return () => window.removeEventListener('message', handleMessage);
  }, [loadFromUrlParams, loadInstance]);

  const value = useMemo(
    () => ({
      compiled: state.compiled,
      instanceData: state.instanceData,
      baseInstanceData: state.baseInstanceData,
      previewData: state.previewData,
      previewOps: state.previewOps,
      isDirty: state.isDirty,
      minibobPersonalizationUsed: state.minibobPersonalizationUsed,
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
      setPreviewOps,
      clearPreviewOps,
      undoLastOps,
      commitLastOps,
      publish,
      discardChanges,
      dismissUpsell,
      requestUpsell,
      setSelectedPath,
      setInstanceLabel,
      setPreview,
      setLocalePreview,
      saveLocaleOverrides,
      refreshLocaleTranslations,
      revertLocaleOverrides,
      loadInstance,
      consumeBudget,
      setCopilotThread,
      updateCopilotThread,
    }),
    [
      state,
      applyOps,
      setPreviewOps,
      clearPreviewOps,
      undoLastOps,
      commitLastOps,
      publish,
      discardChanges,
      dismissUpsell,
      requestUpsell,
      loadInstance,
      setPreview,
      setLocalePreview,
      saveLocaleOverrides,
      refreshLocaleTranslations,
      revertLocaleOverrides,
      setSelectedPath,
      setInstanceLabel,
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
