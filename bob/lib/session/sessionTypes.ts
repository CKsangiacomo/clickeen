import type { CompiledWidget } from '../types';
import type { WidgetOpError } from '../ops';
import type { Policy } from '@clickeen/ck-policy';
import type { AccountAssetHostCommand } from '@clickeen/ck-contracts';
import type { TranslationSetup } from '../translations-preview';
import type { AccountFontLibrary } from '@clickeen/widget-shell';

export type UpdateMeta = {
  source: 'field' | 'load' | 'external' | 'ops' | 'unknown';
  path: string;
  ts: number;
};

export type SessionError =
  | { source: 'load'; message: string }
  | { source: 'ops'; errors: WidgetOpError[] }
  | { source: 'translation'; message: string; detail?: string }
  | { source: 'save'; message: string; detail?: string; paths?: string[] };

export type PreviewSettings = {
  device: 'desktop' | 'mobile';
  theme: 'light' | 'dark';
  host: 'canvas' | 'column' | 'banner' | 'floating';
};

export type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  savedInstanceDataSignature: string;
  isDirty: boolean;
  isSaving: boolean;
  lastUpdate: UpdateMeta | null;
  error: SessionError | null;
};

export type SessionMeta = {
  accountPublicId?: string;
  instanceId?: string;
  baseLocale?: string;
  widgetname?: string;
  publishStatus?: 'published' | 'unpublished';
  label?: string;
  fontLibrary: AccountFontLibrary;
  translationSetup?: TranslationSetup | null;
} | null;

export type SessionUpsell = {
  reasonKey: string;
  detail?: string;
  cta: 'upgrade';
} | null;

export type CopilotModelRef = {
  provider: string;
  model: string;
};

export type CopilotRuntimeUi = {
  allowModelPicker: boolean;
  defaultModel: CopilotModelRef;
  selectedModel?: CopilotModelRef;
  modelOptions: Array<CopilotModelRef & { label: string }>;
} | null;

export type EditorOpenMessage = {
  type: 'ck:open-editor';
  requestId?: string;
  widgetname: string;
  baseLocale: string;
  compiled: CompiledWidget;
  instanceData?: Record<string, unknown> | null;
  fontLibrary?: AccountFontLibrary | null;
  policy?: Policy;
  accountPublicId?: string;
  instanceId?: string;
  publishStatus?: 'published' | 'unpublished';
  label?: string;
  copilot?: CopilotRuntimeUi;
  translationSetup?: TranslationSetup | null;
};

export type BobSessionReadyMessage = {
  type: 'bob:session-ready';
};

export type BobDirtyStateChangedMessage = {
  type: 'bob:dirty-state-changed';
  isDirty: boolean;
};

export type BobOpenEditorAppliedMessage = {
  type: 'bob:open-editor-applied';
  requestId: string;
  instanceId?: string;
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
  | 'list-translations'
  | 'read-translation'
  | 'generate-translations'
  | 'run-copilot'
  | 'attach-ai-outcome';

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
  theme: 'light',
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
    savedInstanceDataSignature: serializeInstanceDataSignature({}),
    isDirty: false,
    isSaving: false,
    lastUpdate: null,
    error: null,
  };
}
