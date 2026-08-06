import type { ResolvedAccountAsset } from '@clickeen/ck-contracts';
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import type { RuntimeTypographyData } from '@clickeen/widget-shell';

export type WebCodeFiles = {
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

export type WidgetDefinitionFiles = {
  'index.html': string;
  'styles.css': string;
  'runtime.js': string;
};

export type WebCodeModuleSource = {
  id: string;
  source: string;
};

export type WidgetDefinition = {
  widgetType: string;
  displayName: string;
  description: string;
  editableFields: WidgetEditableFieldsContract;
  files: WidgetDefinitionFiles;
  styleModules: WebCodeModuleSource[];
  runtimeModules: WebCodeModuleSource[];
};

export type SavedInstanceStructuredSource = Record<string, unknown>;

export type ExactLocaleOverlay = {
  values: Record<string, string>;
};

export type ExactLocaleOverlays = Record<string, ExactLocaleOverlay>;

export type ResolvedWebCodeContext = {
  assetsByRef: Record<string, ResolvedAccountAsset>;
  typography: RuntimeTypographyData;
};

export type GenerateInstanceInput = {
  definition: WidgetDefinition;
  source: SavedInstanceStructuredSource;
  baseLocale: string;
  overlays: ExactLocaleOverlays | null;
  settings: {
    seoGeoAeoEnabled: boolean;
    includeClickeenAttribution: boolean;
  };
  context: ResolvedWebCodeContext;
};
