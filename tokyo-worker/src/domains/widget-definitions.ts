import {
  WIDGET_DEFINITIONS,
  type WidgetDefinition,
} from '../generated/widget-definition-sources';

export type { WidgetDefinition };

export function listWidgetDefinitions(): readonly WidgetDefinition[] {
  return WIDGET_DEFINITIONS;
}
