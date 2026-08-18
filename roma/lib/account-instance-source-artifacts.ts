import type {
  WidgetEditableField,
  WidgetEditableFieldsContract,
} from '@clickeen/ck-contracts/translated-value-primitives';

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

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(value);
}

type TrustedPathStep = {
  key: string;
  repeat: boolean;
};

type TrustedSavedTextField = {
  identityKey: string;
  fieldPattern: string;
  path: string;
  baseText: string;
};

function trustedPathSteps(path: string): TrustedPathStep[] {
  return path.split('.').map((segment) => ({
    key: segment.endsWith('[]') ? segment.slice(0, -2) : segment,
    repeat: segment.endsWith('[]'),
  }));
}

function trustedPattern(steps: TrustedPathStep[]): string {
  return steps.map((step) => `${step.key}${step.repeat ? '[]' : ''}`).join('.');
}

function trustedValueAtPath(root: unknown, parts: string[]): unknown {
  let current = root;
  for (const part of parts) {
    current = /^\d+$/.test(part)
      ? (current as unknown[])[Number(part)]
      : (current as Record<string, unknown>)[part];
  }
  return current;
}

function trustedIdentityKey(args: {
  widgetType: string;
  field: WidgetEditableField;
  root: Record<string, unknown>;
  repeatContexts: Map<string, string[]>;
}): string {
  if (!args.field.path.includes('[]')) {
    return [args.widgetType, args.field.role, args.field.path].join('|');
  }
  const identities = args.field.arrayItemIdentity.map((identityPath) => {
    const steps = trustedPathSteps(identityPath);
    const owner = trustedPattern(steps.slice(0, -1));
    const concreteOwner = args.repeatContexts.get(owner)!;
    const value = trustedValueAtPath(args.root, [
      ...concreteOwner,
      steps[steps.length - 1]!.key,
    ]);
    return `${identityPath}=${String(value)}`;
  });
  return [args.widgetType, args.field.role, args.field.path, ...identities].join('|');
}

function extractTrustedFieldValues(args: {
  widgetType: string;
  field: WidgetEditableField;
  root: Record<string, unknown>;
  steps: TrustedPathStep[];
  stepIndex: number;
  concreteParts: string[];
  patternParts: TrustedPathStep[];
  repeatContexts: Map<string, string[]>;
  output: TrustedSavedTextField[];
}): void {
  if (args.stepIndex === args.steps.length) {
    args.output.push({
      identityKey: trustedIdentityKey(args),
      fieldPattern: args.field.path,
      path: args.concreteParts.join('.'),
      baseText: trustedValueAtPath(args.root, args.concreteParts) as string,
    });
    return;
  }
  const step = args.steps[args.stepIndex]!;
  const next = (trustedValueAtPath(args.root, args.concreteParts) as Record<string, unknown>)[
    step.key
  ];
  if (step.repeat) {
    (next as unknown[]).forEach((_value, index) => {
      const concreteParts = [...args.concreteParts, step.key, String(index)];
      const patternParts = [...args.patternParts, step];
      const repeatContexts = new Map(args.repeatContexts);
      repeatContexts.set(trustedPattern(patternParts), concreteParts);
      extractTrustedFieldValues({
        ...args,
        stepIndex: args.stepIndex + 1,
        concreteParts,
        patternParts,
        repeatContexts,
      });
    });
    return;
  }
  extractTrustedFieldValues({
    ...args,
    stepIndex: args.stepIndex + 1,
    concreteParts: [...args.concreteParts, step.key],
    patternParts: [...args.patternParts, step],
  });
}

function extractTrustedSavedTextFields(args: {
  contract: WidgetEditableFieldsContract;
  config: Record<string, unknown>;
}): TrustedSavedTextField[] {
  const output: TrustedSavedTextField[] = [];
  for (const field of args.contract.fields) {
    extractTrustedFieldValues({
      widgetType: args.contract.widgetType,
      field,
      root: args.config,
      steps: trustedPathSteps(field.path),
      stepIndex: 0,
      concreteParts: [],
      patternParts: [],
      repeatContexts: new Map(),
      output,
    });
  }
  return output;
}

function deleteExistingPath(root: Record<string, unknown>, path: string): void {
  const parts = path.split('.');
  let current: unknown = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    current = /^\d+$/.test(part)
      ? (current as unknown[])[Number(part)]
      : (current as Record<string, unknown>)[part];
  }
  delete (current as Record<string, unknown>)[parts[parts.length - 1]!];
}

function setValueAtPath(root: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.');
  let current: unknown = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    current = /^\d+$/.test(part)
      ? (current as unknown[])[Number(part)]
      : (current as Record<string, unknown>)[part];
  }
  (current as Record<string, unknown>)[parts[parts.length - 1]!] = value;
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

export function prepareAccountInstanceSourceArtifacts(args: {
  accountId: string;
  instanceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  editableFields: WidgetEditableFieldsContract;
  initialStatus: 'ok' | 'changed';
}): AccountInstanceSourceArtifacts {
  const updatedAt = new Date().toISOString();
  const config = cloneRecord(args.config);
  const fields: AccountInstanceContentDocument['fields'] = {};
  for (const field of extractTrustedSavedTextFields({
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
  return {
    config,
    content: {
      id: args.instanceId,
      accountId: args.accountId,
      widgetType: args.widgetType,
      fields,
      updatedAt,
    },
  };
}
