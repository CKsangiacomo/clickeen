import { isRecord } from '@clickeen/ck-contracts';
import {
  resolveWidgetOverlayCode,
  resolveWidgetTypeForOverlayCode,
} from '@clickeen/ck-contracts/overlay-codebooks';
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import { readWidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import {
  WIDGET_DEFINITION_SOURCES,
  type WidgetDefinitionSource,
} from '../generated/widget-definition-sources';

export type WidgetDefinition = {
  widgetType: string;
  widgetCode: string;
  displayName: string;
  description: string;
  editableFields: WidgetEditableFieldsContract;
};

type WidgetDefinitionInternal = WidgetDefinition & {
  itemKey?: string | null;
};

function asNonEmptyString(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function asExactString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readWidgetDefinitionSource(source: WidgetDefinitionSource): WidgetDefinitionInternal {
  const spec = isRecord(source.spec) ? source.spec : null;
  if (!spec) {
    throw new Error(`widget_definition_source_invalid:${source.widgetType}`);
  }
  const widgetType = asNonEmptyString(spec.widgetname);
  if (widgetType !== source.widgetType) {
    throw new Error(`widget_definition_widget_type_mismatch:${source.widgetType}`);
  }
  const displayName = asNonEmptyString(spec.displayName);
  if (!displayName) {
    throw new Error(`widget_definition_display_name_missing:${source.widgetType}`);
  }
  const description = asExactString(spec.description);
  if (description == null) {
    throw new Error(`widget_definition_description_missing:${source.widgetType}`);
  }
  const widgetCode = resolveWidgetOverlayCode(widgetType);
  if (!widgetCode) {
    throw new Error(`widget_definition_widget_code_missing:${widgetType}`);
  }

  const editableFields = readWidgetEditableFieldsContract(source.editableFields);
  if (editableFields.widgetType !== widgetType) {
    throw new Error(`widget_definition_editable_fields_mismatch:${widgetType}`);
  }

  return {
    widgetType,
    widgetCode,
    displayName,
    description,
    itemKey: asNonEmptyString(spec.itemKey),
    editableFields,
  };
}

const WIDGET_DEFINITIONS: WidgetDefinitionInternal[] = WIDGET_DEFINITION_SOURCES.map(
  readWidgetDefinitionSource,
).sort((a, b) => a.widgetType.localeCompare(b.widgetType));

function publicEntry(entry: WidgetDefinitionInternal): WidgetDefinition {
  return {
    widgetType: entry.widgetType,
    widgetCode: entry.widgetCode,
    displayName: entry.displayName,
    description: entry.description,
    editableFields: entry.editableFields,
  };
}

function resolveDefinitionInternal(widgetType: string): WidgetDefinitionInternal | null {
  const normalized = String(widgetType || '').trim();
  return WIDGET_DEFINITIONS.find((candidate) => candidate.widgetType === normalized) || null;
}

export function listWidgetDefinitions(): WidgetDefinition[] {
  return WIDGET_DEFINITIONS.map(publicEntry);
}

export function getWidgetDefinition(widgetType: string): WidgetDefinition | null {
  const entry = resolveDefinitionInternal(widgetType);
  return entry ? publicEntry(entry) : null;
}

export function resolveWidgetCode(widgetType: string): string | null {
  return getWidgetDefinition(widgetType)?.widgetCode ?? null;
}

export function resolveWidgetTypeFromCode(widgetCode: string): string | null {
  const normalized = String(widgetCode || '')
    .trim()
    .toUpperCase();
  return resolveWidgetTypeForOverlayCode(normalized);
}
