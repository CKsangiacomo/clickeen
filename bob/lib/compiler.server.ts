import type { CompiledPanel, CompiledWidget } from './types';
import { RawWidget, parseTooldrawerAttributes, parsePanels } from './compiler.shared';
import { buildWidgetAssets } from './compiler/assets';
import { compileControlsFromPanels, expandTooldrawerClusters, groupKeyToLabel } from './compiler/controls';
import { buildContext, loadComponentStencil, renderComponentStencil } from './compiler/stencils';
import { buildStagePodPanelFields } from './compiler/modules/stagePod';
import { buildTypographyPanel } from './compiler/modules/typography';

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
    const stagePodFields = buildStagePodPanelFields();
    const layoutIdx = filtered.findIndex((line) => line.includes("<bob-panel id='layout'>"));
    if (layoutIdx >= 0) {
      const layoutEndIdx = filtered.findIndex((line, idx) => idx > layoutIdx && line.includes('</bob-panel>'));
      if (layoutEndIdx >= 0) filtered.splice(layoutEndIdx, 0, ...stagePodFields);
      else filtered.push(...stagePodFields);
    } else {
      filtered.push("<bob-panel id='layout'>", ...stagePodFields, '</bob-panel>');
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

export function compileWidgetServer(widgetJson: RawWidget): CompiledWidget {
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
  const controls = compileControlsFromPanels({ panels: parsed.panels, defaults });

  const panels: CompiledPanel[] = parsed.panels.map((panel) => {
    let html = panel.html;

    if (/<tooldrawer-divider\b/i.test(html)) {
      throw new Error('[BobCompiler] <tooldrawer-divider /> is not supported; use <tooldrawer-cluster> only');
    }

    // Expand simple eyebrow tag to overline text.
    html = html.replace(/<tooldrawer-eyebrow([^>]*)\/>/gi, (_full, attrsRaw: string) => {
      const attrs = parseTooldrawerAttributes(attrsRaw || '');
      const text = attrs.text || '';
      return `<div class="overline" style="padding-inline: var(--control-padding-inline);">${text}</div>`;
    });

    // Expand spacing-only clusters (grouping controls for better rhythm).
    html = expandTooldrawerClusters(html);

    // Allow '>' inside quoted values and handle both self-closing and open/close forms.
    const tdRegex =
      /<tooldrawer-field(?:-([a-z0-9-]+))?((?:[^>"']|"[^"]*"|'[^']*')*)(?:\/>|>([\s\S]*?)<\/tooldrawer-field>)/gi;
    html = html.replace(tdRegex, (fullMatch: string, groupKey: string | undefined, attrsRaw: string) => {
      const attrs = parseTooldrawerAttributes(attrsRaw);
      const type = attrs.type;
      if (!type) return fullMatch;

      const { stencil, spec } = loadComponentStencil(type);
      const context = buildContext(type, attrs, spec);
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

      return wrappers.length > 0 ? `<div ${wrappers.join(' ')}>${rendered}</div>` : rendered;
    });

    return {
      id: panel.id,
      label: panel.label,
      html,
    };
  });

  const assets = buildWidgetAssets({ widgetname, usages: parsed.usages });

  return {
    widgetname,
    displayName,
    defaults,
    panels,
    controls,
    assets,
  };
}
