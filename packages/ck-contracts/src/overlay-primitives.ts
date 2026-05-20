type JsonRecord = Record<string, unknown>;

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export type WidgetTextPrimitiveType = 'string' | 'richtext';

export type WidgetTextPrimitiveDeclaration = {
  path: string;
  label: string;
  type: WidgetTextPrimitiveType;
  role?: string;
};

export type WidgetEditableField = {
  path: string;
  type: WidgetTextPrimitiveType;
  label: string;
  role: string;
  arrayItemIdentity: string[];
  limits: unknown[];
};

export type WidgetEditableFieldsContract = {
  v: 1;
  widgetType: string;
  fields: WidgetEditableField[];
};

export type ExtractedTextPrimitiveValue = WidgetTextPrimitiveDeclaration & {
  value: string;
};

export type OverlayValueMap = Record<string, string>;

export type BabelTextProducerItem = {
  path: string;
  type: WidgetTextPrimitiveType;
  label?: string;
  role?: string;
  value: string;
};

export type BabelTextProducerRequest = {
  v: 1;
  widgetType: string;
  sourceLanguage: string;
  targetLanguage: string;
  items: BabelTextProducerItem[];
};

export type BabelTextProducerResponse = {
  v: 1;
  values: OverlayValueMap;
};

export type OverlayValueValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'missing_path' | 'extra_path' | 'invalid_value';
      path: string;
    };

type ParsedPathStep = {
  key: string;
  repeat: boolean;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

export function readEditableTextPrimitiveValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parsePrimitiveType(value: unknown): WidgetTextPrimitiveType {
  return value === 'richtext' ? 'richtext' : 'string';
}

function parseStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label}_invalid`);
  return value.map((entry, index) => {
    const normalized = asNonEmptyString(entry);
    if (!normalized) throw new Error(`${label}_entry_invalid:${index}`);
    return normalized;
  });
}

function assertPathSegment(segment: string, path: string): ParsedPathStep {
  const repeat = segment.endsWith('[]');
  const key = repeat ? segment.slice(0, -2) : segment;
  if (!key || PROHIBITED_SEGMENTS.has(key) || key.includes('[') || key.includes(']') || key.includes('*')) {
    throw new Error(`overlay_primitive_path_invalid:${path}`);
  }
  return { key, repeat };
}

function parsePrimitivePath(path: string): ParsedPathStep[] {
  const steps = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => assertPathSegment(segment, path));
  if (!steps.length) throw new Error(`overlay_primitive_path_invalid:${path}`);
  return steps;
}

function concretePath(parts: string[]): string {
  return parts.join('.');
}

function assertConcretePath(path: string): string[] {
  if (!path || path.includes('*') || path.includes('[') || path.includes(']')) {
    throw new Error(`overlay_value_path_invalid:${path}`);
  }
  const parts = path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length || parts.some((part) => PROHIBITED_SEGMENTS.has(part))) {
    throw new Error(`overlay_value_path_invalid:${path}`);
  }
  return parts;
}

export function readWidgetEditableFieldsContract(content: unknown): WidgetEditableFieldsContract {
  if (!isRecord(content) || content.v !== 1 || !Array.isArray(content.fields)) {
    throw new Error('widget_editable_fields_contract_invalid');
  }
  const widgetType = asNonEmptyString(content.widgetType);
  if (!widgetType) throw new Error('widget_editable_fields_widget_type_missing');

  const fields = content.fields.map((entry, index): WidgetEditableField => {
    if (!isRecord(entry)) throw new Error(`widget_editable_fields_field_invalid:${index}`);
    const path = asNonEmptyString(entry.path);
    const label = asNonEmptyString(entry.label);
    const role = asNonEmptyString(entry.role);
    if (!path) throw new Error(`widget_editable_fields_field_path_missing:${index}`);
    if (!label) throw new Error(`widget_editable_fields_field_label_missing:${path}`);
    if (!role) throw new Error(`widget_editable_fields_field_role_missing:${path}`);
    parsePrimitivePath(path);
    if (entry.type !== 'string' && entry.type !== 'richtext') {
      throw new Error(`widget_editable_fields_field_type_invalid:${path}`);
    }
    const type = entry.type;
    return {
      path,
      type,
      label,
      role,
      arrayItemIdentity: parseStringArray(entry.arrayItemIdentity, `widget_editable_fields_field_array_identity:${path}`),
      limits: Array.isArray(entry.limits) ? entry.limits.slice() : [],
    };
  });

  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field.path)) throw new Error(`widget_editable_fields_field_duplicate:${field.path}`);
    seen.add(field.path);
  }

  return { v: 1, widgetType, fields };
}

export function widgetEditableFieldsToTextPrimitives(contract: WidgetEditableFieldsContract): WidgetTextPrimitiveDeclaration[] {
  return contract.fields.map((field) => ({
    path: field.path,
    label: field.label,
    type: field.type,
    role: field.role,
  }));
}

function extractForDeclaration(args: {
  root: unknown;
  declaration: WidgetTextPrimitiveDeclaration;
  steps: ParsedPathStep[];
  stepIndex: number;
  pathParts: string[];
  out: ExtractedTextPrimitiveValue[];
}): void {
  if (args.stepIndex >= args.steps.length) {
    const path = concretePath(args.pathParts);
    args.out.push({
      ...args.declaration,
      path,
      value: readEditableTextPrimitiveValue(args.root),
    });
    return;
  }

  const step = args.steps[args.stepIndex]!;
  if (!isRecord(args.root)) return;
  const nextValue = args.root[step.key];

  if (step.repeat) {
    if (!Array.isArray(nextValue)) return;
    nextValue.forEach((item, index) => {
      extractForDeclaration({
        root: item,
        declaration: args.declaration,
        steps: args.steps,
        stepIndex: args.stepIndex + 1,
        pathParts: [...args.pathParts, step.key, String(index)],
        out: args.out,
      });
    });
    return;
  }

  extractForDeclaration({
    root: nextValue,
    declaration: args.declaration,
    steps: args.steps,
    stepIndex: args.stepIndex + 1,
    pathParts: [...args.pathParts, step.key],
    out: args.out,
  });
}

export function extractTextPrimitiveValuesForEditableFields(args: {
  contract: WidgetEditableFieldsContract;
  config: Record<string, unknown>;
}): ExtractedTextPrimitiveValue[] {
  return widgetEditableFieldsToTextPrimitives(args.contract).flatMap((declaration) => {
    const out: ExtractedTextPrimitiveValue[] = [];
    extractForDeclaration({
      root: args.config,
      declaration,
      steps: parsePrimitivePath(declaration.path),
      stepIndex: 0,
      pathParts: [],
      out,
    });
    return out;
  });
}

export function buildOverlayTextValueMap(items: ExtractedTextPrimitiveValue[]): OverlayValueMap {
  return Object.fromEntries(items.map((item) => [item.path, item.value]));
}

export function validateOverlayValuesForTextPrimitives(
  requiredItems: ExtractedTextPrimitiveValue[],
  values: unknown,
): OverlayValueValidationResult {
  if (!isRecord(values)) {
    return { ok: false, reason: 'invalid_value', path: '<root>' };
  }
  const required = new Set(requiredItems.map((item) => item.path));
  const actual = new Set(Object.keys(values));

  for (const path of actual) {
    if (!required.has(path)) return { ok: false, reason: 'extra_path', path };
    if (typeof values[path] !== 'string') return { ok: false, reason: 'invalid_value', path };
  }

  for (const path of required) {
    if (!actual.has(path)) return { ok: false, reason: 'missing_path', path };
  }

  return { ok: true };
}

export function validateOverlayValuesForProducerItems(
  requiredItems: BabelTextProducerItem[],
  values: unknown,
): OverlayValueValidationResult {
  if (!isRecord(values)) {
    return { ok: false, reason: 'invalid_value', path: '<root>' };
  }
  const required = new Set(requiredItems.map((item) => item.path));
  const actual = new Set(Object.keys(values));

  for (const path of actual) {
    if (!required.has(path)) return { ok: false, reason: 'extra_path', path };
    if (typeof values[path] !== 'string') return { ok: false, reason: 'invalid_value', path };
  }

  for (const path of required) {
    if (!actual.has(path)) return { ok: false, reason: 'missing_path', path };
  }

  return { ok: true };
}

function setExistingStringAtPath(root: Record<string, unknown>, path: string, value: string): void {
  const parts = assertConcretePath(path);
  let current: unknown = root;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const last = index === parts.length - 1;
    const numeric = /^\d+$/.test(part);

    if (numeric) {
      if (!Array.isArray(current)) throw new Error(`overlay_resolve_path_invalid:${path}`);
      const offset = Number(part);
      if (offset < 0 || offset >= current.length) throw new Error(`overlay_resolve_path_invalid:${path}`);
      if (last) {
        if (typeof current[offset] !== 'string') throw new Error(`overlay_resolve_path_invalid:${path}`);
        current[offset] = value;
        return;
      }
      current = current[offset];
      continue;
    }

    if (!isRecord(current)) throw new Error(`overlay_resolve_path_invalid:${path}`);
    if (!Object.prototype.hasOwnProperty.call(current, part)) {
      throw new Error(`overlay_resolve_path_invalid:${path}`);
    }
    if (last) {
      if (typeof current[part] !== 'string') throw new Error(`overlay_resolve_path_invalid:${path}`);
      current[part] = value;
      return;
    }
    current = current[part];
  }
}

export function resolveOverlay<T extends Record<string, unknown>>(
  baseConfig: T,
  overlayValues: OverlayValueMap,
): T {
  const next = structuredClone(baseConfig) as T;
  for (const [path, value] of Object.entries(overlayValues)) {
    if (typeof value !== 'string') throw new Error(`overlay_resolve_value_invalid:${path}`);
    setExistingStringAtPath(next, path, value);
  }
  return next;
}
