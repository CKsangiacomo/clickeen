import { isRecord } from "@clickeen/ck-contracts";
import {
  resolveWidgetOverlayCode,
  resolveWidgetTypeForOverlayCode,
} from "@clickeen/ck-contracts/overlay-codebooks";
import type {
  WidgetEditableFieldsContract,
} from "@clickeen/ck-contracts/translated-value-primitives";
import {
  readWidgetEditableFieldsContract,
} from "@clickeen/ck-contracts/translated-value-primitives";
import {
  WIDGET_DEFINITION_SOURCES,
  type WidgetDefinitionSource,
} from "../generated/widget-definition-sources";

export type WidgetDefinition = {
  widgetType: string;
  widgetCode: string;
  editableFields: WidgetEditableFieldsContract;
};

type WidgetDefinitionInternal = WidgetDefinition & {
  itemKey?: string | null;
  defaults?: unknown;
};

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return typeof structuredClone === "function"
    ? (structuredClone(value) as Record<string, unknown>)
    : (JSON.parse(JSON.stringify(value)) as Record<string, unknown>);
}

function asNonEmptyString(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
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
  if (!isRecord(spec.defaults)) {
    throw new Error(`widget_definition_defaults_missing:${source.widgetType}`);
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
    itemKey: asNonEmptyString(spec.itemKey),
    editableFields,
    defaults: spec.defaults,
  };
}

const WIDGET_DEFINITIONS: WidgetDefinitionInternal[] = WIDGET_DEFINITION_SOURCES.map(
  readWidgetDefinitionSource,
).sort((a, b) => a.widgetType.localeCompare(b.widgetType));

function publicEntry(entry: WidgetDefinitionInternal): WidgetDefinition {
  return {
    widgetType: entry.widgetType,
    widgetCode: entry.widgetCode,
    editableFields: entry.editableFields,
  };
}

function resolveDefinitionInternal(
  widgetType: string,
): WidgetDefinitionInternal | null {
  const normalized = String(widgetType || "").trim();
  return (
    WIDGET_DEFINITIONS.find(
      (candidate) => candidate.widgetType === normalized,
    ) || null
  );
}

export function validateWidgetSource(): { ok: true; widgetTypes: string[] } {
  return { ok: true, widgetTypes: WIDGET_DEFINITIONS.map((entry) => entry.widgetType) };
}

export function listWidgetDefinitions(): WidgetDefinition[] {
  return WIDGET_DEFINITIONS.map(publicEntry);
}

export function getWidgetDefinition(
  widgetType: string,
): WidgetDefinition | null {
  const entry = resolveDefinitionInternal(widgetType);
  return entry ? publicEntry(entry) : null;
}

export function resolveWidgetCode(widgetType: string): string | null {
  return getWidgetDefinition(widgetType)?.widgetCode ?? null;
}

export function resolveWidgetTypeFromCode(widgetCode: string): string | null {
  const normalized = String(widgetCode || "").trim().toUpperCase();
  return resolveWidgetTypeForOverlayCode(normalized);
}

export function resolveWidgetDefaults(
  widgetType: string,
): Record<string, unknown> | null {
  const entry = resolveDefinitionInternal(widgetType);
  return entry && isRecord(entry.defaults) ? cloneRecord(entry.defaults) : null;
}

export function listWidgetCoreFactoryDefaults(): Array<{
  widgetType: string;
  core: Record<string, unknown>;
}> {
  return WIDGET_DEFINITIONS.map((entry) => ({
    widgetType: entry.widgetType,
    core: isRecord(entry.defaults) ? cloneRecord(entry.defaults) : {},
  }));
}
