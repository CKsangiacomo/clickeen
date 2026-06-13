/**
 * Minimal shared types for the in-progress Bob refactor.
 * These mirror the plan’s canonical panel IDs so session + UI stay in sync.
 */

import type { LimitsSpec } from '@clickeen/ck-policy';
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';

export type PanelId = string;

export interface CompiledPanel {
  id: PanelId;
  label: string;
  html: string;
}

export interface CompiledControlOption {
  label: string;
  value: string;
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
  v: 1;
  widgetType: string;
  files: Partial<Record<WidgetPackageFileName, WidgetPackageFileContext>>;
}

export interface CompiledWidgetCore {
  widgetname: string;
  displayName: string;
  defaults: Record<string, unknown>;
  panels: CompiledPanel[];
  controls: CompiledControl[];
  presets?: WidgetPresets;
  normalization?: WidgetNormalizationSpec;
  editableFields?: WidgetEditableFieldsContract;
  widgetPackage?: WidgetPackageContext;
  media: {
    htmlUrl: string;
    cssUrl: string;
    jsUrl: string;
    dieter?: {
      styles: string[];
      scripts: string[];
    };
  };
}

export interface CompiledWidget extends CompiledWidgetCore {
  limits: LimitsSpec;
}
