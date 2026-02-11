import type { CompiledPanel, CompiledWidget, WidgetPresets } from './types';
import { RawWidget, parseTooldrawerAttributes, parsePanels } from './compiler.shared';
import { buildWidgetAssets } from './compiler/assets';
import { compileControlsFromPanels, expandTooldrawerClusters, groupKeyToLabel } from './compiler/controls';
import { buildContext, loadComponentStencil, renderComponentStencil } from './compiler/stencils';
import { buildStagePodCornerAppearanceFields, buildStagePodLayoutPanelFields } from './compiler/modules/stagePod';
import {
  buildHeaderAppearancePanelFields,
  buildHeaderContentPanelFields,
  buildHeaderLayoutPanelFields,
  buildHeaderPresets,
} from './compiler/modules/header';
import { buildTypographyPanel } from './compiler/modules/typography';
import { resolveTokyoBaseUrl } from './env/tokyo';

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

const PANEL_SLOT_HEADER_CONTENT = '@slot:header-content';
const PANEL_SLOT_HEADER_CONTENT_NO_CTA = '@slot:header-content-no-cta';
const PANEL_SLOT_HEADER_LAYOUT = '@slot:header-layout';
const PANEL_SLOT_HEADER_LAYOUT_NO_CTA = '@slot:header-layout-no-cta';
const PANEL_SLOT_HEADER_APPEARANCE = '@slot:header-appearance';
const PANEL_SLOT_HEADER_APPEARANCE_NO_CTA = '@slot:header-appearance-no-cta';
const PANEL_SLOT_STAGEPOD_LAYOUT = '@slot:stagepod-layout';
const PANEL_SLOT_STAGEPOD_CORNERS = '@slot:stagepod-corners';

function injectAtSlot(lines: string[], marker: string, fields: string[]): boolean {
  const slotIdx = lines.findIndex((line) => line.includes(marker));
  if (slotIdx < 0) return false;
  lines.splice(slotIdx, 1, ...fields);
  return true;
}

function findPanelStart(lines: string[], panelId: string): number {
  return lines.findIndex((line) => line.includes(`<bob-panel id='${panelId}'>`));
}

function findPanelEnd(lines: string[], panelStart: number): number {
  if (panelStart < 0) return -1;
  return lines.findIndex((line, idx) => idx > panelStart && line.includes('</bob-panel>'));
}

function stripUnusedSlotMarkers(lines: string[]): string[] {
  return lines.filter((line) => !line.includes('@slot:'));
}

function buildHtmlWithGeneratedPanels(widgetJson: RawWidget): string[] {
  const rawHtml = Array.isArray(widgetJson.html) ? widgetJson.html : [];
  const htmlLines: string[] = rawHtml.filter((line): line is string => typeof line === 'string');

  const typography = (widgetJson.defaults as any)?.typography;
  const typographyRoles = typography?.roles;
  const hasStage = (widgetJson.defaults as any)?.stage != null;
  const hasPod = (widgetJson.defaults as any)?.pod != null;
  const hasStageFloating = (widgetJson.defaults as any)?.stage?.floating != null;
  const hasHeader = (widgetJson.defaults as any)?.header != null;
  const hasCta = (widgetJson.defaults as any)?.cta != null;
  const hasHeaderAppearance = (widgetJson.defaults as any)?.appearance != null;

  const filtered: string[] = [];
  let skippingTypography = false;
  htmlLines.forEach((line) => {
    // Strip author-defined typography panel entirely; we'll inject a standardized one.
    if (!skippingTypography && line.includes("<bob-panel id='typography'>")) {
      skippingTypography = true;
      return;
    }
    if (skippingTypography) {
      if (line.includes('</bob-panel>')) {
        skippingTypography = false;
      }
      return;
    }
    // Remove stage/pod layout controls; compiler will inject the shared panel.
    if (line.includes('tooldrawer-field-podstagelayout') || line.includes('Stage/Pod layout')) {
      return;
    }
    filtered.push(line);
  });

  const includesPath = (path: string): boolean => {
    return filtered.some((line) => line.includes(`path='${path}'`) || line.includes(`path=\"${path}\"`));
  };

  // Inject shared Header controls if defaults declare header + cta.
  if (hasHeader && hasCta) {
    const hasHeaderControls = includesPath('header.enabled') || includesPath('header.title');
    const hasHeaderLayoutControls = includesPath('header.placement') || includesPath('header.ctaPlacement');
    const hasHeaderAppearanceControls = includesPath('appearance.ctaBackground') || includesPath('appearance.ctaTextColor');

    if (!hasHeaderControls) {
      const headerFields = buildHeaderContentPanelFields();
      const headerFieldsNoCta = buildHeaderContentPanelFields({ includeCta: false });
      const injectedHeaderFields =
        injectAtSlot(filtered, PANEL_SLOT_HEADER_CONTENT_NO_CTA, headerFieldsNoCta) ||
        injectAtSlot(filtered, PANEL_SLOT_HEADER_CONTENT, headerFields);

      if (!injectedHeaderFields) {
        const contentIdx = findPanelStart(filtered, 'content');
        if (contentIdx >= 0) {
          const contentEndIdx = findPanelEnd(filtered, contentIdx);
          if (contentEndIdx >= 0) {
            const firstObjectManager = filtered.findIndex(
              (line, idx) => idx > contentIdx && idx < contentEndIdx && line.includes("type='object-manager'"),
            );
            if (firstObjectManager >= 0) {
              let insertAt = firstObjectManager;
              for (let idx = firstObjectManager; idx > contentIdx; idx -= 1) {
                if (filtered[idx]?.includes('<tooldrawer-cluster')) {
                  insertAt = idx;
                  break;
                }
              }
              filtered.splice(insertAt, 0, ...headerFields);
            } else {
              filtered.splice(contentEndIdx, 0, ...headerFields);
            }
          }
        } else {
          filtered.push("<bob-panel id='content'>", ...headerFields, '</bob-panel>');
        }
      }
    }

    if (!hasHeaderLayoutControls) {
      const headerLayoutFields = buildHeaderLayoutPanelFields();
      const headerLayoutFieldsNoCta = buildHeaderLayoutPanelFields({ includeCta: false });
      const injectedHeaderLayoutFields =
        injectAtSlot(filtered, PANEL_SLOT_HEADER_LAYOUT_NO_CTA, headerLayoutFieldsNoCta) ||
        injectAtSlot(filtered, PANEL_SLOT_HEADER_LAYOUT, headerLayoutFields);

      if (!injectedHeaderLayoutFields) {
        const layoutIdx = findPanelStart(filtered, 'layout');
        if (layoutIdx >= 0) {
          filtered.splice(layoutIdx + 1, 0, ...headerLayoutFields);
        } else {
          filtered.push("<bob-panel id='layout'>", ...headerLayoutFields, '</bob-panel>');
        }
      }
    }

    if (hasHeaderAppearance && !hasHeaderAppearanceControls) {
      const headerAppearanceFields = buildHeaderAppearancePanelFields();
      const headerAppearanceFieldsNoCta = buildHeaderAppearancePanelFields({ includeCta: false });
      const injectedHeaderAppearanceFields =
        injectAtSlot(filtered, PANEL_SLOT_HEADER_APPEARANCE_NO_CTA, headerAppearanceFieldsNoCta) ||
        injectAtSlot(filtered, PANEL_SLOT_HEADER_APPEARANCE, headerAppearanceFields);

      if (!injectedHeaderAppearanceFields) {
        const appearanceIdx = findPanelStart(filtered, 'appearance');
        if (appearanceIdx >= 0) {
          const appearanceEndIdx = findPanelEnd(filtered, appearanceIdx);
          if (appearanceEndIdx >= 0) filtered.splice(appearanceEndIdx, 0, ...headerAppearanceFields);
          else filtered.push(...headerAppearanceFields);
        } else {
          filtered.push("<bob-panel id='appearance'>", ...headerAppearanceFields, '</bob-panel>');
        }
      }
    }
  }

  // Inject shared Stage/Pod layout panel if defaults declare stage/pod.
  if (hasStage || hasPod) {
    const stagePodFields = buildStagePodLayoutPanelFields({ includeFloating: hasStageFloating });
    if (!injectAtSlot(filtered, PANEL_SLOT_STAGEPOD_LAYOUT, stagePodFields)) {
      const layoutIdx = findPanelStart(filtered, 'layout');
      if (layoutIdx >= 0) {
        const layoutEndIdx = findPanelEnd(filtered, layoutIdx);
        if (layoutEndIdx >= 0) filtered.splice(layoutEndIdx, 0, ...stagePodFields);
        else filtered.push(...stagePodFields);
      } else {
        filtered.push("<bob-panel id='layout'>", ...stagePodFields, '</bob-panel>');
      }
    }
  }

  // Inject Pod corner controls into Appearance (shape is an appearance concern).
  if (hasPod) {
    const cornerFields = buildStagePodCornerAppearanceFields();
    if (cornerFields.length > 0) {
      if (!injectAtSlot(filtered, PANEL_SLOT_STAGEPOD_CORNERS, cornerFields)) {
        const appearanceIdx = findPanelStart(filtered, 'appearance');
        if (appearanceIdx >= 0) {
          const appearanceEndIdx = findPanelEnd(filtered, appearanceIdx);
          if (appearanceEndIdx >= 0) {
            let lastAppearanceField = -1;
            for (let idx = appearanceIdx + 1; idx < appearanceEndIdx; idx += 1) {
              if (filtered[idx]?.includes('tooldrawer-field-podstageappearance')) {
                lastAppearanceField = idx;
              }
            }

            if (lastAppearanceField >= 0) {
              const clusterEndIdx = filtered.findIndex(
                (line, idx) => idx > lastAppearanceField && idx < appearanceEndIdx && line.includes('</tooldrawer-cluster>'),
              );
              if (clusterEndIdx >= 0) {
                filtered.splice(clusterEndIdx, 0, ...cornerFields);
              } else {
                filtered.splice(appearanceEndIdx, 0, "  <tooldrawer-cluster>", ...cornerFields, '  </tooldrawer-cluster>');
              }
            } else {
              filtered.splice(appearanceEndIdx, 0, "  <tooldrawer-cluster>", ...cornerFields, '  </tooldrawer-cluster>');
            }
          }
        }
      }
    }
  }

  // Inject standardized Typography panel if roles are defined.
  if (typographyRoles) {
    const generatedTypography = buildTypographyPanel({ roles: typographyRoles, roleScales: typography?.roleScales });
    const insertAt = filtered.findIndex((line) => line.includes("<bob-panel id='layout'>"));
    if (insertAt >= 0) filtered.splice(insertAt, 0, ...generatedTypography);
    else filtered.push(...generatedTypography);
  }

  return stripUnusedSlotMarkers(filtered);
}

function extractPrimaryUrl(raw: string): string | null {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (/^(?:https?:\/\/|data:|blob:|\/)/i.test(v)) return v;
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
    pathname.startsWith('/workspace-assets/') ||
    pathname.startsWith('/curated-assets/') ||
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
      if (!primaryUrl || /^(?:data|blob):/i.test(primaryUrl)) return;

      if (primaryUrl.startsWith('/')) {
        if (!isTokyoAssetPath(primaryUrl)) return;
        return replacePrimaryUrl(node, `${base}${primaryUrl}`);
      }

      if (/^https?:\/\//i.test(primaryUrl)) {
        try {
          const parsed = new URL(primaryUrl);
          if (!isTokyoAssetPath(parsed.pathname)) return;
          return replacePrimaryUrl(node, `${base}${parsed.pathname}`);
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

  const tokyoBase = resolveTokyoBaseUrl();
  const htmlWithGenerated = buildHtmlWithGeneratedPanels(widgetJson);
  const parsed = parsePanels(htmlWithGenerated);
  const defaultsWithAssets = rewriteAssetUrlsInDefaults(defaults, tokyoBase);

  let themeRegistry: ThemeRegistry | null = null;
  try {
    const themesRes = await fetch(`${tokyoBase}/themes/themes.json`, { cache: 'no-store' });
    if (themesRes.ok) {
      const rawThemes = await themesRes.json();
      const normalized = normalizeThemeRegistry(rawThemes);
      themeRegistry = normalized
        ? (rewriteAssetUrlsInDefaults(normalized as Record<string, unknown>, tokyoBase) as ThemeRegistry)
        : null;
    }
  } catch {
    themeRegistry = null;
  }

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

  const controls = compileControlsFromPanels({
    panels: parsed.panels,
    defaults: defaultsWithAssets,
    optionsByPath: themeOptions ? { 'appearance.theme': themeOptions } : undefined,
  });

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
    assets,
  };
}
