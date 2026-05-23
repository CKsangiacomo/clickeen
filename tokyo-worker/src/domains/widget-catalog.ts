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
import countdownCatalog from "../../../tokyo/product/widgets/countdown/catalog.json";
import countdownEditableFields from "../../../tokyo/product/widgets/countdown/editable-fields.json";
import countdownSpec from "../../../tokyo/product/widgets/countdown/spec.json";
import faqCatalog from "../../../tokyo/product/widgets/faq/catalog.json";
import faqEditableFields from "../../../tokyo/product/widgets/faq/editable-fields.json";
import faqSpec from "../../../tokyo/product/widgets/faq/spec.json";
import logoshowcaseCatalog from "../../../tokyo/product/widgets/logoshowcase/catalog.json";
import logoshowcaseEditableFields from "../../../tokyo/product/widgets/logoshowcase/editable-fields.json";
import logoshowcaseSpec from "../../../tokyo/product/widgets/logoshowcase/spec.json";

export type WidgetDefinition = {
  widgetType: string;
  widgetCode: string;
  label: string;
  description: string;
  category: string;
  editableFields: WidgetEditableFieldsContract;
};

type WidgetDefinitionSource = {
  widgetType: string;
  spec: unknown;
  catalog: unknown;
  editableFields: unknown;
};

type WidgetDefinitionInternal = WidgetDefinition & {
  itemKey?: string | null;
  order?: number | null;
  defaults?: unknown;
};

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return typeof structuredClone === "function"
    ? (structuredClone(value) as Record<string, unknown>)
    : (JSON.parse(JSON.stringify(value)) as Record<string, unknown>);
}

const WIDGET_DEFINITION_SOURCES: WidgetDefinitionSource[] = [
  {
    widgetType: "faq",
    spec: faqSpec,
    catalog: faqCatalog,
    editableFields: faqEditableFields,
  },
  {
    widgetType: "countdown",
    spec: countdownSpec,
    catalog: countdownCatalog,
    editableFields: countdownEditableFields,
  },
  {
    widgetType: "logoshowcase",
    spec: logoshowcaseSpec,
    catalog: logoshowcaseCatalog,
    editableFields: logoshowcaseEditableFields,
  },
];

function asNonEmptyString(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function asOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readWidgetDefinitionSource(source: WidgetDefinitionSource): WidgetDefinitionInternal {
  const spec = isRecord(source.spec) ? source.spec : null;
  const catalog = isRecord(source.catalog) ? source.catalog : null;
  if (!spec || !catalog) {
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
  const label = asNonEmptyString(catalog.label);
  const description = asNonEmptyString(catalog.description);
  const category = asNonEmptyString(catalog.category);
  if (!label || !description || !category) {
    throw new Error(`widget_definition_catalog_invalid:${widgetType}`);
  }

  return {
    widgetType,
    widgetCode,
    order: asOptionalNumber(catalog.order),
    label,
    description,
    category,
    itemKey: asNonEmptyString(spec.itemKey),
    editableFields,
    defaults: spec.defaults,
  };
}

const WIDGET_DEFINITIONS: WidgetDefinitionInternal[] = WIDGET_DEFINITION_SOURCES.map(
  readWidgetDefinitionSource,
).sort((a, b) => {
  const orderA = a.order ?? Number.POSITIVE_INFINITY;
  const orderB = b.order ?? Number.POSITIVE_INFINITY;
  return orderA - orderB || a.widgetType.localeCompare(b.widgetType);
});

function publicEntry(entry: WidgetDefinitionInternal): WidgetDefinition {
  return {
    widgetType: entry.widgetType,
    widgetCode: entry.widgetCode,
    label: entry.label,
    description: entry.description,
    category: entry.category,
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
