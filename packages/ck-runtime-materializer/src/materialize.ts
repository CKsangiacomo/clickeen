import { listWidgetFontStylesheets, renderWidgetHtml } from '@clickeen/widget-foundation';
import { buildIndexHtml } from './html';
import { buildRuntime, buildStyles } from './runtime';
import type { RuntimeMaterializerInput, RuntimeMaterializerResult } from './types';

function publicPackagePath(input: RuntimeMaterializerInput): string {
  return `/${encodeURIComponent(input.artifactCoordinate.accountPublicId)}/${encodeURIComponent(input.artifactCoordinate.instanceId)}`;
}

export async function materializeRuntimePackage(
  input: RuntimeMaterializerInput,
): Promise<RuntimeMaterializerResult> {
  const savedDiscoveryEnabled = (
    input.state.behavior as { seoGeo: { enabled: boolean } }
  ).seoGeo.enabled;
  const body = renderWidgetHtml({
    software: input.compiled.widgetSoftware,
    state: input.state,
    editableFields: input.compiled.editableFields,
    context: {
      instanceId: input.artifactCoordinate.instanceId,
      locale: input.artifactCoordinate.baseLocale,
      discoveryEnabled: input.discoveryPolicyEnabled && savedDiscoveryEnabled,
      discovery: input.compiled.discovery,
    },
  });
  const publicPath = publicPackagePath(input);
  return {
    ok: true,
    files: {
      indexHtml: buildIndexHtml({
        compiled: input.compiled,
        htmlLocale: input.artifactCoordinate.baseLocale,
        body,
        publicPath,
        fontStylesheets: listWidgetFontStylesheets({
          state: input.state,
          context: {
            locale: input.artifactCoordinate.baseLocale,
            typographyData: input.typographyData,
          },
        }),
      }),
      stylesCss: buildStyles({
        software: input.compiled.widgetSoftware,
        state: input.state,
        locale: input.artifactCoordinate.baseLocale,
        typographyData: input.typographyData,
      }),
      runtimeJs: buildRuntime(input.compiled.widgetSoftware),
    },
  };
}
