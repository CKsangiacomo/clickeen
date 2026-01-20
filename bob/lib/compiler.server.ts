import type { CompiledPanel, CompiledWidget } from './types';
import { RawWidget, parseTooldrawerAttributes, parsePanels } from './compiler.shared';
import { buildWidgetAssets } from './compiler/assets';
import { compileControlsFromPanels, expandTooldrawerClusters, groupKeyToLabel } from './compiler/controls';
import { buildContext, loadComponentStencil, renderComponentStencil } from './compiler/stencils';
import { buildStagePodCornerAppearanceFields, buildStagePodLayoutPanelFields } from './compiler/modules/stagePod';
import { buildTypographyPanel } from './compiler/modules/typography';
import { resolveTokyoBaseUrl } from './env/tokyo';

function buildHtmlWithGeneratedPanels(widgetJson: RawWidget): string[] {
  const rawHtml = Array.isArray(widgetJson.html) ? widgetJson.html : [];
  const htmlLines: string[] = rawHtml.filter((line): line is string => typeof line === 'string');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typography = (widgetJson.defaults as any)?.typography;
  const typographyRoles = typography?.roles;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasStage = (widgetJson.defaults as any)?.stage != null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasPod = (widgetJson.defaults as any)?.pod != null;

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

  // Inject shared Stage/Pod layout panel if defaults declare stage/pod.
  if (hasStage || hasPod) {
    const stagePodFields = buildStagePodLayoutPanelFields();
    const layoutIdx = filtered.findIndex((line) => line.includes("<bob-panel id='layout'>"));
    if (layoutIdx >= 0) {
      const layoutEndIdx = filtered.findIndex((line, idx) => idx > layoutIdx && line.includes('</bob-panel>'));
      if (layoutEndIdx >= 0) filtered.splice(layoutEndIdx, 0, ...stagePodFields);
      else filtered.push(...stagePodFields);
    } else {
      filtered.push("<bob-panel id='layout'>", ...stagePodFields, '</bob-panel>');
    }
  }

  // Inject Pod corner controls into Appearance (shape is an appearance concern).
  if (hasPod) {
    const cornerFields = buildStagePodCornerAppearanceFields();
    if (cornerFields.length > 0) {
      const appearanceIdx = filtered.findIndex((line) => line.includes("<bob-panel id='appearance'>"));
      if (appearanceIdx >= 0) {
        const appearanceEndIdx = filtered.findIndex((line, idx) => idx > appearanceIdx && line.includes('</bob-panel>'));
        if (appearanceEndIdx >= 0) {
          const eyebrowIdx = filtered.findIndex(
            (line, idx) =>
              idx > appearanceIdx && idx < appearanceEndIdx && line.includes("tooldrawer-eyebrow text='Stage/Pod appearance'"),
          );

          if (eyebrowIdx >= 0) {
            const clusterEndIdx = filtered.findIndex(
              (line, idx) => idx > eyebrowIdx && idx < appearanceEndIdx && line.includes('</tooldrawer-cluster>'),
            );
            if (clusterEndIdx >= 0) {
              filtered.splice(clusterEndIdx, 0, ...cornerFields);
            } else {
              filtered.splice(
                appearanceEndIdx,
                0,
                "  <tooldrawer-cluster>",
                "    <tooldrawer-eyebrow text='Stage/Pod appearance' />",
                ...cornerFields,
                '  </tooldrawer-cluster>',
              );
            }
          } else {
            filtered.splice(
              appearanceEndIdx,
              0,
              "  <tooldrawer-cluster>",
              "    <tooldrawer-eyebrow text='Stage/Pod appearance' />",
              ...cornerFields,
              '  </tooldrawer-cluster>',
            );
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

  return filtered;
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

function isTokyoAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith('/workspace-assets/') ||
    pathname.startsWith('/curated-assets/') ||
    pathname.startsWith('/widgets/') ||
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

  const htmlWithGenerated = buildHtmlWithGeneratedPanels(widgetJson);
  const parsed = parsePanels(htmlWithGenerated);
  const defaultsWithAssets = rewriteAssetUrlsInDefaults(defaults, resolveTokyoBaseUrl());
  const controls = compileControlsFromPanels({ panels: parsed.panels, defaults: defaultsWithAssets });

  const panels: CompiledPanel[] = parsed.panels.map((panel) => {
    return panel;
  });

  const renderedPanels: CompiledPanel[] = await Promise.all(
    panels.map(async (panel) => {
      let html = panel.html;

      if (/<tooldrawer-divider\b/i.test(html)) {
        throw new Error('[BobCompiler] <tooldrawer-divider /> is not supported; use <tooldrawer-cluster> only');
      }

      // Expand simple eyebrow tag to overline text.
      html = html.replace(/<tooldrawer-eyebrow([^>]*)\/>/gi, (_full, attrsRaw: string) => {
        const attrs = parseTooldrawerAttributes(attrsRaw || '');
        const text = attrs.text || '';
        return `<div class="overline td-eyebrow" style="padding-inline: var(--control-padding-inline);">${text}</div>`;
      });

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
        const context = await buildContext(type, attrs, spec);
        let rendered = renderComponentStencil(stencil, context);
        if (context.path) {
          rendered = rendered.replace(/data-path="/g, 'data-bob-path="');
          if (!/data-bob-path="/.test(rendered)) {
            rendered = rendered.replace(/<input([^>]*?)(\/?)>/, `<input$1 data-bob-path="${context.path}"$2>`);
          }
        }

        const showIf = attrs['show-if'];
        const wrappers: string[] = [];
        const shouldWrapGroup = groupKey && !['podstagelayout', 'podstageappearance'].includes(groupKey);
        if (shouldWrapGroup && groupKey) {
          const label = groupKeyToLabel(groupKey);
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
    assets,
  };
}
