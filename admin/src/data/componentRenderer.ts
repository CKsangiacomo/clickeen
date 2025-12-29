import type { ComponentSource } from './componentTypes';
import { interpolateStencilContext, renderStencil } from './stencilRenderer';

export interface ComponentDoc {
  id: string;
  title: string;
  moduleId: string;
  htmlPath: string;
  html: string;
  css?: string[];
}

type StencilContext = Record<string, unknown>;

type Preview = {
  id: string;
  spec?: string[];
  context?: StencilContext;
  html?: string;
  title?: string;
  sizes?: string[];
  variants?: string[];
  sizeContext?: Record<string, StencilContext>;
};

const wrapPreviewComponents = new Set<string>(['button']);

const resolveContext = (base: StencilContext, overrides: StencilContext): StencilContext =>
  interpolateStencilContext({ ...base, ...overrides });

const renderVariantTiles = (
  componentName: string,
  preview: Preview,
  stencil?: string,
): string | null => {
  const sizeVariants = Array.isArray(preview.sizes) && preview.sizes.length > 0 ? preview.sizes : [undefined];

  let variantValues: (string | undefined)[] = [undefined];

  if (Array.isArray(preview.variants) && preview.variants.length > 0) {
    variantValues = preview.variants;
  } else if (Array.isArray(preview.spec)) {
    const variantRegex = /data-variant=['"]\{\{(\w+)\}\}['"]/;
    const match = preview.spec.find((line) => variantRegex.test(line));
    if (match) {
      const key = variantRegex.exec(match)?.[1];
      if (key) {
        const value = preview.context?.[key];
        if (typeof value === 'string') {
          variantValues = value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
        }
      }
    }
  }

  if (
    variantValues.length === 1 &&
    variantValues[0] === undefined &&
    typeof preview.context?.variant === 'string'
  ) {
    variantValues = [preview.context.variant];
  }

  const rows = variantValues
    .map((variant) => {
      const tiles = sizeVariants
        .map((size) => {
          const sizeOverrides =
            size && preview.sizeContext && typeof preview.sizeContext[size] === 'object'
              ? preview.sizeContext[size]
              : undefined;
          const context = resolveContext(preview.context ?? {}, {
            ...(size ? { size } : {}),
            ...(variant ? { variant } : {}),
            ...(sizeOverrides ?? {}),
          });

          const specLines = Array.isArray(preview.spec)
            ? preview.spec.map((line) => renderStencil(line, context))
            : [];

          let rendered = preview.html ?? '';

          if (!rendered && stencil) {
            rendered = renderStencil(stencil, context);
          }

          if (!rendered) return null;

          const specHtml = specLines
            .map((line) => `<span class="spec-line body-xsmall">${line}</span>`)
            .join('');

          const wrapperClass = wrapPreviewComponents.has(componentName)
            ? 'dieter-component-preview-wrap-wrapper'
            : 'dieter-component-preview-280-wrapper';

          return `
    <div class="${wrapperClass}">
      <div class="spec-wrapper dieter-spec-wrapper">
        ${specHtml}
      </div>
      <div class="dieter-preview">
        ${rendered}
      </div>
    </div>`;
        })
        .filter((html): html is string => Boolean(html))
        .join('');

      if (!tiles) return null;

      return `
    <div class="dieter-component-row" style="margin-bottom:var(--space-4)">
      ${tiles}
    </div>`;
    })
    .filter((html): html is string => Boolean(html))
    .join('');

  return rows || null;
};

export const renderComponentDoc = (source: ComponentSource): ComponentDoc | null => {
  const variantsSource = Array.isArray(source.spec?.defaults)
    ? source.spec.defaults
    : Array.isArray(source.spec?.previews)
      ? source.spec.previews
      : [];
  const previews: Preview[] = variantsSource;

  if (!previews.length) return null;

  const variantsHtml = previews
    .map((preview) => renderVariantTiles(source.name, preview, source.template))
    .filter((html): html is string => Boolean(html));

  if (!variantsHtml.length) return null;

  const pageHtml = `
<div>
  <h1 class="heading-2" style="margin:0">${source.title}</h1>
</div>
<div class="devstudio-page-section">
  ${variantsHtml.join('\n')}
</div>
`;

  return {
    id: source.name,
    title: source.title,
    moduleId: `dieter-new/${source.name}`,
    htmlPath: `dieter-new/${source.name}`,
    html: pageHtml,
    css: source.css ? [source.css] : [],
  };
};
