import {
  WIDGET_SHELL_RUNTIME_MODULE_END,
  WIDGET_SHELL_STYLE_CHUNK_END,
} from '@clickeen/widget-shell';
import { escapeHtml, extractBody, readWidgetRootStyle, withoutSupportElements } from './html';
import { renderPageSemanticHead } from './page-semantics';
import { renderTypographyFontStyleModule, TYPOGRAPHY_FONT_STYLE_MODULE_ID } from './shell';
import type {
  GeneratePageInput,
  GeneratePageOutput,
  PagePlacementInput,
  PageServingOverlays,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireText(value: unknown, reason: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(reason);
  return value;
}

function widgetTypeForPlacement(placement: PagePlacementInput): string {
  return requireText(placement.source.widgetType, `ck.web_code.page_widget_type_missing:${placement.placementId}`);
}

type MarkedChunk = { id: string; source: string };

function readMarkedChunks(args: {
  source: string;
  kind: 'style' | 'runtime';
  endMarker: string;
}): MarkedChunk[] {
  const start = new RegExp(`/\\* ck-${args.kind}-module:([^*]+) \\*/`, 'g');
  const chunks: MarkedChunk[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = start.exec(args.source))) {
    if (args.source.slice(cursor, match.index).trim()) {
      throw new Error(`ck.web_code.page_${args.kind}_chunks_invalid`);
    }
    const endIndex = args.source.indexOf(args.endMarker, start.lastIndex);
    if (endIndex < 0) throw new Error(`ck.web_code.page_${args.kind}_chunks_invalid`);
    const chunkEnd = endIndex + args.endMarker.length;
    chunks.push({
      id: requireText(match[1], `ck.web_code.page_${args.kind}_chunk_id_invalid`),
      source: args.source.slice(match.index, chunkEnd),
    });
    cursor = chunkEnd;
    start.lastIndex = chunkEnd;
  }
  if (!chunks.length || args.source.slice(cursor).trim()) {
    throw new Error(`ck.web_code.page_${args.kind}_chunks_invalid`);
  }
  return chunks;
}

function collectFirstUseChunks(args: {
  placements: PagePlacementInput[];
  kind: 'style' | 'runtime';
  omitIds?: Set<string>;
}): string {
  const endMarker = args.kind === 'style'
    ? WIDGET_SHELL_STYLE_CHUNK_END
    : WIDGET_SHELL_RUNTIME_MODULE_END;
  const byId = new Map<string, string>();
  args.placements.forEach((placement) => {
    const source = args.kind === 'style' ? placement.files.stylesCss : placement.files.runtimeJs;
    readMarkedChunks({ source, kind: args.kind, endMarker }).forEach((chunk) => {
      if (args.omitIds?.has(chunk.id.trim())) return;
      const current = byId.get(chunk.id);
      if (current && current !== chunk.source) {
        throw new Error(`ck.web_code.page_${args.kind}_module_inconsistent:${chunk.id}`);
      }
      if (!current) byId.set(chunk.id, chunk.source);
    });
  });
  const ordered = [...byId.entries()].sort(([left], [right]) => {
    const leftFont = left.trim() === 'generated/typography-fonts.css';
    const rightFont = right.trim() === 'generated/typography-fonts.css';
    return leftFont === rightFont ? 0 : leftFont ? -1 : 1;
  });
  return `${ordered.map(([, source]) => source).join('\n\n')}\n`;
}

function pagePlacementBootstrap(): string {
  return `/* ck-runtime-module:page-placement-init */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  document.querySelectorAll('[data-ck-placement-id]').forEach(function (host) {
    if (!(host instanceof HTMLElement) || !host.shadowRoot) {
      throw new Error('[Clickeen Page] Missing declarative shadow root');
    }
    var widgetRoot = host.shadowRoot.querySelector('[data-ck-widget][data-role="root"]');
    if (!(widgetRoot instanceof HTMLElement)) {
      throw new Error('[Clickeen Page] Missing Widget root');
    }
    var widgetType = widgetRoot.getAttribute('data-ck-widget') || '';
    var initializer = window.CK_WIDGET_INITIALIZERS && window.CK_WIDGET_INITIALIZERS[widgetType];
    if (typeof initializer !== 'function') {
      throw new Error('[Clickeen Page] Missing Widget initializer for ' + widgetType);
    }
    initializer(widgetRoot);
  });
})();
${WIDGET_SHELL_RUNTIME_MODULE_END}`;
}

function orderedPlacements(input: GeneratePageInput): PagePlacementInput[] {
  const byId = new Map<string, PagePlacementInput>();
  input.placements.forEach((placement) => {
    if (!placement || !placement.placementId || byId.has(placement.placementId)) {
      throw new Error('ck.web_code.page_placement_invalid');
    }
    byId.set(placement.placementId, placement);
  });
  const ordered = input.source.placements.map((coordinate) => {
    const placement = byId.get(coordinate.placementId);
    if (!placement || placement.instanceId !== coordinate.instanceId) {
      throw new Error(`ck.web_code.page_placement_missing:${coordinate.placementId}`);
    }
    return placement;
  });
  if (ordered.length !== byId.size) throw new Error('ck.web_code.page_placement_unexpected');
  return ordered;
}

function pageOverlays(input: GeneratePageInput, placements: PagePlacementInput[]): PageServingOverlays | undefined {
  if (input.source.isTemplate) {
    if (input.settingsLocales.length || Object.keys(input.pageOverlays).length) {
      throw new Error('ck.web_code.page_template_locale_invalid');
    }
    return undefined;
  }

  const seen = new Set<string>();
  const output: PageServingOverlays = {};
  input.settingsLocales.forEach((locale) => {
    const normalized = typeof locale === 'string' ? locale.trim() : '';
    if (!normalized || seen.has(normalized)) throw new Error('ck.web_code.page_locale_invalid');
    seen.add(normalized);
    if (normalized === input.source.baseLocale) return;
    const pageOverlay = input.pageOverlays[normalized];
    if (!pageOverlay) return;
    if (!isRecord(pageOverlay.values)) {
      throw new Error(`ck.web_code.page_overlay_missing:${normalized}`);
    }
    const placementValues: Record<string, Record<string, unknown>> = {};
    placements.forEach((placement) => {
      const overlay = placement.overlays?.[normalized];
      if (overlay && !isRecord(overlay.values)) {
        throw new Error(`ck.web_code.page_placement_overlay_invalid:${placement.placementId}:${normalized}`);
      }
      const values = overlay?.values ?? {};
      for (const [path, value] of Object.entries(values)) {
        if (!path || path.includes('[]') || path.includes('*') || typeof value !== 'string') {
          throw new Error(`ck.web_code.page_placement_overlay_invalid:${placement.placementId}:${normalized}`);
        }
      }
      placementValues[placement.placementId] = { ...values };
    });
    output[normalized] = {
      page: { ...pageOverlay.values },
      placements: placementValues,
    };
  });
  for (const locale of Object.keys(input.pageOverlays)) {
    if (!seen.has(locale) || locale === input.source.baseLocale) {
      throw new Error(`ck.web_code.page_overlay_unexpected:${locale}`);
    }
  }
  return output;
}

function renderPlacement(placement: PagePlacementInput): string {
  const widgetType = widgetTypeForPlacement(placement);
  const body = withoutSupportElements(extractBody(placement.files.indexHtml)).replace(
    /\s*<div\b[^>]*class=["'][^"']*\bck-locale-switcher\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    '',
  );
  const style = readWidgetRootStyle(body);
  const styleAttribute = style ? ` style="${escapeHtml(style)}"` : '';
  return `    <section data-ck-placement-id="${escapeHtml(placement.placementId)}" data-ck-instance-id="${escapeHtml(placement.instanceId)}" data-ck-widget="${escapeHtml(widgetType)}"${styleAttribute}>
      <template shadowrootmode="open">
        <link rel="stylesheet" href="./styles.css" />
${body}
      </template>
    </section>`;
}

function renderPageIndex(
  input: GeneratePageInput,
  placements: PagePlacementInput[],
  publicLocales: string[],
): string {
  if (input.source.robots !== 'index-follow' && input.source.robots !== 'noindex-follow') {
    throw new Error('ck.web_code.page_robots_invalid');
  }
  const language = input.source.isTemplate ? '' : ` lang="${escapeHtml(input.source.baseLocale)}"`;
  return `<!doctype html>
<html${language}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
${renderPageSemanticHead(input, placements, publicLocales)}
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body data-ck-composed-page="true">
${placements.map(renderPlacement).join('\n')}
    <script src="./runtime.js" defer></script>
  </body>
</html>
`;
}

export function generatePage(input: GeneratePageInput): GeneratePageOutput {
  if (!input || !input.source || !Array.isArray(input.settingsLocales) || !isRecord(input.pageOverlays)) {
    throw new Error('ck.web_code.page_input_invalid');
  }
  if (
    !isRecord(input.context) ||
    !isRecord(input.context.assetsByRef) ||
    !isRecord(input.context.typography) ||
    !isRecord(input.context.typography.curatedFonts)
  ) {
    throw new Error('ck.web_code.context_invalid');
  }
  const placements = orderedPlacements(input);
  placements.forEach((placement) => {
    widgetTypeForPlacement(placement);
    requireText(placement.files.stylesCss, `ck.web_code.page_styles_missing:${placement.placementId}`);
    requireText(placement.files.runtimeJs, `ck.web_code.page_runtime_missing:${placement.placementId}`);
    if (!placement.files.stylesCss.includes(`/* ck-style-module:${TYPOGRAPHY_FONT_STYLE_MODULE_ID} */`)) {
      throw new Error(`ck.web_code.page_typography_font_module_missing:${placement.placementId}`);
    }
  });

  const overlaysJson = pageOverlays(input, placements);
  const typographyFontModule = renderTypographyFontStyleModule(
    placements.map((placement) => placement.source),
    input.context,
  );
  const files = {
    indexHtml: renderPageIndex(
      input,
      placements,
      input.source.isTemplate
        ? []
        : [input.source.baseLocale, ...Object.keys(overlaysJson ?? {})],
    ),
    stylesCss: `${typographyFontModule}${collectFirstUseChunks({ placements, kind: 'style', omitIds: new Set([TYPOGRAPHY_FONT_STYLE_MODULE_ID]) })}`,
    runtimeJs: `${collectFirstUseChunks({ placements, kind: 'runtime' }).trimEnd()}\n\n${pagePlacementBootstrap()}\n`,
  };
  return overlaysJson ? { files, overlaysJson } : { files };
}
