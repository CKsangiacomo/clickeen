import {
  readWidgetMaterializerArtifact,
  type WidgetMaterializerArtifact,
} from '@roma/generated/widget-materializer-artifacts';
import {
  collectConfigMediaAssetRefs,
  materializeConfigMedia,
  type ResolvedAccountAsset,
} from '@clickeen/ck-contracts';
import { materializeRuntimePackage } from '@clickeen/ck-runtime-materializer';
import { type RuntimeTypographyData, type WidgetSoftware } from '@clickeen/widget-foundation';
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import { buildTokyoAssetControlHeaders, fetchTokyoAssetControl } from './tokyo-asset-control';
import { resolveTokyoBaseUrl } from './env/tokyo';
import { loadAccountWidgetDefaultsInTokyo } from './account-widget-defaults-direct';

export type SavedWidgetPublicPackage = {
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

export type CompiledWidgetForPublicPackage = {
  widgetname: string;
  discovery: WidgetMaterializerArtifact['discovery'];
  editableFields: WidgetEditableFieldsContract;
  coreDefaults: Record<string, unknown>;
  widgetSoftware: WidgetSoftware;
};

export type InstancePackageFailure = {
  ok: false;
  status: number;
  error: {
    kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
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
  state: Record<string, unknown>;
  typographyData: RuntimeTypographyData;
  discoveryPolicyEnabled: boolean;
};

export type SavedWidgetPublicPackageBuildResult = {
  package: SavedWidgetPublicPackage;
};

export type PreparedAccountInstancePublicPackage = {
  state: Record<string, unknown>;
  typographyData: RuntimeTypographyData;
};

export function readWidgetForInstancePackage(
  widgetType: string,
): CompiledWidgetForPublicPackage {
  return readWidgetMaterializerArtifact(widgetType)!;
}

function collectTypographyFamilies(state: Record<string, unknown>): string[] {
  const typography = state.typography as {
    globalFamily: string;
    roles: Record<string, { family: string }>;
  };
  const families = new Set<string>([
    'Inter',
    typography.globalFamily,
    ...Object.values(typography.roles).map((role) => role.family),
  ]);
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
  if (!defaults.ok) return defaults;

  const fontLibrary = defaults.value.widgetDefaults.fontLibrary;
  const families = collectTypographyFamilies(args.state);

  const assetRefs = Array.from(
    new Set(
      families.flatMap((family) => {
        const record = fontLibrary.fonts[family];
        return record.source === 'account-asset' ? [record.assetRef] : [];
      }),
    ),
  );
  let assetsByRef: Record<string, ResolvedAccountAsset> = {};
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
    const payload = (await upstream.json()) as {
      assets: ResolvedAccountAsset[];
      error: InstancePackageFailure['error'];
    };
    if (!upstream.ok) {
      return {
        ok: false,
        status: upstream.status,
        error: payload.error,
      };
    }
    assetsByRef = Object.fromEntries(payload.assets.map((asset) => [asset.assetRef, asset]));
  }

  const curatedFonts: RuntimeTypographyData['curatedFonts'] = {};
  for (const family of families) {
    const record = fontLibrary.fonts[family];
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
    if (record.source === 'tokyo') {
      curatedFonts[family] = {
        source: 'tokyo',
        url: new URL(record.filePath, `${resolveTokyoBaseUrl()}/`).toString(),
        familyClass: record.familyClass,
        weights: record.weights,
        styles: record.styles,
      };
      continue;
    }
    const resolvedAsset = assetsByRef[record.assetRef];
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

export async function buildSavedWidgetPublicPackageResult(
  args: PackageBuildArgs,
): Promise<{ ok: true; value: SavedWidgetPublicPackageBuildResult } | InstancePackageFailure> {
  const result = await materializeRuntimePackage({
    compiled: {
      widgetname: args.compiled.widgetname,
      discovery: args.compiled.discovery,
      editableFields: args.compiled.editableFields,
      widgetSoftware: args.compiled.widgetSoftware,
    },
    artifactCoordinate: {
      kind: 'account-instance-widget',
      accountPublicId: args.accountId,
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
    },
    state: args.state,
    typographyData: args.typographyData,
    discoveryPolicyEnabled: args.discoveryPolicyEnabled,
  });
  return { ok: true, value: { package: result.files } };
}

export async function buildSavedWidgetPublicPackage(
  args: PackageBuildArgs,
): Promise<{ ok: true; value: SavedWidgetPublicPackage } | InstancePackageFailure> {
  const result = await buildSavedWidgetPublicPackageResult(args);
  if (!result.ok) return result;
  return { ok: true, value: result.value.package };
}

async function materializePublicPackageMedia(args: {
  accountId: string;
  accountCapsule: string;
  requestId: string;
  config: Record<string, unknown>;
}): Promise<{ ok: true; state: Record<string, unknown> } | InstancePackageFailure> {
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

  const payload = (await upstream.json()) as {
    assets: ResolvedAccountAsset[];
    error: InstancePackageFailure['error'];
  };
  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      error: payload.error,
    };
  }

  const assetsByRef = new Map(payload.assets.map((asset) => [asset.assetRef, asset]));
  return {
    ok: true,
    state: materializeConfigMedia(args.config, assetsByRef) as Record<string, unknown>,
  };
}

export async function materializeAccountInstancePublicPackage(args: {
  compiled: CompiledWidgetForPublicPackage;
  accountId: string;
  accountCapsule: string;
  requestId: string;
  instanceId: string;
  baseLocale: string;
  config: Record<string, unknown>;
  discoveryPolicyEnabled: boolean;
}): Promise<{ ok: true; value: SavedWidgetPublicPackage } | InstancePackageFailure> {
  const prepared = await prepareAccountInstancePublicPackage({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
    config: args.config,
  });
  if (!prepared.ok) return prepared;

  return buildSavedWidgetPublicPackage({
    compiled: args.compiled,
    accountId: args.accountId,
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    state: prepared.value.state,
    typographyData: prepared.value.typographyData,
    discoveryPolicyEnabled: args.discoveryPolicyEnabled,
  });
}

export async function prepareAccountInstancePublicPackage(args: {
  accountId: string;
  accountCapsule: string;
  requestId: string;
  config: Record<string, unknown>;
}): Promise<{ ok: true; value: PreparedAccountInstancePublicPackage } | InstancePackageFailure> {
  const materializedMedia = await materializePublicPackageMedia(args);
  if (!materializedMedia.ok) return materializedMedia;
  const typographyData = await resolveRuntimeTypographyData({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
    state: materializedMedia.state,
  });
  if (!typographyData.ok) return typographyData;
  return {
    ok: true,
    value: {
      state: materializedMedia.state,
      typographyData: typographyData.typographyData,
    },
  };
}
