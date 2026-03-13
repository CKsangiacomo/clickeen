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
import {
  can,
  canConsume,
  consume,
  evaluateLimits,
  sanitizeConfig,
  resolvePolicy as resolveCkPolicy,
  resolvePolicyFromEntitlementsSnapshot,
} from '@clickeen/ck-policy';
import {
  applyLocalizationOps,
  buildL10nSnapshot,
  computeL10nFingerprint,
  filterAllowlistedOps,
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
  | { source: 'save'; message: string; paths?: string[]; committed?: boolean };

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
  accountLocalesInvalid: string | null;
  accountL10nPolicy: {
    v: 1;
    baseLocale: string;
    ip: {
      enabled: boolean;
      countryToLocale: Record<string, string>;
    };
    switcher: {
      enabled: boolean;
    };
  };
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

type SubjectMode = 'minibob' | 'account';
type BootMode = 'message' | 'url';

type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  baseInstanceData: Record<string, unknown>;
  savedBaseInstanceData: Record<string, unknown>;
  previewData: Record<string, unknown> | null;
  previewOps: WidgetOp[] | null;
  isDirty: boolean;
  minibobPersonalizationUsed: boolean;
  policy: Policy;
  upsell: { reasonKey: string; detail?: string; cta: 'signup' | 'upgrade' } | null;
  isSaving: boolean;
  preview: PreviewSettings;
  locale: LocaleState;
  selectedPath: string | null;
  lastUpdate: UpdateMeta | null;
  undoSnapshot: Record<string, unknown> | null;
  error: SessionError | null;
  copilotThreads: Record<string, CopilotThread>;
  meta: {
    publicId?: string;
    accountId?: string;
    ownerAccountId?: string;
    accountCapsule?: string;
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
  publicId?: string;
  accountId?: string;
  ownerAccountId?: string;
  accountCapsule?: string;
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

function resolveAftermathSaveMessage(value: unknown): string | null {
  if (!isPlainRecord(value)) return null;
  const error = isPlainRecord(value.error) ? value.error : null;
  const detail = typeof error?.detail === 'string' ? error.detail.trim() : '';
  if (detail) return detail;
  return 'Saved, but background updates need attention.';
}

type DevstudioExportInstanceDataMessage = {
  type: 'devstudio:export-instance-data';
  requestId: string;
  exportMode?: 'current' | 'base';
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

type BobAccountCommand =
  | 'update-instance'
  | 'put-user-locale-layer'
  | 'delete-user-locale-layer';

type BobAccountCommandMessage = {
  type: 'bob:account-command';
  requestId: string;
  sessionId: string;
  command: BobAccountCommand;
  accountId: string;
  publicId: string;
  locale?: string;
  body?: unknown;
};

type RomaAccountCommandResultMessage = {
  type: 'roma:account-command-result';
  requestId: string;
  sessionId: string;
  command: BobAccountCommand;
  accountId: string;
  publicId: string;
  ok: boolean;
  status: number;
  payload?: unknown;
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
  accountLocalesInvalid: null,
  accountL10nPolicy: {
    v: 1,
    baseLocale: DEFAULT_LOCALE,
    ip: { enabled: false, countryToLocale: {} },
    switcher: { enabled: true },
  },
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

function normalizePolicyRole(value: unknown): Policy['role'] | null {
  switch (value) {
    case 'viewer':
    case 'editor':
    case 'admin':
    case 'owner':
      return value;
    default:
      return null;
  }
}

function normalizePolicyProfile(value: unknown): Policy['profile'] | null {
  switch (value) {
    case 'minibob':
    case 'free':
    case 'tier1':
    case 'tier2':
    case 'tier3':
      return value;
    default:
      return null;
  }
}

function extractErrorReasonKey(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!isRecord(value)) return fallback;
  const error = isRecord(value.error) ? value.error : null;
  if (typeof error?.reasonKey === 'string' && error.reasonKey.trim()) return error.reasonKey.trim();
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  if (typeof value.reasonKey === 'string' && value.reasonKey.trim()) return value.reasonKey.trim();
  return fallback;
}

function resolveAccountCapsuleFromBootstrapPayload(payload: unknown, accountId: string): string | null {
  if (!isRecord(payload)) return null;
  const authz = isRecord(payload.authz) ? payload.authz : null;
  if (!authz) return null;

  const bootstrapAccountId = typeof authz.accountId === 'string' ? authz.accountId.trim() : '';
  if (!bootstrapAccountId || bootstrapAccountId !== accountId) return null;

  const accountCapsule = typeof authz.accountCapsule === 'string' ? authz.accountCapsule.trim() : '';
  return accountCapsule || null;
}

function resolveAccountPolicyFromBootstrapPayload(payload: unknown, accountId: string): Policy {
  if (!isRecord(payload)) {
    throw new Error('[useWidgetSession] bootstrap payload must be an object');
  }

  const authz = isRecord(payload.authz) ? payload.authz : null;
  if (!authz) {
    throw new Error(extractErrorReasonKey(payload, 'coreui.errors.auth.required'));
  }

  const bootstrapAccountId = typeof authz.accountId === 'string' ? authz.accountId.trim() : '';
  if (!bootstrapAccountId || bootstrapAccountId !== accountId) {
    throw new Error('coreui.errors.auth.forbidden');
  }

  const role = normalizePolicyRole(authz.role);
  const profile = normalizePolicyProfile(authz.profile);
  if (!role || !profile) {
    throw new Error('coreui.errors.auth.required');
  }

  return resolvePolicyFromEntitlementsSnapshot({
    profile,
    role,
    entitlements: isRecord(authz.entitlements)
      ? (authz.entitlements as {
          flags?: Record<string, boolean> | null;
          caps?: Record<string, number | null> | null;
          budgets?: Record<string, { max: number | null; used: number } | null> | null;
        })
      : null,
  });
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
  baseLocale: string;
  availableLocales: string[];
  overlayEntries: LocaleOverlayEntry[];
  accountLocalesInvalid: string | null;
  accountL10nPolicy: LocaleState['accountL10nPolicy'];
} {
  if (!isRecord(raw)) {
    return {
      baseLocale: DEFAULT_LOCALE,
      availableLocales: [DEFAULT_LOCALE],
      overlayEntries: [],
      accountLocalesInvalid: null,
      accountL10nPolicy: structuredClone(DEFAULT_LOCALE_STATE.accountL10nPolicy),
    };
  }

  const policyRaw = isRecord((raw as any).policy) ? ((raw as any).policy as Record<string, unknown>) : null;
  const baseLocale = normalizeLocaleToken(policyRaw?.baseLocale) ?? DEFAULT_LOCALE;
  const ipRaw = policyRaw && isRecord(policyRaw.ip) ? (policyRaw.ip as Record<string, unknown>) : null;
  const ipEnabled = typeof ipRaw?.enabled === 'boolean' ? ipRaw.enabled : DEFAULT_LOCALE_STATE.accountL10nPolicy.ip.enabled;
  const countryToLocale: Record<string, string> = {};
  const mapRaw = ipRaw && isRecord(ipRaw.countryToLocale) ? (ipRaw.countryToLocale as Record<string, unknown>) : null;
  if (mapRaw) {
    for (const [countryRaw, localeRaw] of Object.entries(mapRaw)) {
      const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
      if (!/^[A-Z]{2}$/.test(country)) continue;
      const locale = normalizeLocaleToken(localeRaw);
      if (!locale) continue;
      countryToLocale[country] = locale;
    }
  }
  const switcherRaw = policyRaw && isRecord(policyRaw.switcher) ? (policyRaw.switcher as Record<string, unknown>) : null;
  const switcherEnabled =
    typeof switcherRaw?.enabled === 'boolean'
      ? switcherRaw.enabled
      : DEFAULT_LOCALE_STATE.accountL10nPolicy.switcher.enabled;
  const accountL10nPolicy: LocaleState['accountL10nPolicy'] = {
    v: 1,
    baseLocale,
    ip: { enabled: ipEnabled, countryToLocale },
    switcher: { enabled: switcherEnabled },
  };

  const accountLocales = Array.isArray((raw as any).accountLocales)
    ? ((raw as any).accountLocales as unknown[])
        .map((entry: unknown) => normalizeLocaleToken(entry))
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

  const normalizedLocales = Array.from(new Set([baseLocale, ...accountLocales]));
  const baseFirst = [baseLocale, ...normalizedLocales.filter((locale) => locale !== baseLocale).sort()];

  return {
    baseLocale,
    availableLocales: baseFirst,
    overlayEntries: Array.from(overlayEntriesMap.values()).sort((a, b) => a.locale.localeCompare(b.locale)),
    accountLocalesInvalid:
      typeof (raw as any).invalidAccountLocales === 'string' && (raw as any).invalidAccountLocales.trim()
        ? (raw as any).invalidAccountLocales.trim()
        : null,
    accountL10nPolicy,
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
  if (typeof window === 'undefined') return 'account';
  const params = new URLSearchParams(window.location.search);
  const subject = (params.get('subject') || '').trim().toLowerCase();
  if (subject === 'account') return 'account';
  if (subject === 'minibob') return 'minibob';
  return 'account';
}

function resolveBootModeFromUrl(): BootMode {
  if (typeof window === 'undefined') return 'message';
  const params = new URLSearchParams(window.location.search);
  const boot = (params.get('boot') || '').trim().toLowerCase();
  return boot === 'url' ? 'url' : 'message';
}

function resolveSurfaceFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('surface') || '').trim().toLowerCase();
}

function resolvePolicySubject(policy: Policy): 'minibob' | 'account' {
  if (policy.profile === 'minibob') return 'minibob';
  return 'account';
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
  const fallbackProfile = profile === 'account' ? 'free' : profile;
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
    savedBaseInstanceData: {},
    previewData: null,
    previewOps: null,
    isDirty: false,
    minibobPersonalizationUsed: false,
    policy: initialPolicy,
    upsell: null,
    isSaving: false,
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
  const bootModeRef = useRef<BootMode>(resolveBootModeFromUrl());
  const surfaceRef = useRef<string>(resolveSurfaceFromUrl());
  const hostOriginRef = useRef<string | null>(null);
  const openRequestStatusRef = useRef<
    Map<string, { status: 'processing' | 'applied' | 'failed'; publicId?: string; widgetname?: string; error?: string }>
  >(new Map());

  const fetchApi = useCallback((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const capsule = stateRef.current.meta?.accountCapsule?.trim();
    const inputUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : '';
    if (!capsule || !inputUrl.startsWith('/api/accounts/')) {
      return fetch(input, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    headers.set('x-ck-authz-capsule', capsule);
    return fetch(input, {
      ...init,
      headers,
    });
  }, []);

  const shouldDelegateAccountCommand = useCallback((subject: SubjectMode): boolean => {
    return subject === 'account' && bootModeRef.current === 'message' && surfaceRef.current === 'roma';
  }, []);

  const dispatchRomaAccountCommand = useCallback(
    (args: {
      command: BobAccountCommand;
      accountId: string;
      publicId: string;
      locale?: string;
      body?: unknown;
    }): Promise<{ ok: boolean; status: number; payload: any; message?: string }> => {
      const targetOrigin = hostOriginRef.current;
      const sessionId = sessionIdRef.current.trim();
      if (!targetOrigin || !sessionId) {
        return Promise.reject(new Error('coreui.errors.builder.command.hostUnavailable'));
      }

      const requestId = crypto.randomUUID();
      const message: BobAccountCommandMessage = {
        type: 'bob:account-command',
        requestId,
        sessionId,
        command: args.command,
        accountId: String(args.accountId || '').trim(),
        publicId: String(args.publicId || '').trim(),
        ...(args.locale ? { locale: String(args.locale || '').trim() } : {}),
        ...(typeof args.body === 'undefined' ? {} : { body: args.body }),
      };

      return new Promise((resolve, reject) => {
        let timeoutTimer: number | null = null;

        const cleanup = () => {
          if (timeoutTimer != null) window.clearTimeout(timeoutTimer);
          window.removeEventListener('message', onMessage);
        };

        const onMessage = (event: MessageEvent) => {
          if (event.origin !== targetOrigin) return;
          if (event.source !== window.parent) return;
          const data = event.data as RomaAccountCommandResultMessage | null;
          if (!data || typeof data !== 'object' || data.type !== 'roma:account-command-result') return;
          if (data.requestId !== requestId || data.sessionId !== sessionId) return;
          cleanup();
          resolve({
            ok: data.ok === true,
            status: typeof data.status === 'number' ? data.status : 500,
            payload: data.payload ?? null,
            message: typeof data.message === 'string' ? data.message : undefined,
          });
        };

        window.addEventListener('message', onMessage);
        timeoutTimer = window.setTimeout(() => {
          cleanup();
          reject(new Error('coreui.errors.builder.command.timeout'));
        }, 15_000);

        try {
          window.parent?.postMessage(message, targetOrigin);
        } catch (error) {
          cleanup();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    [],
  );

  const executeAccountCommand = useCallback(
    async (args: {
      subject: SubjectMode;
      command: BobAccountCommand;
      url: string;
      method: 'PUT' | 'POST' | 'DELETE';
      accountId: string;
      publicId: string;
      locale?: string;
      body?: unknown;
    }): Promise<{ ok: boolean; status: number; json: any }> => {
      if (shouldDelegateAccountCommand(args.subject)) {
        const result = await dispatchRomaAccountCommand({
          command: args.command,
          accountId: args.accountId,
          publicId: args.publicId,
          ...(args.locale ? { locale: args.locale } : {}),
          ...(typeof args.body === 'undefined' ? {} : { body: args.body }),
        });
        return { ok: result.ok, status: result.status, json: result.payload };
      }

      const init: RequestInit = { method: args.method };
      if (typeof args.body !== 'undefined') {
        init.headers = { 'content-type': 'application/json' };
        init.body = JSON.stringify(args.body);
      }
      const response = await fetchApi(args.url, init);
      const json = (await response.json().catch(() => null)) as any;
      return { ok: response.ok, status: response.status, json };
    },
    [dispatchRomaAccountCommand, fetchApi, shouldDelegateAccountCommand],
  );

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

      // Policy gating (interaction-time, fail-closed).
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

  const fetchLocalizationSnapshot = useCallback(
    async (args: {
      publicId: string;
      accountId: string;
      subject: 'minibob' | 'account';
    }): Promise<
      | { ok: true; snapshot: ReturnType<typeof normalizeLocalizationSnapshotForOpen> }
      | { ok: false; message: string }
    > => {
      try {
        const localizationUrl =
          args.subject === 'minibob'
            ? `/api/instance/${encodeURIComponent(args.publicId)}?subject=${encodeURIComponent(args.subject)}`
            : `/api/accounts/${encodeURIComponent(args.accountId)}/instances/${encodeURIComponent(
                args.publicId,
              )}/localization?subject=${encodeURIComponent(args.subject)}`;
        const res = await fetchApi(localizationUrl, { cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          const message =
            json?.error?.message ||
            json?.error?.reasonKey ||
            json?.error?.code ||
            `Failed to load localization snapshot (HTTP ${res.status})`;
          return { ok: false, message };
        }
        if (!json || typeof json !== 'object') {
          return { ok: false, message: 'Failed to load localization snapshot' };
        }
        return {
          ok: true,
          snapshot: normalizeLocalizationSnapshotForOpen(json.localization),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, message };
      }
    },
    [fetchApi],
  );

  const setLocalePreview = useCallback(async (rawLocale: string) => {
    const normalized = normalizeLocaleToken(rawLocale) ?? DEFAULT_LOCALE;
    const snapshot = stateRef.current;
    const widgetType = snapshot.compiled?.widgetname ?? snapshot.meta?.widgetname;
    const baseLocale = snapshot.locale.baseLocale;
    const subject = resolvePolicySubject(snapshot.policy);
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
      let localizationSnapshot = {
        baseLocale: snapshot.locale.baseLocale,
        availableLocales: snapshot.locale.availableLocales,
        overlayEntries: snapshot.locale.overlayEntries,
        accountLocalesInvalid: snapshot.locale.accountLocalesInvalid,
        accountL10nPolicy: snapshot.locale.accountL10nPolicy,
      };

      if (
        subject === 'account' &&
        snapshot.meta?.publicId &&
        snapshot.meta?.accountId &&
        (!snapshot.locale.overlayEntries.length ||
          !resolveLocaleOverlayEntry(snapshot.locale.overlayEntries, normalized))
      ) {
        const fetched = await fetchLocalizationSnapshot({
          publicId: String(snapshot.meta.publicId),
          accountId: String(snapshot.meta.accountId),
          subject,
        });
        if (localeRequestRef.current !== requestId) return;
        if (fetched.ok) {
          localizationSnapshot = fetched.snapshot;
        }
      }

      const overlayEntry = resolveLocaleOverlayEntry(localizationSnapshot.overlayEntries, normalized);
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
          availableLocales: localizationSnapshot.availableLocales,
          overlayEntries: localizationSnapshot.overlayEntries,
          accountLocalesInvalid: localizationSnapshot.accountLocalesInvalid,
          accountL10nPolicy: localizationSnapshot.accountL10nPolicy,
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
  }, [fetchLocalizationSnapshot, loadLocaleAllowlist]);

  const persistLocaleEdits = useCallback(async () => {
    const snapshot = stateRef.current;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const accountId = snapshot.meta?.accountId ? String(snapshot.meta.accountId) : '';
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
    if (!publicId || !widgetType || !accountId || subject !== 'account') {
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

    setState((prev) => ({ ...prev, isSaving: true, locale: { ...prev.locale, error: null } }));
    try {
      const allowlist = snapshot.locale.allowlist.length
        ? snapshot.locale.allowlist
        : await loadLocaleAllowlist(widgetType);
      const baseFingerprint = await computeL10nFingerprint(snapshot.baseInstanceData, allowlist);
      const userOps = snapshot.locale.userOps;
      const shouldDeleteUserLayer = snapshot.locale.dirty && userOps.length === 0;
      const { ok, json } = shouldDeleteUserLayer
        ? await executeAccountCommand({
            subject,
            command: 'delete-user-locale-layer',
            method: 'DELETE',
            url: `/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(
              publicId,
            )}/layers/user/${encodeURIComponent(locale)}?subject=${encodeURIComponent(subject)}`,
            accountId,
            publicId,
            locale,
          })
        : await executeAccountCommand({
            subject,
            command: 'put-user-locale-layer',
            method: 'PUT',
            url: `/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(
              publicId,
            )}/layers/user/${encodeURIComponent(locale)}?subject=${encodeURIComponent(subject)}`,
            accountId,
            publicId,
            locale,
            body: {
              ops: userOps,
              baseFingerprint,
              source: 'user',
              widgetType,
            },
          });
      if (!ok) {
        const errorCode = json?.error?.code || json?.error?.reasonKey;
        let message = json?.error?.message || errorCode || 'Failed to save localized changes';
        if (errorCode === 'FINGERPRINT_MISMATCH') {
          message = 'Base content changed. Switch to Base, click "Save", let translations update, then try saving overrides again.';
        }
        setState((prev) => ({
          ...prev,
          isSaving: false,
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
        isSaving: false,
        locale: {
          ...prev.locale,
          overlayEntries: upsertLocaleOverlayEntry(prev.locale.overlayEntries, locale, (current) => ({
            locale,
            source: current?.source ?? 'user',
            baseFingerprint: persistedBaseFingerprint,
            baseUpdatedAt: persistedBaseUpdatedAt ?? current?.baseUpdatedAt ?? null,
            baseOps: current?.baseOps ?? [],
            userOps: shouldDeleteUserLayer ? [] : userOps,
            hasUserOps: shouldDeleteUserLayer ? false : userOps.length > 0,
          })),
          availableLocales: prev.locale.availableLocales,
          userOps: shouldDeleteUserLayer ? [] : userOps,
          dirty: false,
          stale: false,
          error: null,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        isSaving: false,
        locale: { ...prev.locale, error: message },
      }));
    }
  }, [executeAccountCommand, loadLocaleAllowlist]);

  const rehydrateLocalizationSnapshot = useCallback(
    async (args: {
      publicId: string;
      accountId: string;
      subject: 'minibob' | 'account';
    }): Promise<{ ok: true } | { ok: false; message: string }> => {
      try {
        const localizationResult = await fetchLocalizationSnapshot(args);
        if (!localizationResult.ok) {
          setState((prev) => ({
            ...prev,
            locale: { ...prev.locale, loading: false, error: localizationResult.message },
          }));
          return localizationResult;
        }

        const localizationSnapshot = localizationResult.snapshot;
        const current = stateRef.current;
        const widgetType = current.compiled?.widgetname ?? current.meta?.widgetname;
        const baseLocale = localizationSnapshot.baseLocale;
        const previousActiveLocale = normalizeLocaleToken(current.locale.activeLocale) ?? baseLocale;
        const activeLocale = localizationSnapshot.availableLocales.includes(previousActiveLocale)
          ? previousActiveLocale
          : baseLocale;
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
            nextUserOps,
          );
        }

        setState((prev) => ({
          ...prev,
          instanceData: nextInstanceData,
          locale: {
            ...prev.locale,
            baseLocale,
            availableLocales: localizationSnapshot.availableLocales,
            overlayEntries: localizationSnapshot.overlayEntries,
            accountLocalesInvalid: localizationSnapshot.accountLocalesInvalid,
            accountL10nPolicy: localizationSnapshot.accountL10nPolicy,
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
    },
    [fetchLocalizationSnapshot, loadLocaleAllowlist],
  );

  const reloadLocalizationSnapshot = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    const snapshot = stateRef.current;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const accountId = snapshot.meta?.accountId ? String(snapshot.meta.accountId) : '';
    const subject = resolvePolicySubject(snapshot.policy);

    if (!publicId || (subject !== 'minibob' && !accountId)) {
      const message = 'Missing instance context';
      return { ok: false as const, message };
    }

    setState((prev) => ({
      ...prev,
      locale: { ...prev.locale, loading: true, error: null },
    }));

    return rehydrateLocalizationSnapshot({ publicId, accountId, subject });
  }, [rehydrateLocalizationSnapshot]);

  const monitorLocaleTranslationsAfterSave = useCallback(async (initialDetail?: string | null) => {
    const readL10nStatus = async (args: {
      publicId: string;
      accountId: string;
      subject: 'account';
    }): Promise<
      | { stage: 'ready'; detail: string | null }
      | { stage: 'translating'; detail: string | null }
      | { stage: 'failed'; detail: string }
    > => {
      try {
        const res = await fetchApi(
          `/api/accounts/${encodeURIComponent(args.accountId)}/instances/${encodeURIComponent(
            args.publicId
          )}/l10n/status?subject=${encodeURIComponent(args.subject)}&_t=${Date.now()}`,
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

        const locales = Array.isArray(json?.locales) ? json.locales : [];
        const failedLocale = locales.find(
          (entry: any) => entry?.status === 'failed' && typeof entry?.lastError === 'string' && entry.lastError.trim()
        );
        if (failedLocale) {
          return { stage: 'failed', detail: String(failedLocale.lastError || '').trim() || 'Translation failed.' };
        }
        const failedCount = locales.filter((entry: any) => entry?.status === 'failed').length;
        if (failedCount > 0) return { stage: 'failed', detail: 'Translation failed for one or more locales.' };

        const pendingLocales = locales.filter((entry: any) => entry?.status && entry.status !== 'succeeded');
        if (pendingLocales.length > 0) {
          const byStatus = pendingLocales.reduce((acc: Record<string, number>, entry: any) => {
            const status = typeof entry?.status === 'string' ? entry.status : 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});
          const running = byStatus.running || 0;
          const queued = byStatus.queued || 0;
          const dirty = byStatus.dirty || 0;
          const superseded = byStatus.superseded || 0;
          const detail =
            running > 0
              ? `${running} locale${running === 1 ? '' : 's'} translating.`
              : queued > 0
                ? `${queued} locale${queued === 1 ? '' : 's'} queued for translation.`
                : superseded > 0
                  ? `${superseded} locale${superseded === 1 ? '' : 's'} out of date.`
                  : dirty > 0
                    ? `${dirty} locale${dirty === 1 ? '' : 's'} pending translation.`
                    : 'Translations are updating.';
          return { stage: 'translating', detail };
        }

        return { stage: 'ready', detail: null };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return { stage: 'failed', detail };
      }
    };

    const pollUntilSynced = async (args: {
      runId: number;
      publicId: string;
      accountId: string;
      subject: 'account';
    }) => {
      const startedAt = Date.now();
      const pollIntervalMs = 1500;
      const timeoutMs = 45_000;

      while (args.runId === localeSyncRunRef.current) {
        const status = await readL10nStatus({
          publicId: args.publicId,
          accountId: args.accountId,
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
            accountId: args.accountId,
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
    const accountId = snapshot.meta?.accountId ? String(snapshot.meta.accountId) : '';
    const subject = resolvePolicySubject(snapshot.policy);

    if (!publicId || !accountId || subject !== 'account') {
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

    const runId = ++localeSyncRunRef.current;
    setState((prev) => ({
      ...prev,
      locale: {
        ...prev.locale,
        loading: true,
        error: null,
        sync: {
          stage: 'translating',
          detail: initialDetail?.trim() || 'Checking translation status...',
          lastUpdatedAt: prev.locale.sync.lastUpdatedAt,
          lastError: null,
        },
      },
    }));

    void pollUntilSynced({ runId, publicId, accountId, subject });
    return { ok: true as const };
  }, [fetchApi, rehydrateLocalizationSnapshot]);

  const save = useCallback(async () => {
    const snapshot = stateRef.current;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const accountId = snapshot.meta?.accountId ? String(snapshot.meta.accountId) : '';
    const widgetType = snapshot.compiled?.widgetname ?? snapshot.meta?.widgetname;
    const subject = resolvePolicySubject(snapshot.policy);

    if (!publicId || !accountId) {
      setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Missing instance context for save.' },
      }));
      return;
    }
    if (!widgetType) {
      setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'coreui.errors.widgetType.invalid' },
      }));
      return;
    }
    if (snapshot.policy.role === 'viewer') {
      setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Read-only mode: saving is disabled.' },
      }));
      return;
    }

    const gate = can(snapshot.policy, 'instance.update');
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

    if (!snapshot.isDirty && snapshot.locale.activeLocale !== snapshot.locale.baseLocale && snapshot.locale.dirty) {
      await persistLocaleEdits();
      return;
    }

    setState((prev) => ({ ...prev, isSaving: true, error: null }));

    let textChanged = false;
    if (
      subject === 'account' &&
      snapshot.locale.availableLocales.some((locale) => locale !== snapshot.locale.baseLocale)
    ) {
      try {
        const allowlist = snapshot.locale.allowlist.length
          ? snapshot.locale.allowlist
          : await loadLocaleAllowlist(widgetType);
        const [savedFingerprint, nextFingerprint] = await Promise.all([
          computeL10nFingerprint(snapshot.savedBaseInstanceData, allowlist),
          computeL10nFingerprint(snapshot.baseInstanceData, allowlist),
        ]);
        textChanged = savedFingerprint !== nextFingerprint;
      } catch {
        textChanged = false;
      }
    }

    try {
      const configToSave = snapshot.baseInstanceData;
      const { ok, json } = await executeAccountCommand({
        subject,
        command: 'update-instance',
        method: 'PUT',
        url: `/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(
          publicId
        )}?subject=${encodeURIComponent(subject)}`,
        accountId,
        publicId,
        body: { config: configToSave },
      });
      if (!ok) {
        const err = json?.error;
        if (err?.kind === 'DENY' && err?.upsell === 'UP') {
          setState((prev) => ({
            ...prev,
            isSaving: false,
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
            isSaving: false,
            error: { source: 'save', message: err.reasonKey || 'Save failed.', paths: err.paths },
          }));
          return;
        }
        setState((prev) => ({
          ...prev,
          isSaving: false,
          error: { source: 'save', message: err?.reasonKey || 'Save failed.' },
        }));
        return;
      }

      const current = stateRef.current;
      const nextBase =
        json?.config && typeof json.config === 'object' && !Array.isArray(json.config)
          ? structuredClone(json.config)
          : structuredClone(current.baseInstanceData);
      const aftermathMessage = resolveAftermathSaveMessage(json?.aftermath);
      const nextLocale =
        aftermathMessage && subject === 'account' && textChanged
          ? {
              ...current.locale,
              sync: {
                stage: 'failed' as const,
                detail: aftermathMessage,
                lastUpdatedAt: current.locale.sync.lastUpdatedAt,
                lastError: aftermathMessage,
              },
            }
          : current.locale;
      const nextState: SessionState = {
        ...current,
        isSaving: false,
        isDirty: false,
        error: aftermathMessage ? { source: 'save', message: aftermathMessage, committed: true } : null,
        upsell: null,
        savedBaseInstanceData: structuredClone(nextBase),
        baseInstanceData: structuredClone(nextBase),
        locale: nextLocale,
        instanceData:
          current.locale.activeLocale !== current.locale.baseLocale
            ? applyLocalizationOps(applyLocalizationOps(nextBase, current.locale.baseOps), current.locale.userOps)
            : nextBase,
      };
      stateRef.current = nextState;
      setState(nextState);

      if (!aftermathMessage && subject === 'account' && textChanged && !current.locale.dirty) {
        window.setTimeout(() => {
          void monitorLocaleTranslationsAfterSave('Translations are updating.');
        }, 0);
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, isSaving: false, error: { source: 'save', message: messageText } }));
    }
  }, [executeAccountCommand, loadLocaleAllowlist, monitorLocaleTranslationsAfterSave, persistLocaleEdits]);

  const clearLocaleManualOverrides = useCallback(async () => {
    const snapshot = stateRef.current;
    const widgetType = snapshot.compiled?.widgetname ?? snapshot.meta?.widgetname;
    const locale = snapshot.locale.activeLocale;
    if (snapshot.policy.role === 'viewer') {
      setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Read-only mode: localization edits are disabled.' },
      }));
      return;
    }
    if (!widgetType) {
      setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Missing widget context' },
      }));
      return;
    }
    if (locale === snapshot.locale.baseLocale) return;
    if (snapshot.locale.userOps.length === 0) return;

    try {
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
          baseOps,
          userOps: [],
          allowlist,
          source: overlayEntry?.source ?? null,
          dirty: true,
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
      const nextAccountId = message.accountId;
      const nextOwnerAccountId = message.ownerAccountId;
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

      if (incoming == null && message.publicId && message.accountId) {
        throw new Error('[useWidgetSession] Missing instanceData in open-editor payload');
      }
      resolved = incoming == null ? structuredClone(defaults) : structuredClone(incoming);
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
        savedBaseInstanceData: structuredClone(resolved),
        isDirty: false,
        minibobPersonalizationUsed: false,
        policy: nextPolicy,
        selectedPath: null,
        error: null,
        upsell: null,
        locale: {
          ...DEFAULT_LOCALE_STATE,
          baseLocale: localizationSnapshot.baseLocale,
          activeLocale: localizationSnapshot.baseLocale,
          availableLocales: localizationSnapshot.availableLocales,
          overlayEntries: localizationSnapshot.overlayEntries,
          accountLocalesInvalid: localizationSnapshot.accountLocalesInvalid,
          accountL10nPolicy: localizationSnapshot.accountL10nPolicy,
        },
        lastUpdate: {
          source: 'load',
          path: '',
          ts: Date.now(),
        },
        undoSnapshot: null,
        meta: {
          publicId: message.publicId,
          accountId: nextAccountId,
          ownerAccountId: nextOwnerAccountId,
          accountCapsule:
            typeof message.accountCapsule === 'string' && message.accountCapsule.trim()
              ? message.accountCapsule.trim()
              : undefined,
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
        savedBaseInstanceData: {},
        isDirty: false,
        minibobPersonalizationUsed: false,
        error: { source: 'load', message: messageText },
        upsell: null,
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

  const discardChanges = useCallback(() => {
    setState((prev) => {
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
  }, []);

  const loadFromUrlParams = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const accountId = (params.get('accountId') || '').trim();
    const publicId = (params.get('publicId') || '').trim();
    if (!publicId) return;

    const subject = resolveSubjectModeFromUrl();
    if (!accountId && subject !== 'minibob') return;

    const instanceUrl =
      subject === 'minibob'
        ? `/api/instance/${encodeURIComponent(publicId)}?subject=${encodeURIComponent(subject)}`
        : `/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(publicId)}?subject=${encodeURIComponent(subject)}`;
    const bootstrapRes = subject === 'account' ? await fetchApi('/api/session/bootstrap', { cache: 'no-store' }) : null;
    let accountCapsule: string | null = null;
    let nextPolicy: Policy | undefined;
    if (subject === 'account') {
      if (!bootstrapRes) {
        throw new Error('coreui.errors.auth.required');
      }
      const bootstrapJson = (await bootstrapRes.json().catch(() => null)) as unknown;
      if (!bootstrapRes.ok) {
        throw new Error(extractErrorReasonKey(bootstrapJson, `HTTP_${bootstrapRes.status}`));
      }
      nextPolicy = resolveAccountPolicyFromBootstrapPayload(bootstrapJson, accountId);
      accountCapsule = resolveAccountCapsuleFromBootstrapPayload(bootstrapJson, accountId);
      if (!accountCapsule) {
        throw new Error('coreui.errors.auth.forbidden');
      }
    }

    const instanceRes = await fetchApi(instanceUrl, {
      cache: 'no-store',
      ...(accountCapsule ? { headers: { 'x-ck-authz-capsule': accountCapsule } } : {}),
    });
    const instanceJson = (await instanceRes.json().catch(() => null)) as any;
    if (!instanceRes.ok) {
      throw new Error(extractErrorReasonKey(instanceJson, `HTTP_${instanceRes.status}`));
    }
    if (!instanceJson || typeof instanceJson !== 'object') {
      throw new Error('coreui.errors.payload.invalid');
    }
    if (instanceJson.error) {
      const reasonKey = instanceJson.error?.reasonKey ? String(instanceJson.error.reasonKey) : 'coreui.errors.unknown';
      throw new Error(reasonKey);
    }
    const widgetType = typeof instanceJson.widgetType === 'string' ? instanceJson.widgetType : '';
    if (!widgetType) {
      throw new Error('coreui.errors.instance.widgetMissing');
    }
    let localizationPayload: unknown = instanceJson.localization;
    if (subject === 'account') {
      const localizationUrl = `/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(publicId)}/localization?subject=${encodeURIComponent(subject)}`;
      const localizationRes = await fetchApi(localizationUrl, {
        cache: 'no-store',
        ...(accountCapsule ? { headers: { 'x-ck-authz-capsule': accountCapsule } } : {}),
      });
      const localizationJson = (await localizationRes.json().catch(() => null)) as any;
      if (!localizationRes.ok) {
        throw new Error(extractErrorReasonKey(localizationJson, `HTTP_${localizationRes.status}`));
      }
      if (!localizationJson || typeof localizationJson !== 'object') {
        throw new Error('coreui.errors.payload.invalid');
      }
      if (localizationJson.error) {
        const reasonKey = localizationJson.error?.reasonKey
          ? String(localizationJson.error.reasonKey)
          : 'coreui.errors.unknown';
        throw new Error(reasonKey);
      }
      localizationPayload = localizationJson.localization;
    }
    const displayName =
      typeof instanceJson.displayName === 'string' && instanceJson.displayName.trim()
        ? instanceJson.displayName.trim()
        : String(instanceJson.publicId ?? publicId).trim() || 'Untitled widget';

    const compiledRes = await fetchApi(`/api/widgets/${encodeURIComponent(widgetType)}/compiled`, { cache: 'no-store' });
    if (!compiledRes.ok) {
      throw new Error(`[useWidgetSession] Failed to compile widget ${widgetType} (HTTP ${compiledRes.status})`);
    }
    const compiled = (await compiledRes.json().catch(() => null)) as CompiledWidget | null;
    if (!compiled) throw new Error('[useWidgetSession] Invalid compiled widget payload');

    if (subject !== 'account') {
      nextPolicy = instanceJson.policy;
    }

    await loadInstance({
      type: 'ck:open-editor',
      widgetname: widgetType,
      compiled,
      instanceData: instanceJson.config,
      localization: localizationPayload,
      policy: nextPolicy,
      publicId: instanceJson.publicId ?? publicId,
      accountId,
      accountCapsule: accountCapsule ?? undefined,
      ownerAccountId:
        typeof instanceJson.ownerAccountId === 'string' ? instanceJson.ownerAccountId : undefined,
      label: displayName,
      subjectMode: subject,
    });
  }, [fetchApi, loadInstance]);

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
    bootModeRef.current = bootMode;
    surfaceRef.current = resolveSurfaceFromUrl();
    const postToParent = (
      payload:
        | BobSessionReadyMessage
        | BobOpenEditorAckMessage
        | BobOpenEditorAppliedMessage
        | BobOpenEditorFailedMessage
        | BobExportInstanceDataResponseMessage,
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
        hostOriginRef.current = targetOrigin === '*' ? hostOriginRef.current : targetOrigin;
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

        const rawSubjectMode =
          typeof (data as { subjectMode?: unknown }).subjectMode === 'string'
            ? String((data as { subjectMode?: unknown }).subjectMode).trim().toLowerCase()
            : '';
        if (rawSubjectMode && rawSubjectMode !== 'account' && rawSubjectMode !== 'minibob') {
          const reasonKey = 'coreui.errors.builder.open.invalidRequest';
          openRequestStatusRef.current.set(requestId, {
            status: 'failed',
            error: reasonKey,
          });
          postToParent(
            {
              type: 'bob:open-editor-failed',
              requestId,
              sessionId,
              reasonKey,
              message: 'Invalid subjectMode in open-editor payload',
            },
            targetOrigin,
          );
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
          savedBaseInstanceData: {},
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
      hasUnsavedChanges: state.isDirty || state.locale.dirty,
      minibobPersonalizationUsed: state.minibobPersonalizationUsed,
      isMinibob: state.policy.profile === 'minibob',
      policy: state.policy,
      upsell: state.upsell,
      isSaving: state.isSaving,
      preview: state.preview,
      locale: state.locale,
      selectedPath: state.selectedPath,
      lastUpdate: state.lastUpdate,
      error: state.error,
      meta: state.meta,
      apiFetch: fetchApi,
      canUndo: Boolean(state.undoSnapshot) && state.locale.activeLocale === state.locale.baseLocale,
      copilotThreads: state.copilotThreads,
      applyOps,
      setPreviewOps,
      clearPreviewOps,
      undoLastOps,
      commitLastOps,
      save,
      discardChanges,
      dismissUpsell,
      requestUpsell,
      setSelectedPath,
      setInstanceLabel,
      setPreview,
      setLocalePreview,
      clearLocaleManualOverrides,
      reloadLocalizationSnapshot,
      loadInstance,
      consumeBudget,
      setCopilotThread,
      updateCopilotThread,
    }),
    [
      state,
      fetchApi,
      applyOps,
      setPreviewOps,
      clearPreviewOps,
      undoLastOps,
      commitLastOps,
      save,
      discardChanges,
      dismissUpsell,
      requestUpsell,
      loadInstance,
      setPreview,
      setLocalePreview,
      clearLocaleManualOverrides,
      reloadLocalizationSnapshot,
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
