type JsonRecord = Record<string, unknown>;

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export type WidgetTextPrimitiveType = 'string' | 'richtext';

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

export type SavedTextField = {
  identityKey: string;
  fieldPattern: string;
  path: string;
  type: WidgetTextPrimitiveType;
  label: string;
  role: string;
  baseText: string;
};

export type TranslatedSavedTextField = {
  identityKey: string;
  value: string;
};

export type SavedTextLanguageValue = {
  identityKey: string;
  fieldPattern: string;
  path: string;
  role: string;
  locale: string;
  value: string;
  updatedAt: string;
  jobId?: string;
};

export type CurrentSavedTextLanguageValuesResult =
  | {
      ok: true;
      values: SavedTextLanguageValue[];
    }
  | {
      ok: false;
      reason:
        | 'duplicate_current_field'
        | 'duplicate_previous_value'
        | 'duplicate_translation'
        | 'missing_changed_translation'
        | 'unknown_translation_field';
      fieldKey: string;
      values: SavedTextLanguageValue[];
    };

export type TranslatedValueMap = Record<string, string>;

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
  values: TranslatedValueMap;
};

export type TranslatedValueValidationResult =
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

type RepeatContext = {
  patternPrefix: string;
  concretePrefix: string[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function readEditableTextPrimitiveValue(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new Error(`translated_value_text_invalid:${path}`);
  return value;
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
    throw new Error(`translated_value_declaration_path_invalid:${path}`);
  }
  return { key, repeat };
}

function parsePrimitivePath(path: string): ParsedPathStep[] {
  const steps = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => assertPathSegment(segment, path));
  if (!steps.length) throw new Error(`translated_value_declaration_path_invalid:${path}`);
  return steps;
}

function concretePath(parts: string[]): string {
  return parts.join('.');
}

function patternPath(parts: ParsedPathStep[]): string {
  return parts.map((part) => `${part.key}${part.repeat ? '[]' : ''}`).join('.');
}

function getValueAtConcretePath(root: unknown, parts: string[]): unknown {
  let current = root;
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(current)) return undefined;
      current = current[Number(part)];
      continue;
    }
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function identityValueToString(value: unknown, identityPath: string): string {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new Error(`saved_text_field_identity_invalid:${identityPath}`);
}

function identityKeyForField(args: {
  contract: WidgetEditableFieldsContract;
  field: WidgetEditableField;
  root: Record<string, unknown>;
  repeatContexts: RepeatContext[];
}): string {
  const fieldSteps = parsePrimitivePath(args.field.path);
  const hasRepeat = fieldSteps.some((step) => step.repeat);
  if (!hasRepeat) return [args.contract.widgetType, args.field.role, args.field.path].join('|');

  const identityPaths = args.field.arrayItemIdentity;
  if (!identityPaths.length) {
    throw new Error(`saved_text_field_identity_missing:${args.field.path}`);
  }
  const parts = identityPaths.map((identityPath) => {
    const steps = parsePrimitivePath(identityPath);
    if (!steps.length || steps[steps.length - 1]?.repeat) {
      throw new Error(`saved_text_field_identity_path_invalid:${identityPath}`);
    }
    const ownerPattern = patternPath(steps.slice(0, -1));
    const leaf = steps[steps.length - 1]!.key;
    const context = args.repeatContexts.find((entry) => entry.patternPrefix === ownerPattern);
    if (!context) {
      throw new Error(`saved_text_field_identity_scope_invalid:${identityPath}`);
    }
    const value = getValueAtConcretePath(args.root, [...context.concretePrefix, leaf]);
    return `${identityPath}=${identityValueToString(value, identityPath)}`;
  });
  return [args.contract.widgetType, args.field.role, args.field.path, ...parts].join('|');
}

function assertConcretePath(path: string): string[] {
  if (!path || path.includes('*') || path.includes('[') || path.includes(']')) {
    throw new Error(`translated_value_path_invalid:${path}`);
  }
  const parts = path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length || parts.some((part) => PROHIBITED_SEGMENTS.has(part))) {
    throw new Error(`translated_value_path_invalid:${path}`);
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

function extractSavedTextFieldsForField(args: {
  contract: WidgetEditableFieldsContract;
  root: Record<string, unknown>;
  field: WidgetEditableField;
  steps: ParsedPathStep[];
  stepIndex: number;
  pathParts: string[];
  patternParts: ParsedPathStep[];
  repeatContexts: RepeatContext[];
  out: SavedTextField[];
}): void {
  if (args.stepIndex >= args.steps.length) {
    const path = concretePath(args.pathParts);
    args.out.push({
      identityKey: identityKeyForField({
        contract: args.contract,
        field: args.field,
        root: args.root,
        repeatContexts: args.repeatContexts,
      }),
      fieldPattern: args.field.path,
      path,
      type: args.field.type,
      label: args.field.label,
      role: args.field.role,
      baseText: readEditableTextPrimitiveValue(getValueAtConcretePath(args.root, args.pathParts), path),
    });
    return;
  }

  const step = args.steps[args.stepIndex]!;
  const currentValue = getValueAtConcretePath(args.root, args.pathParts);
  if (!isRecord(currentValue)) throw new Error(`saved_text_field_path_invalid:${args.field.path}`);
  const nextValue = currentValue[step.key];

  if (step.repeat) {
    if (!Array.isArray(nextValue)) throw new Error(`saved_text_field_path_invalid:${args.field.path}`);
    nextValue.forEach((_item, index) => {
      const patternParts = [...args.patternParts, step];
      const pathParts = [...args.pathParts, step.key, String(index)];
      extractSavedTextFieldsForField({
        ...args,
        stepIndex: args.stepIndex + 1,
        pathParts,
        patternParts,
        repeatContexts: [
          ...args.repeatContexts,
          {
            patternPrefix: patternPath(patternParts),
            concretePrefix: pathParts,
          },
        ],
      });
    });
    return;
  }

  extractSavedTextFieldsForField({
    ...args,
    stepIndex: args.stepIndex + 1,
    pathParts: [...args.pathParts, step.key],
    patternParts: [...args.patternParts, step],
  });
}

export function extractSavedTextFieldsForEditableFields(args: {
  contract: WidgetEditableFieldsContract;
  config: Record<string, unknown>;
}): SavedTextField[] {
  const out: SavedTextField[] = [];
  for (const field of args.contract.fields) {
    extractSavedTextFieldsForField({
      contract: args.contract,
      root: args.config,
      field,
      steps: parsePrimitivePath(field.path),
      stepIndex: 0,
      pathParts: [],
      patternParts: [],
      repeatContexts: [],
      out,
    });
  }
  const seen = new Set<string>();
  for (const field of out) {
    if (seen.has(field.identityKey)) {
      throw new Error(`saved_text_field_identity_duplicate:${field.identityKey}`);
    }
    seen.add(field.identityKey);
  }
  return out;
}

function duplicateSavedTextIdentity(values: Array<{ identityKey: string }>): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.identityKey)) return value.identityKey;
    seen.add(value.identityKey);
  }
  return null;
}

export function selectSavedTextFieldsNeedingTranslation(args: {
  previousSavedTextFields: SavedTextField[];
  currentSavedTextFields: SavedTextField[];
  previousLanguageValues: SavedTextLanguageValue[];
}): SavedTextField[] {
  const previous = new Map(args.previousSavedTextFields.map((field) => [field.identityKey, field]));
  const previousValues = new Set(args.previousLanguageValues.map((value) => value.identityKey));
  return args.currentSavedTextFields.filter((field) => {
    const old = previous.get(field.identityKey);
    return !old || old.baseText !== field.baseText || !previousValues.has(field.identityKey);
  });
}

export function buildCurrentSavedTextLanguageValues(args: {
  previousSavedTextFields: SavedTextField[];
  currentSavedTextFields: SavedTextField[];
  previousLanguageValues: SavedTextLanguageValue[];
  translatedValues: TranslatedSavedTextField[];
  locale: string;
  updatedAt: string;
  jobId: string;
}): CurrentSavedTextLanguageValuesResult {
  const currentDuplicate = duplicateSavedTextIdentity(args.currentSavedTextFields);
  if (currentDuplicate) {
    return { ok: false, reason: 'duplicate_current_field', fieldKey: currentDuplicate, values: args.previousLanguageValues };
  }
  const previousValueDuplicate = duplicateSavedTextIdentity(args.previousLanguageValues);
  if (previousValueDuplicate) {
    return { ok: false, reason: 'duplicate_previous_value', fieldKey: previousValueDuplicate, values: args.previousLanguageValues };
  }
  const translationDuplicate = duplicateSavedTextIdentity(args.translatedValues);
  if (translationDuplicate) {
    return { ok: false, reason: 'duplicate_translation', fieldKey: translationDuplicate, values: args.previousLanguageValues };
  }

  const previousFields = new Map(args.previousSavedTextFields.map((field) => [field.identityKey, field]));
  const currentFields = new Map(args.currentSavedTextFields.map((field) => [field.identityKey, field]));
  const previousValues = new Map(args.previousLanguageValues.map((value) => [value.identityKey, value]));
  const translations = new Map(args.translatedValues.map((value) => [value.identityKey, value]));
  const changedKeys = new Set<string>();

  for (const [key, current] of currentFields) {
    const previous = previousFields.get(key);
    if (!previous || previous.baseText !== current.baseText || !previousValues.has(key)) {
      changedKeys.add(key);
    }
  }

  for (const key of translations.keys()) {
    if (!currentFields.has(key) || !changedKeys.has(key)) {
      return { ok: false, reason: 'unknown_translation_field', fieldKey: key, values: args.previousLanguageValues };
    }
  }

  const values: SavedTextLanguageValue[] = [];
  for (const [key, current] of currentFields) {
    const previousValue = previousValues.get(key);
    if (!changedKeys.has(key) && previousValue) {
      values.push({
        ...previousValue,
        fieldPattern: current.fieldPattern,
        path: current.path,
        role: current.role,
      });
      continue;
    }
    const translated = translations.get(key);
    if (!translated) {
      return { ok: false, reason: 'missing_changed_translation', fieldKey: key, values: args.previousLanguageValues };
    }
    values.push({
      identityKey: current.identityKey,
      fieldPattern: current.fieldPattern,
      path: current.path,
      role: current.role,
      locale: args.locale,
      value: translated.value,
      updatedAt: args.updatedAt,
      jobId: args.jobId,
    });
  }
  return { ok: true, values };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function widgetEditableFieldsContractHash(contract: WidgetEditableFieldsContract): string {
  let hash = 0x811c9dc5;
  const input = stableJson(contract);
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function validateTranslatedValuesForProducerItems(
  requiredItems: BabelTextProducerItem[],
  values: unknown,
): TranslatedValueValidationResult {
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
      if (!Array.isArray(current)) throw new Error(`translated_value_path_invalid:${path}`);
      const offset = Number(part);
      if (offset < 0 || offset >= current.length) throw new Error(`translated_value_path_invalid:${path}`);
      if (last) {
        if (typeof current[offset] !== 'string') throw new Error(`translated_value_path_invalid:${path}`);
        current[offset] = value;
        return;
      }
      current = current[offset];
      continue;
    }

    if (!isRecord(current)) throw new Error(`translated_value_path_invalid:${path}`);
    if (!Object.prototype.hasOwnProperty.call(current, part)) {
      throw new Error(`translated_value_path_invalid:${path}`);
    }
    if (last) {
      if (typeof current[part] !== 'string') throw new Error(`translated_value_path_invalid:${path}`);
      current[part] = value;
      return;
    }
    current = current[part];
  }
}

export function resolveTranslatedValues<T extends Record<string, unknown>>(
  baseConfig: T,
  translatedValues: TranslatedValueMap,
): T {
  const next = structuredClone(baseConfig) as T;
  for (const [path, value] of Object.entries(translatedValues)) {
    if (typeof value !== 'string') throw new Error(`translated_value_invalid:${path}`);
    setExistingStringAtPath(next, path, value);
  }
  return next;
}
