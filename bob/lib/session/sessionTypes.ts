import type { CompiledWidget } from '../types';
import type { WidgetOp, WidgetOpError } from '../ops';
import type { Policy } from '@clickeen/ck-policy';
import type { AccountAssetHostCommand } from '@clickeen/ck-contracts';

export type UpdateMeta = {
  source: 'field' | 'load' | 'external' | 'ops' | 'unknown';
  path: string;
  ts: number;
};

export type SessionError =
  | { source: 'load'; message: string }
  | { source: 'ops'; errors: WidgetOpError[] }
  | { source: 'save'; message: string; paths?: string[] };

export type PreviewSettings = {
  device: 'desktop' | 'mobile';
  theme: 'light' | 'dark';
  host: 'canvas' | 'column' | 'banner' | 'floating';
};

export type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  isSaving: boolean;
  lastUpdate: UpdateMeta | null;
  error: SessionError | null;
};

export type SessionMeta = {
  publicId?: string;
  widgetname?: string;
  label?: string;
} | null;

export type SessionUpsell = {
  reasonKey: string;
  detail?: string;
  cta: 'signup' | 'upgrade';
} | null;

export type EditorOpenMessage = {
  type: 'ck:open-editor';
  requestId?: string;
  widgetname: string;
  compiled: CompiledWidget;
  instanceData?: Record<string, unknown> | null;
  policy?: Policy;
  publicId?: string;
  label?: string;
};

export type BobSessionReadyMessage = {
  type: 'bob:session-ready';
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
  | 'update-instance'
  | AccountAssetHostCommand
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
  void policy;
  return {
    compiled: null,
    instanceData: {},
    isSaving: false,
    lastUpdate: null,
    error: null,
  };
}
