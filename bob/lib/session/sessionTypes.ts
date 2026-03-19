import type { CompiledWidget } from '../types';
import type { WidgetOp, WidgetOpError } from '../ops';
import type { CopilotThread } from '../copilot/types';
import type { Policy } from '@clickeen/ck-policy';
import { stableStringify } from '@clickeen/l10n';

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

export type SubjectMode = 'minibob' | 'account';
export type BootMode = 'message' | 'url';

export type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  savedBaseInstanceData: Record<string, unknown>;
  policy: Policy | null;
  upsell: { reasonKey: string; detail?: string; cta: 'signup' | 'upgrade' } | null;
  isSaving: boolean;
  preview: PreviewSettings;
  selectedPath: string | null;
  lastUpdate: UpdateMeta | null;
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
  widgetname: string;
  compiled: CompiledWidget;
  instanceData?: Record<string, unknown> | null;
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
  bootMode: BootMode;
};

export type BobOpenEditorAppliedMessage = {
  type: 'bob:open-editor-applied';
  requestId: string;
  publicId?: string;
  widgetname?: string;
};

export type BobOpenEditorFailedMessage = {
  type: 'bob:open-editor-failed';
  requestId?: string;
  reasonKey: string;
  message?: string;
};

export type BobAccountCommand =
  | 'list-assets'
  | 'resolve-assets'
  | 'upload-asset'
  | 'update-instance'
  | 'run-copilot'
  | 'attach-ai-outcome';

export type BobAccountCommandMessage = {
  type: 'bob:account-command';
  requestId: string;
  command: BobAccountCommand;
  publicId: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type HostAccountCommandResultMessage = {
  type: 'host:account-command-result';
  requestId: string;
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

export function createInitialSessionState(policy: Policy | null = null): SessionState {
  return {
    compiled: null,
    instanceData: {},
    savedBaseInstanceData: {},
    policy,
    upsell: null,
    isSaving: false,
    preview: structuredClone(DEFAULT_PREVIEW),
    selectedPath: null,
    lastUpdate: null,
    error: null,
    copilotThreads: {},
    meta: null,
  };
}

export function hasUnsavedDocument(state: Pick<SessionState, 'instanceData' | 'savedBaseInstanceData'>): boolean {
  if (state.instanceData === state.savedBaseInstanceData) return false;
  return stableStringify(state.instanceData) !== stableStringify(state.savedBaseInstanceData);
}
