import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import { extractSavedTextFieldsForEditableFields } from '@clickeen/ck-contracts/translated-value-primitives';

export type AccountInstanceContentDocument = {
  id: string;
  accountId: string;
  widgetType: string;
  fields: Record<
    string,
    {
      identityKey?: string;
      fieldPattern?: string;
      value: string;
      status: 'ok' | 'changed';
    }
  >;
  updatedAt: string;
};

export type AccountInstanceSourceArtifacts = {
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
};

export type AccountInstanceSourceArtifactsFailure = {
  ok: false;
  status: 422;
  error: {
    kind: 'VALIDATION';
    reasonKey: string;
    detail?: string;
  };
};

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deleteExistingPath(root: Record<string, unknown>, path: string): void {
  const parts = path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  let current: unknown = root;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const last = index === parts.length - 1;
    const numeric = /^\d+$/.test(part);
    if (numeric) {
      if (!Array.isArray(current)) return;
      const offset = Number(part);
      if (offset < 0 || offset >= current.length) return;
      if (last) return;
      current = current[offset];
      continue;
    }
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) return;
    if (last) {
      delete current[part];
      return;
    }
    current = current[part];
  }
}

function setValueAtPath(root: Record<string, unknown>, path: string, value: string): void {
  const parts = path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  let current: unknown = root;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const last = index === parts.length - 1;
    const numeric = /^\d+$/.test(part);
    if (numeric) {
      if (!Array.isArray(current))
        throw new Error(`coreui.errors.instance.content.invalid:${path}`);
      const offset = Number(part);
      if (offset < 0 || offset >= current.length) {
        throw new Error(`coreui.errors.instance.content.invalid:${path}`);
      }
      if (last) {
        current[offset] = value;
        return;
      }
      current = current[offset];
      continue;
    }
    if (!isRecord(current)) throw new Error(`coreui.errors.instance.content.invalid:${path}`);
    if (last) {
      current[part] = value;
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(current, part) || current[part] == null)
      throw new Error(`coreui.errors.instance.content.invalid:${path}`);
    current = current[part];
  }
}

export function composeConfigWithInstanceContent(args: {
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
}): Record<string, unknown> {
  const next = cloneRecord(args.config);
  for (const [path, field] of Object.entries(args.content.fields)) {
    setValueAtPath(next, path, field.value);
  }
  return next;
}

export function materializeAccountInstanceSourceArtifacts(args: {
  accountId: string;
  instanceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  editableFields?: WidgetEditableFieldsContract | null;
  initialStatus: 'ok' | 'changed';
}): { ok: true; value: AccountInstanceSourceArtifacts } | AccountInstanceSourceArtifactsFailure {
  const updatedAt = new Date().toISOString();
  const config = cloneRecord(args.config);
  const fields: AccountInstanceContentDocument['fields'] = {};
  try {
    if (args.editableFields) {
      for (const field of extractSavedTextFieldsForEditableFields({
        contract: args.editableFields,
        config: args.config,
      })) {
        fields[field.path] = {
          identityKey: field.identityKey,
          fieldPattern: field.fieldPattern,
          value: field.baseText,
          status: args.initialStatus,
        };
        deleteExistingPath(config, field.path);
      }
    }
  } catch (error) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.instance.content.invalid',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
  return {
    ok: true,
    value: {
      config,
      content: {
        id: args.instanceId,
        accountId: args.accountId,
        widgetType: args.widgetType,
        fields,
        updatedAt,
      },
    },
  };
}
