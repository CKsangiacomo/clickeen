/** Shared Bob contracts used by the compiler, session, and UI. */

import type { LimitsSpec } from '@clickeen/ck-policy';
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';

export const BOB_PANEL_LABELS = {
  content: 'Content',
  layout: 'Layout',
  appearance: 'Appearance',
  typography: 'Typography',
  translations: 'Translations',
  settings: 'Settings',
} as const;

export type PanelId = keyof typeof BOB_PANEL_LABELS;

export const BOB_WIDGET_PANEL_IDS = [
  'content',
  'layout',
  'appearance',
  'typography',
  'settings',
] as const satisfies readonly PanelId[];

export const BOB_MENU_PANEL_IDS = [
  ...BOB_WIDGET_PANEL_IDS.slice(0, -1),
  'translations',
  BOB_WIDGET_PANEL_IDS[BOB_WIDGET_PANEL_IDS.length - 1],
] as const satisfies readonly PanelId[];

export function isPanelId(value: string): value is PanelId {
  return Object.prototype.hasOwnProperty.call(BOB_PANEL_LABELS, value);
}

export interface CompiledPanel {
  id: PanelId;
  label: string;
  html: string;
}

export type CompiledToolDrawerLabels = {
  translations: {
    agentActivityTitle: string;
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
  allowImage?: boolean;
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

export type WidgetPackageFileName =
  | 'editable-fields.json'
  | 'spec.json'
  | 'widget.html'
  | 'widget.css'
  | 'widget.client.js'
  | string;

export interface WidgetPackageFileContext {
  mediaType: 'application/json' | 'text/html' | 'text/css' | 'text/javascript';
  source: string;
}

export interface WidgetPackageContext {
  widgetType: string;
  files: Partial<Record<WidgetPackageFileName, WidgetPackageFileContext>>;
}

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
}
