/**
 * Minimal shared types for the in-progress Bob refactor.
 * These mirror the plan’s canonical panel IDs so session + UI stay in sync.
 */

export type PanelId = string;

export interface CompiledPanel {
  id: PanelId;
  label: string;
  html: string;
}

export interface CompiledWidget {
  widgetname: string;
  displayName: string;
  defaults: Record<string, unknown>;
  panels: CompiledPanel[];
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
