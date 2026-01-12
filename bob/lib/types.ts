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

export interface CompiledWidget {
  widgetname: string;
  displayName: string;
  defaults: Record<string, unknown>;
  panels: CompiledPanel[];
  controls: CompiledControl[];
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
