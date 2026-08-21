/** Shared Bob contracts used by the compiler, session, and UI. */

import type { LimitsSpec } from '@clickeen/ck-policy';
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import type { WidgetSoftware } from '@clickeen/widget-foundation';

export const BOB_WIDGET_PANEL_IDS = [
  'content',
  'layout',
  'appearance',
  'typography',
  'settings',
] as const;

export type WidgetPanelId = (typeof BOB_WIDGET_PANEL_IDS)[number];
export type PanelId = WidgetPanelId | 'translations';

export function isPanelId(value: string): value is PanelId {
  return value === 'translations' || BOB_WIDGET_PANEL_IDS.includes(value as WidgetPanelId);
}

export interface CompiledPanel {
  id: WidgetPanelId;
  label: string;
  html: string;
}

export type CompiledToolDrawerLabels = {
  components: {
    'agent-activity': {
      title: string;
    };
  };
};

export interface CompiledControlOption {
  label: string;
  value: string | number | boolean;
}

export type ControlKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'color'
  | 'json'
  | 'array'
  | 'object'
  | 'unknown';

export interface CompiledControl {
  panelId: PanelId;
  groupId?: string;
  groupLabel?: string;
  type: string;
  path: string;
  label?: string;
  showIf?: string;
  options?: CompiledControlOption[];
  kind?: ControlKind;
  enumValues?: string[];
  itemIdPath?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}

export type WidgetPresetSpec = {
  customValue?: string;
  values: Record<string, Record<string, unknown>>;
};

export type WidgetPresets = Record<string, WidgetPresetSpec>;

export interface WidgetNormalizationIdRule {
  arrayPath: string;
  idKey: string;
}

export interface WidgetNormalizationSpec {
  idRules?: WidgetNormalizationIdRule[];
}

export type WidgetUpsellCatalog = {
  widgetType: string;
  locale: 'en';
  messages: Record<string, string>;
};

export type WidgetDiscoveryPart = {
  id: string;
  path: string;
  role: string;
  identityPaths: string[];
};

export type WidgetDiscoveryRelationship = {
  kind: string;
  from: string;
  to: string;
  identityPaths: string[];
};

export type WidgetDiscoveryContract = {
  widgetType: string;
  kind: string;
  baseline: {
    title: string;
    description: string;
  };
  parts: WidgetDiscoveryPart[];
  relationships: WidgetDiscoveryRelationship[];
};

export interface CompiledWidgetCore {
  widgetname: string;
  displayName: string;
  defaults: Record<string, unknown>;
  toolDrawerLabels: CompiledToolDrawerLabels;
  panels: CompiledPanel[];
  controls: CompiledControl[];
  presets?: WidgetPresets;
  normalization?: WidgetNormalizationSpec;
  editableFields?: WidgetEditableFieldsContract;
}

export interface CompiledWidget extends CompiledWidgetCore {
  limits: LimitsSpec;
  upsell: WidgetUpsellCatalog;
  editableFields: WidgetEditableFieldsContract;
  widgetSoftware: WidgetSoftware;
}
