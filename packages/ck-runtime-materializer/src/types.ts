import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';

export const RUNTIME_MATERIALIZER_CONTRACT_VERSION = 'ck-runtime-materializer:124B';

export type RuntimeMaterializerFileContext = {
  mediaType: 'application/json' | 'text/html' | 'text/css' | 'text/javascript';
  source: string;
};

export type RuntimeMaterializerCompiledWidget = {
  widgetname: string;
  displayName?: string;
  editableFields?: WidgetEditableFieldsContract;
  controls?: Array<{ path?: string }>;
  widgetPackage: {
    files: Partial<Record<string, RuntimeMaterializerFileContext>>;
  };
};

export type RuntimeMaterializerArtifactCoordinate = {
  kind: 'account-instance-widget';
  accountPublicId: string;
  instanceId: string;
  baseLocale: string;
  requestedLocale: string;
};

export type RuntimeMaterializerLocaleOverlay = {
  locale: string;
  keyKind: 'current_saved_content_concrete_path';
  values: Record<string, unknown>;
};

export type RuntimeMaterializerEvidenceInput = {
  schemaWidgetContractFingerprint: string;
  sourceFingerprint: string;
  sourceReference: string;
  overlayFingerprint: string | null;
};

export type RuntimeMaterializerInput = {
  compiled: RuntimeMaterializerCompiledWidget;
  artifactCoordinate: RuntimeMaterializerArtifactCoordinate;
  displayName: string | null;
  state: Record<string, unknown>;
  localeOverlay?: RuntimeMaterializerLocaleOverlay;
  evidence: RuntimeMaterializerEvidenceInput;
};

export type RuntimeMaterializerFileSet = {
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
  dependencies: {
    instanceIds: string[];
  };
};

export type RuntimeMaterializerEvidence = {
  schemaWidgetContractFingerprint: string;
  sourceFingerprint: string;
  sourceReference: string;
  localeCoordinate: RuntimeMaterializerArtifactCoordinate;
  overlayFingerprint: string | null;
  materializerContractVersion: string;
  generatedPackageFingerprint: string;
  supportFileFingerprints: Array<{ path: string; fingerprint: string }>;
};

export type RuntimeMaterializerErrorReason =
  | 'compiled_widget_invalid'
  | 'widget_package_missing'
  | 'widget_package_file_missing'
  | 'widget_package_root_invalid'
  | 'locale_coordinate_invalid'
  | 'locale_overlay_missing'
  | 'locale_overlay_unexpected_for_base'
  | 'locale_overlay_locale_mismatch'
  | 'locale_overlay_key_missing'
  | 'locale_overlay_key_unexpected'
  | 'locale_overlay_value_invalid'
  | 'locale_overlay_scope_unsupported'
  | 'source_state_invalid';

export type RuntimeMaterializerFailure = {
  ok: false;
  error: {
    reason: RuntimeMaterializerErrorReason;
    reasonKey: string;
    detail?: string;
    paths?: string[];
  };
};

export type RuntimeMaterializerSuccess = {
  ok: true;
  files: RuntimeMaterializerFileSet;
  evidence: RuntimeMaterializerEvidence;
};

export type RuntimeMaterializerResult =
  | RuntimeMaterializerSuccess
  | RuntimeMaterializerFailure;
