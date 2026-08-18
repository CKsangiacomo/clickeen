import {
  resolveWidgetOverlayCode,
  resolveWidgetTypeForOverlayCode,
} from '@clickeen/ck-contracts/overlay-codebooks';
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
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

function readWidgetDefinitionSource(source: WidgetDefinitionSource): WidgetDefinition {
  const spec = source.spec as {
    displayName: string;
    description: string;
  };

  return {
    widgetType: source.widgetType,
    widgetCode: resolveWidgetOverlayCode(source.widgetType)!,
    displayName: spec.displayName,
    description: spec.description,
    editableFields: source.editableFields as WidgetEditableFieldsContract,
  };
}

const WIDGET_DEFINITIONS: WidgetDefinition[] = WIDGET_DEFINITION_SOURCES.map(
  readWidgetDefinitionSource,
).sort((a, b) => a.widgetType.localeCompare(b.widgetType));

function resolveDefinitionInternal(widgetType: string): WidgetDefinition | null {
  return WIDGET_DEFINITIONS.find((candidate) => candidate.widgetType === widgetType) || null;
}

export function listWidgetDefinitions(): WidgetDefinition[] {
  return WIDGET_DEFINITIONS;
}

export function getWidgetDefinition(widgetType: string): WidgetDefinition | null {
  return resolveDefinitionInternal(widgetType);
}

export function resolveWidgetCode(widgetType: string): string | null {
  return getWidgetDefinition(widgetType)?.widgetCode ?? null;
}

export function resolveWidgetTypeFromCode(widgetCode: string): string | null {
  return resolveWidgetTypeForOverlayCode(widgetCode);
}
