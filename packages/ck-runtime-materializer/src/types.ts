import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import type {
  RuntimeTypographyData,
  WidgetDiscoveryContract,
  WidgetSoftware,
} from '@clickeen/widget-foundation';

export type RuntimeMaterializerCompiledWidget = {
  widgetname: string;
  discovery: WidgetDiscoveryContract;
  editableFields: WidgetEditableFieldsContract;
  widgetSoftware: WidgetSoftware;
};

export type RuntimeMaterializerArtifactCoordinate = {
  kind: 'account-instance-widget';
  accountPublicId: string;
  instanceId: string;
  baseLocale: string;
};

export type RuntimeMaterializerInput = {
  compiled: RuntimeMaterializerCompiledWidget;
  artifactCoordinate: RuntimeMaterializerArtifactCoordinate;
  state: Record<string, unknown>;
  typographyData: RuntimeTypographyData;
  discoveryPolicyEnabled: boolean;
};

export type RuntimeMaterializerFileSet = {
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

export type RuntimeMaterializerResult = {
  ok: true;
  files: RuntimeMaterializerFileSet;
};
