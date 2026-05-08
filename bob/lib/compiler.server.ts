import type { CompiledPanel, CompiledWidget, WidgetPresets } from './types';
import { RawWidget, parseTooldrawerAttributes, parsePanels } from './compiler.shared';
import { buildWidgetAssets } from './compiler/assets';
import { compileControlsFromPanels, expandTooldrawerClusters, groupKeyToLabel } from './compiler/controls';
import { buildEditorHtmlLines } from './compiler/editor-contract';
import { buildContext, loadComponentStencil, renderComponentStencil } from './compiler/stencils';
import { normalizeWidgetNormalizationSpec } from './compiler/modules/normalization';
import { buildHeaderPresets } from './compiler/modules/header';
import { resolveTokyoBaseUrl } from './env/tokyo';
import themesJson from '../../tokyo/product/themes/themes.json';

function findTagEnd(source: string, startIndex: number): number {
  let quote: '"' | "'" | null = null;
  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

function stripLeadingPanelEyebrow(html: string): string {
  const clusterTag = '<tooldrawer-cluster';
  const eyebrowTag = '<tooldrawer-eyebrow';
  const lower = html.toLowerCase();
  const clusterStart = lower.indexOf(clusterTag);
  if (clusterStart === -1) return html;

  const clusterOpenEnd = findTagEnd(html, clusterStart + clusterTag.length);
  if (clusterOpenEnd === -1) return html;

  let cursor = clusterOpenEnd + 1;
  while (cursor < html.length && /\s/.test(html[cursor])) cursor += 1;
  if (!html.slice(cursor, cursor + eyebrowTag.length).toLowerCase().startsWith(eyebrowTag)) return html;

  const eyebrowEnd = findTagEnd(html, cursor + eyebrowTag.length);
  if (eyebrowEnd === -1) return html;

  let after = eyebrowEnd + 1;
  while (after < html.length && /\s/.test(html[after])) after += 1;
  return html.slice(0, cursor) + html.slice(after);
}

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTokyoAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith('/assets/account/') ||
    pathname.startsWith('/widgets/') ||
    pathname.startsWith('/themes/') ||
    pathname.startsWith('/dieter/')
  );
}

function rewriteAssetUrlsInDefaults(defaults: Record<string, unknown>, tokyoBase: string): Record<string, unknown> {
  const base = String(tokyoBase || '').trim().replace(/\/+$/, '');
  if (!base) return defaults;
  const next = JSON.parse(JSON.stringify(defaults)) as Record<string, unknown>;

  const visit = (node: unknown): string | void => {
    if (typeof node === 'string') {
      const primaryUrl = extractPrimaryUrl(node);
      if (!primaryUrl) return;
      if (/^(?:data|blob):/i.test(primaryUrl)) {
        throw new Error(`[Compiler] Non-persistable asset URL scheme is not supported: ${primaryUrl}`);
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

function normalizePresets(raw: unknown): WidgetPresets | undefined {
  if (!isPlainObject(raw)) return undefined;
  const normalized: WidgetPresets = {};

  for (const [sourcePath, specRaw] of Object.entries(raw)) {
    if (!sourcePath || !isPlainObject(specRaw)) continue;
    const valuesRaw = (specRaw as { values?: unknown }).values;
    if (!isPlainObject(valuesRaw)) continue;

    const values: Record<string, Record<string, unknown>> = {};
    for (const [presetKey, presetValuesRaw] of Object.entries(valuesRaw)) {
      if (!presetKey || !isPlainObject(presetValuesRaw)) continue;
      values[presetKey] = presetValuesRaw;
    }

    if (Object.keys(values).length === 0) continue;
    const customValue = (specRaw as { customValue?: unknown }).customValue;
    normalized[sourcePath] = {
      ...(typeof customValue === 'string' && customValue.trim() ? { customValue: customValue.trim() } : {}),
      values,
    };
  }

  return Object.keys(normalized).length ? normalized : undefined;
}

type ThemeRegistry = {
  version?: number;
  themes: Array<{
    id: string;
    label: string;
    values: Record<string, unknown>;
  }>;
};

function normalizeThemeRegistry(raw: unknown): ThemeRegistry | null {
  if (!isPlainObject(raw)) return null;
  const themesRaw = (raw as ThemeRegistry).themes;
  if (!Array.isArray(themesRaw)) return null;

  const themes: ThemeRegistry['themes'] = [];
  const seen = new Set<string>();
  themesRaw.forEach((theme) => {
    if (!theme || typeof theme !== 'object') return;
    const id = typeof (theme as any).id === 'string' ? (theme as any).id.trim() : '';
    const label = typeof (theme as any).label === 'string' ? (theme as any).label.trim() : '';
    const values = (theme as any).values;
    if (!id || !label || !isPlainObject(values) || seen.has(id)) return;
    seen.add(id);
    themes.push({ id, label, values });
  });

  return themes.length ? { version: (raw as any).version, themes } : null;
}

function filterThemeValues(values: Record<string, unknown>): Record<string, unknown> {
  const allowed = ['stage.', 'pod.', 'appearance.', 'typography.'];
  const filtered: Record<string, unknown> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (!key || typeof key !== 'string') return;
    if (!allowed.some((prefix) => key.startsWith(prefix))) return;
    filtered[key] = value;
  });
  return filtered;
}

function buildThemeOptions(themes: ThemeRegistry['themes']): Array<{ label: string; value: string }> {
  return [{ label: 'Custom', value: 'custom' }, ...themes.map((theme) => ({ label: theme.label, value: theme.id }))];
}

function buildThemePresets(themes: ThemeRegistry['themes']): WidgetPresets {
  const values: Record<string, Record<string, unknown>> = {};
  themes.forEach((theme) => {
    values[theme.id] = filterThemeValues(theme.values);
  });
  return {
    'appearance.theme': {
      customValue: 'custom',
      values,
    },
  };
}

export async function compileWidgetServer(widgetJson: RawWidget): Promise<CompiledWidget> {
  if (!widgetJson || typeof widgetJson !== 'object') {
    throw new Error('[BobCompiler] Invalid widget JSON payload');
  }

  const defaults = widgetJson.defaults;
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
    throw new Error('[BobCompiler] widget JSON missing defaults object');
  }

  const rawWidgetName = widgetJson.widgetname;
  const widgetname = typeof rawWidgetName === 'string' && rawWidgetName.trim() ? rawWidgetName : null;
  if (!widgetname) {
    throw new Error('[BobCompiler] widget JSON missing widgetname');
  }

  const displayName = (typeof widgetJson.displayName === 'string' && widgetJson.displayName.trim()) || widgetname;
  const rawItemKey = widgetJson.itemKey;
  const itemKey = typeof rawItemKey === 'string' && rawItemKey.trim() ? rawItemKey.trim() : null;
  const normalization = normalizeWidgetNormalizationSpec(widgetJson.normalization);

  const tokyoBase = resolveTokyoBaseUrl();
  const editorHtml = buildEditorHtmlLines(widgetJson.editor, defaults, widgetname);
  const parsed = parsePanels(editorHtml);
  const defaultsWithAssets = rewriteAssetUrlsInDefaults(defaults, tokyoBase);

  const normalizedThemes = normalizeThemeRegistry(themesJson);
  if (!normalizedThemes) {
    throw new Error('[BobCompiler] Local theme registry is missing or malformed');
  }
  const themeRegistry = rewriteAssetUrlsInDefaults(normalizedThemes as Record<string, unknown>, tokyoBase) as ThemeRegistry;

  const themeOptions = themeRegistry ? buildThemeOptions(themeRegistry.themes) : undefined;
  const themePresets = themeRegistry ? buildThemePresets(themeRegistry.themes) : undefined;

  const hasHeader = (widgetJson.defaults as any)?.header != null;
  const hasCta = (widgetJson.defaults as any)?.cta != null;
  const headerPresets = hasHeader && hasCta ? buildHeaderPresets() : undefined;

  const presetsRaw = normalizePresets(widgetJson.presets);
  const presetsBase = {
    ...(headerPresets ?? {}),
    ...(presetsRaw ?? {}),
  };
  const presetsMerged = themePresets ? { ...presetsBase, ...themePresets } : presetsBase;
  const presetsFinal = Object.keys(presetsMerged).length > 0 ? presetsMerged : undefined;
  const presets = presetsFinal
    ? (rewriteAssetUrlsInDefaults(presetsFinal as Record<string, unknown>, tokyoBase) as WidgetPresets)
    : undefined;

  const controls = [
    ...compileControlsFromPanels({
      panels: parsed.panels,
      defaults: defaultsWithAssets,
      optionsByPath: themeOptions ? { 'appearance.theme': themeOptions } : undefined,
    }),
  ];

  const panels: CompiledPanel[] = parsed.panels.map((panel) => {
    return panel;
  });

  const widgetContext = {
    itemKey,
    themeOptions,
    themeSourcePath: 'appearance.theme',
    themeApplyLabel: 'Apply theme',
    themeCancelLabel: 'Cancel',
  };

  const renderedPanels: CompiledPanel[] = await Promise.all(
    panels.map(async (panel) => {
      let html = panel.html;
      html = stripLeadingPanelEyebrow(html);

      if (/<tooldrawer-divider\b/i.test(html)) {
        throw new Error('[BobCompiler] <tooldrawer-divider /> is not supported; use <tooldrawer-cluster> only');
      }

      // Strip eyebrow tags; panel headers should not use eyebrow text.
      html = html.replace(/<tooldrawer-eyebrow[^>]*\/>/gi, '');

      // Expand spacing-only clusters (grouping controls for better rhythm).
      html = expandTooldrawerClusters(html);

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

        const { stencil, spec } = await loadComponentStencil(type);
        const context = await buildContext(type, attrs, spec, widgetContext);
        let rendered = renderComponentStencil(stencil, context);
        if (context.path) {
          rendered = rendered.replace(/data-path="/g, 'data-bob-path="');
          if (!/data-bob-path="/.test(rendered)) {
            rendered = rendered.replace(/<input([^>]*?)(\/?)>/, `<input$1 data-bob-path="${context.path}"$2>`);
          }
        }

        const showIf = attrs['show-if'];
        const wrappers: string[] = [];
        const shouldWrapGroup = Boolean(groupKey);
        if (shouldWrapGroup && groupKey) {
          const rawGroupLabel = attrs['group-label'] ?? attrs.groupLabel;
          const label = rawGroupLabel !== undefined ? rawGroupLabel : groupKeyToLabel(groupKey);
          wrappers.push(`data-bob-group="${groupKey}"`, `data-bob-group-label="${label}"`);
        }
        if (showIf) wrappers.push(`data-bob-showif="${showIf}"`);

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

  const assets = await buildWidgetAssets({
    widgetname,
    requiredUsages: parsed.usages.required,
    optionalUsages: parsed.usages.optional,
  });

  return {
    widgetname,
    displayName,
    defaults: defaultsWithAssets,
    panels: renderedPanels,
    controls,
    ...(presets ? { presets } : {}),
    ...(normalization ? { normalization } : {}),
    assets,
  };
}
