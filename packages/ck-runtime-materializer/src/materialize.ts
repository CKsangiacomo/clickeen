import { buildRuntimePackageFingerprint } from './fingerprint';
import { packageSource } from './files';
import { buildIndexHtml, extractBody, stampPackageRoot, stripScripts, stripStylesheetLinks } from './html';
import { applyLocaleOverlayToState } from './overlay';
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
    validString(coordinate.baseLocale) &&
    validString(coordinate.requestedLocale)
  );
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function publicPackagePath(coordinate: RuntimeMaterializerArtifactCoordinate): string {
  const base = `/${encodePathSegment(coordinate.accountPublicId)}/${encodePathSegment(coordinate.instanceId)}`;
  if (coordinate.requestedLocale === coordinate.baseLocale) return base;
  return `${base}/locales/${encodePathSegment(coordinate.requestedLocale)}`;
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
  requestedLocale: string;
  displayName: string | null;
  baseState: Record<string, unknown>;
  requestedState: Record<string, unknown>;
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

  const locales =
    args.requestedLocale === args.baseLocale
      ? { [args.baseLocale]: args.baseState }
      : { [args.baseLocale]: args.baseState, [args.requestedLocale]: args.requestedState };
  const runtime = buildRuntime({
    compiled: args.compiled,
    scriptSources: stripped.scriptSources,
    includeSocialShare,
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    requestedLocale: args.requestedLocale,
    locales,
    ...(args.typographyData ? { typographyData: args.typographyData } : {}),
  });
  if (!runtime.ok) return runtime;

  return {
    ok: true,
    files: {
      indexHtml: buildIndexHtml({
        compiled: args.compiled,
        htmlLocale: args.requestedLocale,
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
  if (!validCoordinate(input.artifactCoordinate)) return materializerFailure('locale_coordinate_invalid');
  if (!validCompiledWidget(input.compiled)) return materializerFailure('compiled_widget_invalid');
  if (!isRecord(input.state)) return materializerFailure('source_state_invalid');

  const base = input.artifactCoordinate.requestedLocale === input.artifactCoordinate.baseLocale;
  if (base && input.localeOverlay) return materializerFailure('locale_overlay_unexpected_for_base');
  if (base && input.evidence.overlayFingerprint !== null) return materializerFailure('source_state_invalid', 'base_overlay_fingerprint_unexpected');
  if (!base && !input.localeOverlay) return materializerFailure('locale_overlay_missing');
  if (!base && input.localeOverlay?.locale !== input.artifactCoordinate.requestedLocale) {
    return materializerFailure('locale_overlay_locale_mismatch');
  }
  if (!base && (!input.evidence.overlayFingerprint || typeof input.evidence.overlayFingerprint !== 'string')) {
    return materializerFailure('source_state_invalid', 'non_base_overlay_fingerprint_missing');
  }

  let requestedState = input.state;
  if (!base && input.localeOverlay) {
    const overlay = applyLocaleOverlayToState({
      compiled: input.compiled,
      state: input.state,
      localeOverlay: input.localeOverlay,
    });
    if (!overlay.ok) return overlay;
    requestedState = overlay.state;
  }

  const built = buildPackage({
    compiled: input.compiled,
    artifactCoordinate: input.artifactCoordinate,
    instanceId: input.artifactCoordinate.instanceId,
    baseLocale: input.artifactCoordinate.baseLocale,
    requestedLocale: input.artifactCoordinate.requestedLocale,
    displayName: input.displayName,
    baseState: input.state,
    requestedState,
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
      localeCoordinate: input.artifactCoordinate,
      overlayFingerprint: input.evidence.overlayFingerprint,
      materializerContractVersion: RUNTIME_MATERIALIZER_CONTRACT_VERSION,
      generatedPackageFingerprint,
      supportFileFingerprints: [],
    },
  };
}
