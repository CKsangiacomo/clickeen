import type { ComponentSource } from './componentTypes';

export interface ComponentDoc {
  id: string;
  title: string;
  moduleId: string;
  htmlPath: string;
  html: string;
  css?: string[];
}

type TemplateContext = Record<string, unknown>;

interface RuntimeContext extends Record<string, unknown> {
  __parent?: RuntimeContext;
}

type Preview = {
  id: string;
  spec?: string[];
  context?: TemplateContext;
  html?: string;
  title?: string;
  sizes?: string[];
  variants?: string[];
  sizeContext?: Record<string, TemplateContext>;
};

const wrapPreviewComponents = new Set<string>(['button']);

const withParent = (context: RuntimeContext, parent?: RuntimeContext): RuntimeContext => ({
  ...context,
  __parent: parent,
});

const resolveValue = (key: string, context?: RuntimeContext): unknown => {
  if (!context) return undefined;
  if (key.startsWith('../')) {
    return resolveValue(key.slice(3), context.__parent);
  }
  if (Object.prototype.hasOwnProperty.call(context, key)) {
    return context[key];
  }
  return resolveValue(key, context.__parent);
};

const renderTemplate = (template: string, context: RuntimeContext): string => {
  let output = template;

  output = output.replace(/{{#each (\w+)}}([\s\S]*?){{\/each}}/g, (_match, key, block) => {
    const value = resolveValue(key, context);
    if (!Array.isArray(value)) return '';
    return value
      .map((item) => {
        const childContext =
          typeof item === 'object' && item !== null
            ? (item as RuntimeContext)
            : ({ this: item } as RuntimeContext);
        return renderTemplate(block, withParent(childContext, context));
      })
      .join('');
  });

  output = output.replace(/{{#if ([^}]+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g, (_match, key, truthy, falsy) => {
    const value = resolveValue(key, context);
    if (value && value !== 'false' && value !== '0') {
      return renderTemplate(truthy, context);
    }
    return falsy ? renderTemplate(falsy, context) : '';
  });

  output = output.replace(/{{#unless ([^}]+)}}([\s\S]*?){{\/unless}}/g, (_match, key, block) => {
    const value = resolveValue(key, context);
    if (value) return '';
    return renderTemplate(block, context);
  });

  output = output.replace(/{{([^}]+)}}/g, (_match, key) => {
    const value = resolveValue(key, context);
    if (value === undefined || value === null) return '';
    return String(value);
  });

  // Clean up unmatched moustache helpers that may remain after rendering
  output = output
    .replace(/{{\/(?:if|unless)}}/g, '')
    .replace(/{{#if [^}]+}}/g, '');

  return output;
};

const resolveContext = (base: TemplateContext, overrides: TemplateContext): TemplateContext => {
  const merged: TemplateContext = { ...base, ...overrides };
  const placeholderRegex = /{{(\w+)}}/g;
  Object.entries(merged).forEach(([key, value]) => {
    if (typeof value !== 'string') return;
    merged[key] = value.replace(placeholderRegex, (_match, token) => {
      const replacement = merged[token];
      return typeof replacement === 'string' ? replacement : '';
    });
  });
  return merged;
};

const renderVariantTiles = (
  componentName: string,
  preview: Preview,
  template?: string,
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


          const runtimeContext = withParent(context as RuntimeContext);

          const specLines = Array.isArray(preview.spec)
            ? preview.spec.map((line) => renderTemplate(line, runtimeContext))
            : [];

          let rendered = preview.html ?? '';

          if (!rendered && template) {
            rendered = renderTemplate(template, runtimeContext);
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
