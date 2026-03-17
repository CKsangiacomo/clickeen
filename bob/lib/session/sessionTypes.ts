import type { CompiledWidget } from '../types';
import type { WidgetOp, WidgetOpError } from '../ops';
import type { CopilotThread } from '../copilot/types';
import type { Policy } from '@clickeen/ck-policy';
import type { AllowlistEntry, LocalizationOp } from '../l10n/instance';

export type UpdateMeta = {
  source: 'field' | 'load' | 'external' | 'ops' | 'unknown';
  path: string;
  ts: number;
};

export type SessionError =
  | { source: 'load'; message: string }
  | { source: 'ops'; errors: WidgetOpError[] }
  | { source: 'save'; message: string; paths?: string[]; committed?: boolean };

export type PreviewSettings = {
  device: 'desktop' | 'mobile';
  theme: 'light' | 'dark';
  host: 'canvas' | 'column' | 'banner' | 'floating';
};

export type LocaleOverlayEntry = {
  locale: string;
  source: string | null;
  baseFingerprint: string | null;
  baseUpdatedAt: string | null;
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
  hasUserOps: boolean;
};

export type LocaleSyncStage = 'idle' | 'queuing' | 'translating' | 'ready' | 'failed';

export type LocaleState = {
  baseLocale: string;
  activeLocale: string;
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
  allowlist: AllowlistEntry[];
  allowedLocales: string[];
  readyLocales: string[];
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
      locales?: string[];
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

export type SubjectMode = 'minibob' | 'account';
export type BootMode = 'message' | 'url';

export type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  baseInstanceData: Record<string, unknown>;
  savedBaseInstanceData: Record<string, unknown>;
  previewData: Record<string, unknown> | null;
  previewOps: WidgetOp[] | null;
  isDirty: boolean;
  minibobPersonalizationUsed: boolean;
  policy: Policy | null;
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
    assetApiBase?: string;
    assetUploadEndpoint?: string;
    widgetname?: string;
    label?: string;
  } | null;
};

export type EditorOpenMessage = {
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
  assetApiBase?: string;
  assetUploadEndpoint?: string;
  label?: string;
  subjectMode?: SubjectMode;
};

export type HostExportInstanceDataMessage = {
  type: 'host:export-instance-data';
  requestId: string;
  exportMode?: 'current' | 'base';
};

export type BobExportInstanceDataResponseMessage = {
  type: 'bob:export-instance-data';
  requestId: string;
  ok: boolean;
  error?: string;
  instanceData?: Record<string, unknown>;
  meta?: SessionState['meta'];
  isDirty?: boolean;
};

export type BobSessionReadyMessage = {
  type: 'bob:session-ready';
  sessionId: string;
  bootMode: BootMode;
};

export type BobOpenEditorAckMessage = {
  type: 'bob:open-editor-ack';
  requestId: string;
  sessionId: string;
};

export type BobOpenEditorAppliedMessage = {
  type: 'bob:open-editor-applied';
  requestId: string;
  sessionId: string;
  publicId?: string;
  widgetname?: string;
};

export type BobOpenEditorFailedMessage = {
  type: 'bob:open-editor-failed';
  requestId?: string;
  sessionId?: string;
  reasonKey: string;
  message?: string;
};

export type BobAccountCommand =
  | 'get-localization-snapshot'
  | 'get-l10n-status'
  | 'list-assets'
  | 'resolve-assets'
  | 'upload-asset'
  | 'update-instance'
  | 'put-user-locale-layer'
  | 'delete-user-locale-layer'
  | 'run-copilot'
  | 'attach-ai-outcome';

export type BobAccountCommandMessage = {
  type: 'bob:account-command';
  requestId: string;
  sessionId: string;
  command: BobAccountCommand;
  publicId: string;
  locale?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type HostAccountCommandResultMessage = {
  type: 'host:account-command-result';
  requestId: string;
  sessionId: string;
  command: BobAccountCommand;
  publicId: string;
  ok: boolean;
  status: number;
  payload?: unknown;
  message?: string;
};

export const DEFAULT_PREVIEW: PreviewSettings = {
  device: 'desktop',
  theme: 'light',
  host: 'canvas',
};

export const DEFAULT_LOCALE = 'en';

export const DEFAULT_LOCALE_STATE: LocaleState = {
  baseLocale: DEFAULT_LOCALE,
  activeLocale: DEFAULT_LOCALE,
  baseOps: [],
  userOps: [],
  allowlist: [],
  allowedLocales: [DEFAULT_LOCALE],
  readyLocales: [DEFAULT_LOCALE],
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

export function createInitialSessionState(policy: Policy | null = null): SessionState {
  return {
    compiled: null,
    instanceData: {},
    baseInstanceData: {},
    savedBaseInstanceData: {},
    previewData: null,
    previewOps: null,
    isDirty: false,
    minibobPersonalizationUsed: false,
    policy,
    upsell: null,
    isSaving: false,
    preview: structuredClone(DEFAULT_PREVIEW),
    locale: structuredClone(DEFAULT_LOCALE_STATE),
    selectedPath: null,
    lastUpdate: null,
    undoSnapshot: null,
    error: null,
    copilotThreads: {},
    meta: null,
  };
}
