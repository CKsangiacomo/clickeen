/**
 * Minimal shared types for the in-progress Bob refactor.
 * These mirror the plan’s canonical panel IDs so session + UI stay in sync.
 */

import type { LimitsSpec } from '@clickeen/ck-policy';

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
}

export type WidgetPresetSpec = {
  customValue?: string;
  values: Record<string, Record<string, unknown>>;
};

export type WidgetPresets = Record<string, WidgetPresetSpec>;

export type WidgetNormalizationScalarType = 'string' | 'number' | 'boolean';

export interface WidgetNormalizationIdRule {
  arrayPath: string;
  idKey: string;
  seedKey?: string;
  fallbackPrefix?: string;
}

export interface WidgetNormalizationCoerceRule {
  path: string;
  type: WidgetNormalizationScalarType;
  default?: unknown;
}

export interface WidgetNormalizationSpec {
  idRules?: WidgetNormalizationIdRule[];
  coerceRules?: WidgetNormalizationCoerceRule[];
}

export interface CompiledWidget {
  widgetname: string;
  displayName: string;
  defaults: Record<string, unknown>;
  panels: CompiledPanel[];
  controls: CompiledControl[];
  presets?: WidgetPresets;
  normalization?: WidgetNormalizationSpec;
  limits?: LimitsSpec | null;
  assets: {
    htmlUrl: string;
    cssUrl: string;
    jsUrl: string;
    dieter?: {
      styles: string[];
      scripts: string[];
    };
  };
}
