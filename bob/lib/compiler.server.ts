import { isRecord as isPlainObject } from '@clickeen/ck-contracts';
import { COMMON_WIDGET_FACTORY_DEFAULTS } from '@clickeen/widget-foundation';
import type { CompiledPanel, CompiledWidgetCore, WidgetPresets } from './types';
import {
  encodeHtmlEntities,
  parseTooldrawerAttributes,
  parsePanels,
} from './compiler.shared';
import {
  compileControlsFromPanels,
  expandTooldrawerClusters,
} from './compiler/controls';
import { buildEditorHtmlLines } from './compiler/editor-contract';
import { buildContext, renderComponentStencil } from './compiler/stencils';
import type { ComponentStencilLoader } from './compiler/stencils';
import { normalizeWidgetNormalizationSpec } from './compiler/modules/normalization';
import { buildHeaderPresets } from './compiler/modules/header';
import { validateShowIfExpression } from '../components/td-menu-content/showIf';
import type { ResolvedWidgetTooldrawerLabels } from './compiler/tooldrawer-labels';

function extractPrimaryUrl(raw: string): string | null {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (/^(?:https?:\/\/|\/)/i.test(v)) return v;
  const match = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (match && match[2]) return match[2];
  return null;
}

function replacePrimaryUrl(raw: string, nextUrl: string): string {
  const v = String(raw || '');
  const match = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (match && match[2]) return v.replace(match[2], nextUrl);
  return nextUrl;
}

function isTokyoAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith('/assets/account/') ||
    pathname.startsWith('/widgets/') ||
    pathname.startsWith('/dieter/')
  );
}

function rewriteAssetUrlsInDefaults(
  defaults: Record<string, unknown>,
  tokyoBase: string,
): Record<string, unknown> {
  const base = String(tokyoBase || '')
    .trim()
    .replace(/\/+$/, '');
  if (!base) return defaults;
  const next = JSON.parse(JSON.stringify(defaults)) as Record<string, unknown>;

  const visit = (node: unknown): string | void => {
    if (typeof node === 'string') {
      const primaryUrl = extractPrimaryUrl(node);
      if (!primaryUrl) return;
      if (/^(?:data|blob):/i.test(primaryUrl)) {
        throw new Error(
          `[Compiler] Non-persistable asset URL scheme is not supported: ${primaryUrl}`,
        );
      }

      if (primaryUrl.startsWith('/')) {
        if (isTokyoAssetPath(primaryUrl)) {
          return replacePrimaryUrl(node, `${base}${primaryUrl}`);
        }
        return;
      }

      if (/^https?:\/\//i.test(primaryUrl)) {
        try {
          const parsed = new URL(primaryUrl);
          if (isTokyoAssetPath(parsed.pathname)) {
            return replacePrimaryUrl(node, `${base}${parsed.pathname}`);
          }
        } catch {
          return;
        }
      }

      return;
    }

    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        const replaced = visit(node[i]);
        if (typeof replaced === 'string') node[i] = replaced;
      }
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const replaced = visit(value);
      if (typeof replaced === 'string') (node as Record<string, unknown>)[key] = replaced;
    }
  };

  visit(next);
  return next;
}

function cloneJsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function mergeDefaults(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const next = cloneJsonRecord(base);
  for (const [key, value] of Object.entries(override)) {
    const existing = next[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      next[key] = mergeDefaults(existing, value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

function composeWidgetFactoryDefaults(
  coreDefaults: Record<string, unknown>,
): Record<string, unknown> {
  return mergeDefaults(
    COMMON_WIDGET_FACTORY_DEFAULTS as unknown as Record<string, unknown>,
    coreDefaults,
  );
}

function normalizePresets(raw: unknown): WidgetPresets | undefined {
  if (raw == null) return undefined;
  if (!isPlainObject(raw)) throw new Error('[BobCompiler] widget presets must be an object');
  const normalized: WidgetPresets = {};

  for (const [sourcePath, specRaw] of Object.entries(raw)) {
    if (!sourcePath.trim()) throw new Error('[BobCompiler] widget preset source path is missing');
    if (!isPlainObject(specRaw))
      throw new Error(`[BobCompiler] preset "${sourcePath}" must be an object`);
    const valuesRaw = (specRaw as { values?: unknown }).values;
    if (!isPlainObject(valuesRaw))
      throw new Error(`[BobCompiler] preset "${sourcePath}" values must be an object`);

    const values: Record<string, Record<string, unknown>> = {};
    for (const [presetKey, presetValuesRaw] of Object.entries(valuesRaw)) {
      if (!presetKey.trim())
        throw new Error(`[BobCompiler] preset "${sourcePath}" has an empty preset key`);
      if (!isPlainObject(presetValuesRaw)) {
        throw new Error(
          `[BobCompiler] preset "${sourcePath}.${presetKey}" values must be an object`,
        );
      }
      if (Object.keys(presetValuesRaw).length === 0) {
        throw new Error(`[BobCompiler] preset "${sourcePath}.${presetKey}" values cannot be empty`);
      }
      values[presetKey] = presetValuesRaw;
    }

    if (Object.keys(values).length === 0)
      throw new Error(`[BobCompiler] preset "${sourcePath}" values cannot be empty`);
    const customValue = (specRaw as { customValue?: unknown }).customValue;
    if (customValue != null && (typeof customValue !== 'string' || !customValue.trim())) {
      throw new Error(
        `[BobCompiler] preset "${sourcePath}" customValue must be a non-empty string`,
      );
    }
    normalized[sourcePath] = {
      ...(typeof customValue === 'string' ? { customValue: customValue.trim() } : {}),
      values,
    };
  }

  return Object.keys(normalized).length ? normalized : undefined;
}

export async function compileWidgetServer(
  resolved: ResolvedWidgetTooldrawerLabels,
  sources: {
    loadComponentStencil: ComponentStencilLoader;
    tokyoBaseUrl?: string;
  },
): Promise<CompiledWidgetCore> {
  const resolvedWidget = resolved.widget;

  const coreDefaults = resolvedWidget.defaults;
  if (!coreDefaults || typeof coreDefaults !== 'object' || Array.isArray(coreDefaults)) {
    throw new Error('[BobCompiler] widget JSON missing defaults object');
  }

  const rawWidgetName = resolvedWidget.widgetname;
  const widgetname =
    typeof rawWidgetName === 'string' && rawWidgetName.trim() ? rawWidgetName : null;
  if (!widgetname) {
    throw new Error('[BobCompiler] widget JSON missing widgetname');
  }

  const displayName =
    typeof resolvedWidget.displayName === 'string' ? resolvedWidget.displayName.trim() : '';
  if (!displayName) {
    throw new Error(`[BobCompiler] ${widgetname} widget JSON missing displayName`);
  }
  const normalization = normalizeWidgetNormalizationSpec(resolvedWidget.normalization);

  const defaults = composeWidgetFactoryDefaults(coreDefaults as Record<string, unknown>);

  const tokyoBase = sources.tokyoBaseUrl ?? '';
  const stencilLoader = sources.loadComponentStencil;
  const editorHtml = buildEditorHtmlLines(resolvedWidget.editor, defaults, widgetname);
  const parsedPanels = parsePanels(editorHtml, resolved.panelLabels);
  const defaultsWithAssets = rewriteAssetUrlsInDefaults(defaults, tokyoBase);

  const hasHeader = defaults.header != null;
  const hasCta = defaults.headerCta != null;
  const headerPresets = hasHeader && hasCta ? buildHeaderPresets() : undefined;

  const presetsRaw = normalizePresets(resolvedWidget.presets);
  const presetsBase = {
    ...(headerPresets ?? {}),
    ...(presetsRaw ?? {}),
  };
  const presetsFinal = Object.keys(presetsBase).length > 0 ? presetsBase : undefined;
  const presets = presetsFinal
    ? (rewriteAssetUrlsInDefaults(
        presetsFinal as Record<string, unknown>,
        tokyoBase,
      ) as WidgetPresets)
    : undefined;

  const controls = compileControlsFromPanels({
    panels: parsedPanels,
    defaults: defaultsWithAssets,
  });

  const renderedPanels: CompiledPanel[] = await Promise.all(
    parsedPanels.map(async (panel) => {
      let html = panel.html;
      html = expandTooldrawerClusters(html, panel.id);

      // Allow '>' inside quoted values and handle both self-closing and open/close forms.
      const tdRegex =
        /<tooldrawer-field(?:-([a-z0-9-]+))?((?:[^>"']|"[^"]*"|'[^']*')*)(?:\/>|>([\s\S]*?)<\/tooldrawer-field>)/gi;

      let out = '';
      let cursor = 0;
      tdRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = tdRegex.exec(html)) !== null) {
        const index = match.index ?? 0;
        out += html.slice(cursor, index);

        const fullMatch = match[0];
        const groupKey = match[1];
        const attrsRaw = match[2] || '';
        const attrs = parseTooldrawerAttributes(attrsRaw);
        const type = attrs.type;
        if (!type) {
          out += fullMatch;
          cursor = tdRegex.lastIndex;
          continue;
        }

        const { stencil, spec } = await stencilLoader(type);
        const context = await buildContext(type, attrs, spec, stencilLoader);
        let rendered = renderComponentStencil(stencil, context);
        if (context.path) {
          const path = encodeHtmlEntities(String(context.path));
          rendered = rendered.replaceAll(
            `data-path="${path}"`,
            `data-path="${path}" data-bob-path="${path}"`,
          );
        }

        const showIf = attrs['show-if'] || '';
        if (showIf) validateShowIfExpression(showIf);
        const wrappers: string[] = [];
        const shouldWrapGroup = Boolean(groupKey);
        if (shouldWrapGroup && groupKey) {
          const rawGroupLabel = attrs['group-label'] ?? attrs.groupLabel;
          const label = rawGroupLabel ?? '';
          wrappers.push(
            `data-bob-group="${encodeHtmlEntities(groupKey)}"`,
            `data-bob-group-label="${encodeHtmlEntities(label)}"`,
          );
        }
        if (showIf) wrappers.push(`data-bob-showif="${encodeHtmlEntities(showIf)}"`);

        out += wrappers.length > 0 ? `<div ${wrappers.join(' ')}>${rendered}</div>` : rendered;
        cursor = tdRegex.lastIndex;
      }
      out += html.slice(cursor);
      html = out;

      return {
        id: panel.id,
        label: panel.label,
        html,
      };
    }),
  );

  return {
    widgetname,
    displayName,
    defaults: defaultsWithAssets,
    toolDrawerLabels: resolved.toolDrawerLabels,
    panels: renderedPanels,
    controls,
    ...(presets ? { presets } : {}),
    ...(normalization ? { normalization } : {}),
  };
}
