import { materializeResolvedContext } from './context';
import { normalizeDocumentSupportElements, validateFieldMarkers } from './html';
import { applyInstanceSemantics } from './instance-semantics';
import { assembleRuntime, assembleStyles } from './modules';
import { sanitizeInlineRichText } from './richtext';
import { renderStencil } from './stencil-renderer';
import { materializeShell } from './shell';
import type { GenerateInstanceInput, WebCodeFiles } from './types';
import { normalizeLocaleToken } from '@clickeen/l10n';

function requireText(value: unknown, reason: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(reason);
  return value;
}

function validateOverlays(overlays: GenerateInstanceInput['overlays']): void {
  if (overlays === null) return;
  if (!overlays || typeof overlays !== 'object' || Array.isArray(overlays)) {
    throw new Error('ck.web_code.instance_overlays_invalid');
  }
  for (const [locale, overlay] of Object.entries(overlays)) {
    if (!locale.trim() || !overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
      throw new Error(`ck.web_code.instance_overlay_invalid:${locale || 'missing'}`);
    }
    const values = (overlay as { values?: unknown }).values;
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error(`ck.web_code.instance_overlay_invalid:${locale}`);
    }
    for (const [path, value] of Object.entries(values)) {
      if (!path || path.includes('[]') || path.includes('*') || typeof value !== 'string') {
        throw new Error(`ck.web_code.instance_overlay_value_invalid:${locale}:${path || 'missing'}`);
      }
    }
  }
}

export function generateInstance(input: GenerateInstanceInput): WebCodeFiles {
  const definition = input?.definition;
  const widgetType = requireText(definition?.widgetType, 'ck.web_code.widget_type_invalid');
  if (definition.editableFields?.widgetType !== widgetType) {
    throw new Error('ck.web_code.editable_fields_widget_mismatch');
  }
  if (
    typeof input.settings?.seoGeoAeoEnabled !== 'boolean' ||
    typeof input.settings?.includeClickeenAttribution !== 'boolean'
  ) {
    throw new Error('ck.web_code.instance_settings_invalid');
  }
  validateOverlays(input.overlays);
  if (!normalizeLocaleToken(input.baseLocale)) throw new Error('ck.web_code.instance_base_locale_invalid');

  const source = materializeResolvedContext(input.source, input.context);
  const templateContext = {
    ...source,
    generator: {
      settings: input.settings,
      context: input.context,
    },
  };
  const richTextPaths = new Set(
    definition.editableFields.fields
      .filter((field) => field.type === 'richtext')
      .map((field) => field.path),
  );

  const renderedHtml = normalizeDocumentSupportElements(renderStencil(
      requireText(definition.files?.['index.html'], 'ck.web_code.index_source_missing'),
      templateContext,
      {
        rawPathPatterns: richTextPaths,
        strict: true,
        transformRawPathValue: sanitizeInlineRichText,
      },
    ), {
      stylesheetHref: '/__CK_PUBLIC_ACCOUNT_ID__/__CK_PUBLIC_INSTANCE_ID__/styles.css',
      runtimeSrc: '/__CK_PUBLIC_ACCOUNT_ID__/__CK_PUBLIC_INSTANCE_ID__/runtime.js',
    });
  const semanticOutput = applyInstanceSemantics({
    html: renderedHtml,
    definition,
    source,
    settings: input.settings,
  });

  const materialized = materializeShell({
    html: semanticOutput.html,
    stylesCss: assembleStyles(
      [...definition.styleModules, ...semanticOutput.styleModules],
      requireText(definition.files?.['styles.css'], 'ck.web_code.styles_source_missing'),
      widgetType,
    ),
    source,
    overlays: input.overlays,
    baseLocale: input.baseLocale,
    context: input.context,
  });
  validateFieldMarkers(materialized.html);

  return {
    indexHtml: materialized.html,
    stylesCss: materialized.stylesCss,
    runtimeJs: assembleRuntime(
      definition.runtimeModules,
      requireText(definition.files?.['runtime.js'], 'ck.web_code.runtime_source_missing'),
      widgetType,
    ),
  };
}
