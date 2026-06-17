import type { CompiledWidget } from '../types';
import type { WidgetOpError } from '../ops';
import type { Policy } from '@clickeen/ck-policy';
import type { AccountAssetHostCommand } from '@clickeen/ck-contracts';
import type { TranslationSetup } from '../translations-preview';

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
  meta?: Record<string, unknown> | null;
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
  policy?: Policy;
  accountPublicId?: string;
  instanceId?: string;
  publishStatus?: 'published' | 'unpublished';
  label?: string;
  meta?: Record<string, unknown> | null;
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
  | 'save-translation'
  | 'generate-translations'
  | 'read-translation-generation'
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

const UNSERIALIZABLE_CONFIG_REASON = 'coreui.errors.instance.config.unserializable';

function invalidSerializableValue(path: string): never {
  throw new Error(path ? `${UNSERIALIZABLE_CONFIG_REASON}:${path}` : UNSERIALIZABLE_CONFIG_REASON);
}

function assertSerializableInstanceData(value: unknown, path = '$', seen = new Set<unknown>()): void {
  if (value == null) return;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'boolean') return;
  if (valueType === 'number') {
    if (!Number.isFinite(value)) invalidSerializableValue(path);
    return;
  }
  if (valueType === 'undefined' || valueType === 'function' || valueType === 'symbol' || valueType === 'bigint') {
    invalidSerializableValue(path);
  }

  if (valueType !== 'object') return;
  if (seen.has(value)) invalidSerializableValue(path);
  seen.add(value);

  if (Array.isArray(value)) {
    Reflect.ownKeys(value).forEach((key) => {
      if (typeof key === 'symbol') invalidSerializableValue(path);
      if (key === 'length') return;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable) invalidSerializableValue(`${path}.${String(key)}`);
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= value.length || String(index) !== key) {
        invalidSerializableValue(`${path}.${String(key)}`);
      }
    });
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) invalidSerializableValue(`${path}.${index}`);
      assertSerializableInstanceData(value[index], `${path}.${index}`, seen);
    }
    seen.delete(value);
    return;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalidSerializableValue(path);

  Reflect.ownKeys(value).forEach((key) => {
    if (typeof key === 'symbol') invalidSerializableValue(path);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable) invalidSerializableValue(path ? `${path}.${key}` : key);
    assertSerializableInstanceData((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key, seen);
  });
  seen.delete(value);
}

export function serializeInstanceDataSignature(value: Record<string, unknown>): string {
  assertSerializableInstanceData(value);
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') invalidSerializableValue('$');
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
