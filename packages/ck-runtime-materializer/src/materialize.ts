import { buildRuntimePackageFingerprint } from './fingerprint';
import { packageSource } from './files';
import { buildIndexHtml, extractBody, stampPackageRoot, stripScripts, stripStylesheetLinks } from './html';
import { buildRuntime, buildStyles, socialShareEnabled } from './runtime';
import { materializerFailure } from './errors';
import {
  RUNTIME_MATERIALIZER_CONTRACT_VERSION,
  type RuntimeMaterializerArtifactCoordinate,
  type RuntimeMaterializerCompiledWidget,
  type RuntimeMaterializerFileSet,
  type RuntimeMaterializerInput,
  type RuntimeMaterializerResult,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validString(value: string): boolean {
  return typeof value === 'string' && value.trim() === value && value.length > 0;
}

function validCoordinate(coordinate: RuntimeMaterializerArtifactCoordinate): boolean {
  return (
    coordinate.kind === 'account-instance-widget' &&
    validString(coordinate.accountPublicId) &&
    validString(coordinate.instanceId) &&
    validString(coordinate.baseLocale)
  );
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function publicPackagePath(coordinate: RuntimeMaterializerArtifactCoordinate): string {
  return `/${encodePathSegment(coordinate.accountPublicId)}/${encodePathSegment(coordinate.instanceId)}`;
}

function validCompiledWidget(compiled: RuntimeMaterializerCompiledWidget): boolean {
  return (
    isRecord(compiled) &&
    validString(compiled.widgetname) &&
    (typeof compiled.displayName === 'undefined' || typeof compiled.displayName === 'string') &&
    isRecord(compiled.widgetPackage) &&
    isRecord(compiled.widgetPackage.files)
  );
}

function buildPackage(args: {
  compiled: RuntimeMaterializerCompiledWidget;
  artifactCoordinate: RuntimeMaterializerArtifactCoordinate;
  instanceId: string;
  baseLocale: string;
  displayName: string | null;
  baseState: Record<string, unknown>;
  typographyData: RuntimeMaterializerInput['typographyData'];
}): { ok: true; files: RuntimeMaterializerFileSet } | RuntimeMaterializerResult {
  const widgetHtml = packageSource({ compiled: args.compiled, key: 'widget.html' });
  if (!widgetHtml) return materializerFailure('widget_package_missing');

  const includeSocialShare = socialShareEnabled(args.baseState);
  const stamped = stampPackageRoot({
    html: extractBody(widgetHtml),
    widgetType: args.compiled.widgetname,
    instanceId: args.instanceId,
  });
  if (!stamped.ok) return stamped;

  const withoutStylesheets = stripStylesheetLinks(stamped.body);
  const stripped = stripScripts(withoutStylesheets);
  const styles = buildStyles({ compiled: args.compiled, widgetHtml, includeSocialShare });
  if (!styles.ok) return styles;

  const runtime = buildRuntime({
    compiled: args.compiled,
    scriptSources: stripped.scriptSources,
    includeSocialShare,
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    publicPath: publicPackagePath(args.artifactCoordinate),
    baseState: args.baseState,
    ...(args.typographyData ? { typographyData: args.typographyData } : {}),
  });
  if (!runtime.ok) return runtime;

  return {
    ok: true,
    files: {
      indexHtml: buildIndexHtml({
        compiled: args.compiled,
        htmlLocale: args.baseLocale,
        displayName: args.displayName,
        body: stripped.body,
        publicPath: publicPackagePath(args.artifactCoordinate),
      }),
      stylesCss: styles.stylesCss,
      runtimeJs: runtime.runtimeJs,
      dependencies: { instanceIds: [] },
    },
  };
}

export async function materializeRuntimePackage(input: RuntimeMaterializerInput): Promise<RuntimeMaterializerResult> {
  if (!validCoordinate(input.artifactCoordinate)) return materializerFailure('artifact_coordinate_invalid');
  if (!validCompiledWidget(input.compiled)) return materializerFailure('compiled_widget_invalid');
  if (!isRecord(input.state)) return materializerFailure('source_state_invalid');

  const built = buildPackage({
    compiled: input.compiled,
    artifactCoordinate: input.artifactCoordinate,
    instanceId: input.artifactCoordinate.instanceId,
    baseLocale: input.artifactCoordinate.baseLocale,
    displayName: input.displayName,
    baseState: input.state,
    typographyData: input.typographyData,
  });
  if (!built.ok) return built;

  const generatedPackageFingerprint = await buildRuntimePackageFingerprint(built.files);
  return {
    ok: true,
    files: built.files,
    evidence: {
      schemaWidgetContractFingerprint: input.evidence.schemaWidgetContractFingerprint,
      sourceFingerprint: input.evidence.sourceFingerprint,
      sourceReference: input.evidence.sourceReference,
      artifactCoordinate: input.artifactCoordinate,
      materializerContractVersion: RUNTIME_MATERIALIZER_CONTRACT_VERSION,
      generatedPackageFingerprint,
      supportFileFingerprints: [],
    },
  };
}
