import type { SavedTextField } from '@clickeen/ck-contracts/translated-value-primitives';
import type { AccountInstanceContentDocument } from './types';

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256V1(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:v1:${hex}`;
}

type MarkerField = {
  identityKey?: string;
  fieldPattern?: string;
  path: string;
  baseText: string;
};

function markerFieldsFromSavedText(fields: SavedTextField[]): MarkerField[] {
  return fields.map((field) => ({
    identityKey: field.identityKey,
    fieldPattern: field.fieldPattern,
    path: field.path,
    baseText: field.baseText,
  }));
}

function markerFieldsFromContent(content: AccountInstanceContentDocument): MarkerField[] {
  return Object.entries(content.fields).map(([path, field]) => ({
    ...(field.identityKey ? { identityKey: field.identityKey } : {}),
    ...(field.fieldPattern ? { fieldPattern: field.fieldPattern } : {}),
    path,
    baseText: field.value,
  }));
}

export function buildWidgetContractMarker(contract: unknown): Promise<string> {
  return sha256V1({
    v: 1,
    kind: 'widgetEditableFieldsContract',
    contract,
  });
}

export function buildBaseContentMarker(args: {
  baseLocale: string;
  widgetType: string;
  widgetContractHash: string;
  fields: SavedTextField[];
}): Promise<string> {
  return buildBaseContentMarkerForFields({
    baseLocale: args.baseLocale,
    widgetType: args.widgetType,
    widgetContractHash: args.widgetContractHash,
    fields: markerFieldsFromSavedText(args.fields),
  });
}

export function buildBaseContentMarkerForContent(args: {
  baseLocale: string;
  widgetType: string;
  widgetContractHash: string;
  content: AccountInstanceContentDocument;
}): Promise<string> {
  return buildBaseContentMarkerForFields({
    baseLocale: args.baseLocale,
    widgetType: args.widgetType,
    widgetContractHash: args.widgetContractHash,
    fields: markerFieldsFromContent(args.content),
  });
}

export function buildBaseContentMarkerForFields(args: {
  baseLocale: string;
  widgetType: string;
  widgetContractHash: string;
  fields: MarkerField[];
}): Promise<string> {
  return sha256V1({
    v: 1,
    kind: 'baseContentMarker',
    baseLocale: args.baseLocale,
    widgetType: args.widgetType,
    widgetContractHash: args.widgetContractHash,
    fields: args.fields
      .map((field) => ({
        fieldKey: field.identityKey ?? field.path,
        identityKey: field.identityKey,
        fieldPattern: field.fieldPattern,
        baseText: field.baseText,
      }))
      .sort((left, right) => left.fieldKey.localeCompare(right.fieldKey)),
  });
}

export function buildGenerationRequestMarker(args: {
  baseContentMarker: string;
  targetLocales: string[];
}): Promise<string> {
  return sha256V1({
    v: 1,
    kind: 'generationRequestMarker',
    baseContentMarker: args.baseContentMarker,
    targetLocales: [...args.targetLocales].sort((left, right) => left.localeCompare(right)),
  });
}

export function baseContentMarkerForTranslationJob(args: {
  baseLocale: string;
  widgetType: string;
  widgetContractHash: string;
  fields: Array<{
    identityKey?: string;
    fieldPattern?: string;
    path: string;
    baseText: string;
  }>;
}): Promise<string> {
  return buildBaseContentMarkerForFields({
    baseLocale: args.baseLocale,
    widgetType: args.widgetType,
    widgetContractHash: args.widgetContractHash,
    fields: args.fields,
  });
}
