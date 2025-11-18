/**
 * Minimal shared types for the in-progress Bob refactor.
 * These mirror the plan’s canonical panel IDs so session + UI stay in sync.
 */

export type PanelId = string;

export type ControlType = 'toggle' | 'textfield';

export interface ControlDescriptor {
  key: string;
  type: ControlType;
  label: string;
  path: string;
  size?: 'sm' | 'md' | 'lg';
  placeholder?: string;
  showIf?: string;
}

export interface CompiledPanel {
  id: PanelId;
  label: string;
  controls: ControlDescriptor[];
}

export interface CompiledWidget {
  widgetname: string;
  displayName: string;
  defaults: Record<string, unknown>;
  panels: CompiledPanel[];
}
