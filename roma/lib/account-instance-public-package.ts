import { getCompiledWidgetRouteResponse } from '@clickeen/bob/compiled-widget-route';
import {
  collectConfigMediaAssetRefs,
  materializeConfigMedia,
} from '@clickeen/ck-contracts';
import {
  materializeRuntimePackage,
  type RuntimeMaterializerEvidence,
  type RuntimeMaterializerErrorReason,
} from '@clickeen/ck-runtime-materializer';
import {
  getAccountFontRecord,
  isAccountFontFamily,
  type RuntimeTypographyData,
} from '@clickeen/widget-shell';
import type { LimitsSpec } from '@clickeen/ck-policy';
import {
  widgetEditableFieldsContractHash,
  type WidgetEditableFieldsContract,
} from '@clickeen/ck-contracts/translated-value-primitives';
import { NextRequest } from 'next/server';
import { parseResolvedAccountAsset } from './account-asset-record';
import {
  buildTokyoAssetControlHeaders,
  fetchTokyoAssetControl,
} from './tokyo-asset-control';
import { loadAccountWidgetDefaultsInTokyo } from './account-widget-defaults-direct';

type WidgetPackageFileContext = {
  mediaType: 'application/json' | 'text/html' | 'text/css' | 'text/javascript';
  source: string;
};

export type SavedWidgetPublicPackage = {
    indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
  dependencies: {
    instanceIds: string[];
  };
};

export type CompiledWidgetForPublicPackage = {
  widgetname: string;
  displayName?: string;
  limits: LimitsSpec;
  editableFields?: WidgetEditableFieldsContract;
  controls?: Array<{
    path?: string;
  }>;
  widgetPackage?: {
    files: Partial<Record<string, WidgetPackageFileContext>>;
  };
};

export type InstancePackageFailure = {
  ok: false;
  status: 422 | 502;
  error: {
    kind: 'VALIDATION' | 'UPSTREAM_UNAVAILABLE';
    reasonKey: string;
    detail?: string;
    paths?: string[];
  };
};

type PackageBuildArgs = {
  compiled: CompiledWidgetForPublicPackage;
  accountId: string;
  instanceId: string;
  baseLocale: string;
  displayName: string | null;
  state: Record<string, unknown>;
  typographyData?: RuntimeTypographyData;
};

type LocalePackageBuildArgs = PackageBuildArgs & {
  requestedLocale: string;
  overlayValues: Record<string, string>;
};

export type SavedWidgetPublicPackageBuildResult = {
  package: SavedWidgetPublicPackage;
  evidence: RuntimeMaterializerEvidence;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCompiledWidgetForPublicPackage(value: unknown): value is CompiledWidgetForPublicPackage {
  if (!isRecord(value)) return false;
  const widgetPackage = value.widgetPackage;
  return (
    typeof value.widgetname === 'string' &&
    (typeof value.displayName === 'undefined' || typeof value.displayName === 'string') &&
    isRecord(value.limits) &&
    isRecord(widgetPackage)
  );
}

function compileFailureFromPayload(payload: unknown): InstancePackageFailure {
  const error = isRecord(payload) ? payload.error : null;
  if (isRecord(error) && typeof error.reasonKey === 'string') {
    const paths = Array.isArray(error.paths)
      ? error.paths.filter((path): path is string => typeof path === 'string')
      : undefined;
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: error.reasonKey,
        ...(paths?.length ? { paths } : {}),
      },
    };
  }
  return {
    ok: false,
    status: 422,
    error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widget.compiled.invalid' },
  };
}

export async function compileWidgetForInstancePackage(
  request: NextRequest,
  widgetType: string,
): Promise<
  | { ok: true; value: CompiledWidgetForPublicPackage }
  | InstancePackageFailure
> {
  const response = await getCompiledWidgetRouteResponse(
    new NextRequest(new URL(`/api/widgets/${encodeURIComponent(widgetType)}/compiled`, request.url)),
    { params: Promise.resolve({ widgetname: widgetType }) },
  );
  const payload = await response.json().catch(() => null);
  if (response.ok && isCompiledWidgetForPublicPackage(payload)) {
    return { ok: true, value: payload };
  }
  return compileFailureFromPayload(payload);
}

function validationFailure(reasonKey: string, detail?: string, paths?: string[]): InstancePackageFailure {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey,
      ...(detail ? { detail } : {}),
      ...(paths?.length ? { paths } : {}),
    },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled runtime materializer reason: ${value}`);
}

function materializerFailureToInstancePackageFailure(args: {
  reason: RuntimeMaterializerErrorReason;
  reasonKey: string;
  detail?: string;
  paths?: string[];
}): InstancePackageFailure {
  switch (args.reason) {
    case 'compiled_widget_invalid':
      return validationFailure('coreui.errors.widget.compiled.invalid', args.detail ?? args.reasonKey, args.paths);
    case 'widget_package_missing':
    case 'widget_package_file_missing':
    case 'widget_package_root_invalid':
    case 'source_state_invalid':
      return validationFailure(args.reasonKey, args.detail, args.paths);
    case 'locale_coordinate_invalid':
    case 'locale_overlay_missing':
    case 'locale_overlay_unexpected_for_base':
    case 'locale_overlay_locale_mismatch':
    case 'locale_overlay_key_missing':
    case 'locale_overlay_key_unexpected':
    case 'locale_overlay_value_invalid':
    case 'locale_overlay_scope_unsupported':
    case 'typography_data_invalid':
      return validationFailure('coreui.errors.instance.content.invalid', args.reasonKey, args.paths);
    default:
      return assertNever(args.reason);
  }
}

async function sha256Fingerprint(label: string, value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(`${label}:${JSON.stringify(value)}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function buildMaterializerSourceFingerprint(args: PackageBuildArgs): Promise<string> {
  return sha256Fingerprint('roma.account-instance.base-source', {
    widgetType: args.compiled.widgetname,
    accountId: args.accountId,
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    displayName: args.displayName,
    state: args.state,
  });
}

async function buildLocaleOverlayFingerprint(args: LocalePackageBuildArgs): Promise<string> {
  return sha256Fingerprint('roma.account-instance.locale-overlay', {
    accountId: args.accountId,
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    locale: args.requestedLocale,
    values: args.overlayValues,
  });
}

function buildSchemaWidgetContractFingerprint(compiled: CompiledWidgetForPublicPackage): string {
  if (compiled.editableFields) {
    return `widget-editable-fields:${widgetEditableFieldsContractHash(compiled.editableFields)}`;
  }
  return `widget-controls:${compiled.widgetname}:${JSON.stringify(compiled.controls ?? [])}`;
}

function collectTypographyFamilies(state: Record<string, unknown>): string[] {
  const families = new Set<string>(['Inter']);
  const typography = isRecord(state.typography) ? state.typography : null;
  if (!typography) return Array.from(families);
  if (typeof typography.globalFamily === 'string' && typography.globalFamily.trim()) {
    families.add(typography.globalFamily.trim());
  }
  const roles = isRecord(typography.roles) ? typography.roles : null;
  if (!roles) return Array.from(families);
  Object.values(roles).forEach((role) => {
    if (!isRecord(role)) return;
    if (typeof role.family === 'string' && role.family.trim()) families.add(role.family.trim());
  });
  return Array.from(families);
}

async function resolveRuntimeTypographyData(args: {
  accountId: string;
  accountCapsule: string;
  requestId: string;
  state: Record<string, unknown>;
}): Promise<{ ok: true; typographyData: RuntimeTypographyData } | InstancePackageFailure> {
  const defaults = await loadAccountWidgetDefaultsInTokyo({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!defaults.ok) {
    if (defaults.status === 422) return validationFailure(defaults.error.reasonKey, defaults.error.detail);
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: defaults.error.reasonKey,
        detail: defaults.error.detail,
      },
    };
  }

  const fontLibrary = defaults.value.widgetDefaults.fontLibrary;
  const families = collectTypographyFamilies(args.state);
  const missing = families.filter((family) => !isAccountFontFamily(fontLibrary, family));
  if (missing.length) {
    return validationFailure(
      'coreui.errors.typography.fontFamily.unknown',
      missing.join(','),
      missing.map((family) => `typography.fonts.${family}`),
    );
  }

  const assetRefs = Array.from(
    new Set(
      families.flatMap((family) => {
        const record = getAccountFontRecord(fontLibrary, family);
        return record?.source === 'account-asset' ? [record.assetRef] : [];
      }),
    ),
  );
  let assetsByRef: Record<string, unknown> = {};
  if (assetRefs.length) {
    let upstream: Response;
    try {
      upstream = await fetchTokyoAssetControl({
        path: `/__internal/assets/account/${encodeURIComponent(args.accountId)}/resolve`,
        method: 'POST',
        headers: buildTokyoAssetControlHeaders({
          accountId: args.accountId,
          accountCapsule: args.accountCapsule,
          contentType: 'application/json',
          requestId: args.requestId,
        }),
        body: JSON.stringify({ assetRefs }),
      });
    } catch (error) {
      return {
        ok: false,
        status: 502,
        error: {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'roma.errors.proxy.tokyo_unavailable',
          detail: error instanceof Error ? error.message : String(error),
        },
      };
    }
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      if (upstream.status === 422) return validationFailureFromPayload(payload, 'coreui.errors.assets.resolve.failed');
      return {
        ok: false,
        status: 502,
        error: {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'coreui.errors.assets.resolve.failed',
        },
      };
    }
    const resolved = parseExactResolvedAssetPayload({ payload, requestedAssetRefs: assetRefs });
    if (!resolved.ok) return resolved;
    assetsByRef = resolved.assetsByRef;
  }

  const curatedFonts: RuntimeTypographyData['curatedFonts'] = {};
  for (const family of families) {
    const record = getAccountFontRecord(fontLibrary, family);
    if (!record) return validationFailure('coreui.errors.typography.fontFamily.unknown', family);
    if (record.source === 'google') {
      curatedFonts[family] = {
        source: 'google',
        spec: record.spec,
        familyClass: record.familyClass,
        weights: record.weights,
        styles: record.styles,
      };
      continue;
    }
    const resolvedAsset = parseResolvedAccountAsset(assetsByRef[record.assetRef]);
    if (!resolvedAsset) {
      return validationFailure(
        'coreui.errors.typography.fontAsset.missing',
        record.assetRef,
        [`fontLibrary.fonts.${family}.assetRef`],
      );
    }
    curatedFonts[family] = {
      source: 'account-asset',
      url: resolvedAsset.url,
      contentType: record.contentType,
      familyClass: record.familyClass,
      weights: record.weights,
      styles: record.styles,
    };
  }

  return {
    ok: true,
    typographyData: {
      curatedFonts,
    },
  };
}

export async function buildSavedWidgetPublicPackageResult(args: PackageBuildArgs): Promise<
  | { ok: true; value: SavedWidgetPublicPackageBuildResult }
  | InstancePackageFailure
> {
  const result = await materializeRuntimePackage({
    compiled: {
      widgetname: args.compiled.widgetname,
      ...(typeof args.compiled.displayName === 'string' ? { displayName: args.compiled.displayName } : {}),
      ...(args.compiled.editableFields ? { editableFields: args.compiled.editableFields } : {}),
      ...(args.compiled.controls ? { controls: args.compiled.controls } : {}),
      widgetPackage: {
        files: args.compiled.widgetPackage?.files ?? {},
      },
    },
    artifactCoordinate: {
      kind: 'account-instance-widget',
      accountPublicId: args.accountId,
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
      requestedLocale: args.baseLocale,
    },
    displayName: args.displayName,
    state: args.state,
    ...(args.typographyData ? { typographyData: args.typographyData } : {}),
    evidence: {
      sourceReference: `accounts/${args.accountId}/instances/${args.instanceId}/base`,
      sourceFingerprint: await buildMaterializerSourceFingerprint(args),
      schemaWidgetContractFingerprint: buildSchemaWidgetContractFingerprint(args.compiled),
      overlayFingerprint: null,
    },
  });
  if (!result.ok) {
    return materializerFailureToInstancePackageFailure(result.error);
  }
  return { ok: true, value: { package: result.files, evidence: result.evidence } };
}

export async function buildSavedWidgetPublicPackage(args: PackageBuildArgs): Promise<
  | { ok: true; value: SavedWidgetPublicPackage }
  | InstancePackageFailure
> {
  const result = await buildSavedWidgetPublicPackageResult(args);
  if (!result.ok) return result;
  return { ok: true, value: result.value.package };
}

export async function buildSavedWidgetLocalePackageResult(args: LocalePackageBuildArgs): Promise<
  | { ok: true; value: SavedWidgetPublicPackageBuildResult }
  | InstancePackageFailure
> {
  const result = await materializeRuntimePackage({
    compiled: {
      widgetname: args.compiled.widgetname,
      ...(typeof args.compiled.displayName === 'string' ? { displayName: args.compiled.displayName } : {}),
      ...(args.compiled.editableFields ? { editableFields: args.compiled.editableFields } : {}),
      ...(args.compiled.controls ? { controls: args.compiled.controls } : {}),
      widgetPackage: {
        files: args.compiled.widgetPackage?.files ?? {},
      },
    },
    artifactCoordinate: {
      kind: 'account-instance-widget',
      accountPublicId: args.accountId,
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
      requestedLocale: args.requestedLocale,
    },
    displayName: args.displayName,
    state: args.state,
    ...(args.typographyData ? { typographyData: args.typographyData } : {}),
    localeOverlay: {
      locale: args.requestedLocale,
      keyKind: 'current_saved_content_concrete_path',
      values: args.overlayValues,
    },
    evidence: {
      sourceReference: `accounts/${args.accountId}/instances/${args.instanceId}/base`,
      sourceFingerprint: await buildMaterializerSourceFingerprint(args),
      schemaWidgetContractFingerprint: buildSchemaWidgetContractFingerprint(args.compiled),
      overlayFingerprint: await buildLocaleOverlayFingerprint(args),
    },
  });
  if (!result.ok) {
    return materializerFailureToInstancePackageFailure(result.error);
  }
  return { ok: true, value: { package: result.files, evidence: result.evidence } };
}

function validationFailureFromPayload(payload: unknown, fallbackReasonKey: string): InstancePackageFailure {
  const error = isRecord(payload) ? payload.error : null;
  if (isRecord(error) && typeof error.reasonKey === 'string' && error.reasonKey) {
    const detail = typeof error.detail === 'string' && error.detail ? error.detail : undefined;
    const paths = Array.isArray(error.paths)
      ? error.paths.filter((path): path is string => typeof path === 'string' && Boolean(path))
      : undefined;
    return validationFailure(error.reasonKey, detail, paths);
  }
  return validationFailure(fallbackReasonKey);
}

export function parseExactResolvedAssetPayload(args: {
  payload: unknown;
  requestedAssetRefs: string[];
}):
  | { ok: true; assetsByRef: Record<string, unknown> }
  | InstancePackageFailure {
  const invalid = () => validationFailure('coreui.errors.assets.resolve.invalidMaterialization');
  if (!isRecord(args.payload)) return invalid();
  const keys = Object.keys(args.payload);
  if (keys.length !== 1 || keys[0] !== 'assets' || !Array.isArray(args.payload.assets)) return invalid();
  if (args.payload.assets.length !== args.requestedAssetRefs.length) return invalid();

  const requested = new Set(args.requestedAssetRefs);
  const assetsByRef: Record<string, unknown> = {};
  for (const raw of args.payload.assets) {
    const asset = parseResolvedAccountAsset(raw);
    if (!asset || !requested.has(asset.assetRef) || Object.prototype.hasOwnProperty.call(assetsByRef, asset.assetRef)) {
      return invalid();
    }
    assetsByRef[asset.assetRef] = asset;
  }

  if (Object.keys(assetsByRef).length !== requested.size) return invalid();
  return { ok: true, assetsByRef };
}

async function materializePublicPackageMedia(args: {
  accountId: string;
  accountCapsule: string;
  requestId: string;
  config: Record<string, unknown>;
}): Promise<
  | { ok: true; state: Record<string, unknown> }
  | InstancePackageFailure
> {
  const assetRefs = collectConfigMediaAssetRefs(args.config);
  if (!assetRefs.length) return { ok: true, state: args.config };

  let upstream: Response;
  try {
    upstream = await fetchTokyoAssetControl({
      path: `/__internal/assets/account/${encodeURIComponent(args.accountId)}/resolve`,
      method: 'POST',
      headers: buildTokyoAssetControlHeaders({
        accountId: args.accountId,
        accountCapsule: args.accountCapsule,
        contentType: 'application/json',
        requestId: args.requestId,
      }),
      body: JSON.stringify({ assetRefs }),
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'roma.errors.proxy.tokyo_unavailable',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    if (upstream.status === 422) return validationFailureFromPayload(payload, 'coreui.errors.assets.resolve.failed');
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.assets.resolve.failed',
      },
    };
  }

  const resolved = parseExactResolvedAssetPayload({ payload, requestedAssetRefs: assetRefs });
  if (!resolved.ok) return resolved;

  const materialized = materializeConfigMedia(args.config, resolved.assetsByRef);
  if (!isRecord(materialized)) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.assets.resolve.invalidMaterialization',
      },
    };
  }
  return { ok: true, state: materialized };
}

export async function materializeAccountInstancePublicPackage(args: {
  compiled: CompiledWidgetForPublicPackage;
  accountId: string;
  accountCapsule: string;
  requestId: string;
  instanceId: string;
  baseLocale: string;
  displayName: string | null;
  config: Record<string, unknown>;
}): Promise<
  | { ok: true; value: SavedWidgetPublicPackage }
  | InstancePackageFailure
> {
  const materializedMedia = await materializePublicPackageMedia({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
    config: args.config,
  });
  if (!materializedMedia.ok) return materializedMedia;
  const typographyData = await resolveRuntimeTypographyData({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
    state: materializedMedia.state,
  });
  if (!typographyData.ok) return typographyData;

  return buildSavedWidgetPublicPackage({
    compiled: args.compiled,
    accountId: args.accountId,
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    displayName: args.displayName,
    state: materializedMedia.state,
    typographyData: typographyData.typographyData,
  });
}

export async function materializeAccountInstanceLocalePublicPackage(args: {
  compiled: CompiledWidgetForPublicPackage;
  accountId: string;
  accountCapsule: string;
  requestId: string;
  instanceId: string;
  baseLocale: string;
  requestedLocale: string;
  activeLocales: string[];
  displayName: string | null;
  config: Record<string, unknown>;
  overlayValues: Record<string, string>;
}): Promise<
  | { ok: true; value: SavedWidgetPublicPackageBuildResult }
  | InstancePackageFailure
> {
  if (args.requestedLocale === args.baseLocale) {
    return validationFailure('coreui.errors.instance.content.invalid', 'locale_package_base_locale_requested');
  }
  if (!args.activeLocales.includes(args.requestedLocale)) {
    return validationFailure('coreui.errors.instance.content.invalid', 'locale_package_inactive_locale');
  }
  const materializedMedia = await materializePublicPackageMedia({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
    config: args.config,
  });
  if (!materializedMedia.ok) return materializedMedia;
  const typographyData = await resolveRuntimeTypographyData({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
    state: materializedMedia.state,
  });
  if (!typographyData.ok) return typographyData;

  return buildSavedWidgetLocalePackageResult({
    compiled: args.compiled,
    accountId: args.accountId,
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    requestedLocale: args.requestedLocale,
    displayName: args.displayName,
    state: materializedMedia.state,
    typographyData: typographyData.typographyData,
    overlayValues: args.overlayValues,
  });
}
