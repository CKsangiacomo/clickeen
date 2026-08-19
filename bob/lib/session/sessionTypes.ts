import type { CompiledWidget } from '../types';
import type { WidgetOpError } from '../ops';
import type { AgentRuntimePolicyUi, Policy } from '@clickeen/ck-policy';
import type { AccountAssetHostCommand } from '@clickeen/ck-contracts';
import type { TranslationSetup } from '../translations-preview';
import type { AccountFontLibrary } from '@clickeen/widget-foundation';

export type UpdateMeta = {
  source: 'field' | 'load' | 'external' | 'ops' | 'unknown';
  path: string;
  paths: string[];
  ts: number;
};

export type SessionError =
  | { source: 'load'; message: string }
  | { source: 'ops'; errors: WidgetOpError[] }
  | { source: 'translation'; message: string; detail?: string }
  | { source: 'save'; message: string; detail?: string; paths?: string[] };

export type PreviewSettings = {
  device: 'desktop' | 'mobile';
  host: 'canvas' | 'column' | 'banner' | 'floating';
};

export type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  savedInstanceDataSignature: string | null;
  isDirty: boolean;
  isSaving: boolean;
  lastUpdate: UpdateMeta | null;
  error: SessionError | null;
};

export type SessionMeta = {
  accountPublicId: string;
  instanceId: string | null;
  baseLocale: string;
  widgetname: string;
  label: string;
  fontLibrary: AccountFontLibrary;
  translationSetup: TranslationSetup;
} | null;

export type CopilotRuntimeUi = AgentRuntimePolicyUi | null;

export type EditorOpenMessage = {
  type: 'ck:open-editor';
  requestId: string;
  widgetname: string;
  baseLocale: string;
  compiled: CompiledWidget;
  instanceData: Record<string, unknown>;
  fontLibrary: AccountFontLibrary;
  policy: Policy;
  accountPublicId: string;
  instanceId: string | null;
  label: string;
  copilot: CopilotRuntimeUi;
  translationSetup: TranslationSetup;
};

export type BobSessionReadyMessage = {
  type: 'bob:session-ready';
};

export type BobDirtyStateChangedMessage = {
  type: 'bob:dirty-state-changed';
  isDirty: boolean;
};

export type BobHostActionMessage = {
  type: 'bob:host-action';
  action: 'open-navigation';
};

export type BobWidgetUpsellMessage = {
  type: 'bob:upsell';
  capability: string;
  messageId: string;
  required: boolean | number;
};

export type BobSystemUpsellMessage = {
  type: 'bob:upsell';
  reasonKey: string;
  detail?: string;
};

export type BobOpenEditorAppliedMessage = {
  type: 'bob:open-editor-applied';
  requestId: string;
  instanceId?: string;
  widgetname?: string;
};

export type BobOpenEditorFailedMessage = {
  type: 'bob:open-editor-failed';
  requestId: string;
  reasonKey: string;
  message?: string;
};

export type BobAccountCommand =
  | 'save-instance'
  | AccountAssetHostCommand
  | 'list-translations'
  | 'read-translation'
  | 'generate-translations'
  | 'run-copilot'
  | 'cancel-copilot';

export type BobAccountCommandMessage = {
  type: 'bob:account-command';
  requestId: string;
  command: BobAccountCommand;
  instanceId?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type AgentActivityEvent = {
  message: string;
};

export type HostAgentActivityMessage = {
  type: 'host:agent-activity';
  requestId: string;
  command: BobAccountCommand;
  instanceId?: string;
  event: AgentActivityEvent;
};

export type HostAccountCommandResultMessage = {
  type: 'host:account-command-result';
  requestId: string;
  command: BobAccountCommand;
  instanceId?: string;
  ok: boolean;
  status: number;
  payload?: unknown;
  message?: string;
};

export const DEFAULT_PREVIEW: PreviewSettings = {
  device: 'desktop',
  host: 'canvas',
};

export function serializeInstanceDataSignature(value: Record<string, unknown>): string {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') throw new Error('coreui.errors.instance.config.unserializable');
  return serialized;
}

export function createInitialSessionState(): SessionState {
  return {
    compiled: null,
    instanceData: {},
    savedInstanceDataSignature: null,
    isDirty: false,
    isSaving: false,
    lastUpdate: null,
    error: null,
  };
}
