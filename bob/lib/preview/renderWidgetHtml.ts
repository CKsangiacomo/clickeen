import { renderFaqPage } from '../../../venice/lib/renderers/faq';

type Device = 'desktop' | 'mobile';
type Theme = 'light' | 'dark';

type RenderOptions = {
  widgetname: string;
  widgetJSON: Record<string, unknown>;
  instanceData: Record<string, unknown>;
  publicId: string;
  device: Device;
  theme: Theme;
  backlink?: boolean;
};

type PageRenderer = (options: {
  instanceData: Record<string, unknown>;
  publicId: string;
  device: Device;
  theme: Theme;
  backlink: boolean;
}) => string;

const PAGE_RENDERERS: Record<string, PageRenderer> = {
  faq: ({ instanceData, publicId, device, theme, backlink }) =>
    renderFaqPage({
      instance: { publicId, config: instanceData },
      theme,
      device,
      backlink,
      nonce: 'preview',
    }),
};

function injectIntoHead(html: string, payload: string): string {
  if (!payload.trim()) return html;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${payload}\n</head>`);
  }
  return `<head>${payload}</head>${html}`;
}

function injectIntoBody(html: string, payload: string): string {
  if (!payload.trim()) return html;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${payload}\n</body>`);
  }
  return `${html}${payload}`;
}

export function renderWidgetHtml({
  widgetname,
  widgetJSON,
  instanceData,
  publicId,
  device,
  theme,
  backlink = true,
}: RenderOptions): string {
  const renderer = PAGE_RENDERERS[widgetname];
  if (!renderer) {
    throw new Error(`Preview renderer not implemented for widget "${widgetname}"`);
  }

  let result = renderer({ instanceData, publicId, device, theme, backlink });

  const cssBlocks = Array.isArray(widgetJSON?.css) ? widgetJSON.css.join('\n') : '';
  const renderDef = (widgetJSON['widget.render'] ?? {}) as Record<string, unknown>;
  const clientJs = Array.isArray(renderDef?.clientJS)
    ? (renderDef.clientJS as string[]).join('\n')
    : '';

  if (cssBlocks) {
    result = injectIntoHead(result, `<style data-widget-css>\n${cssBlocks}\n</style>`);
  }

  if (clientJs) {
    result = injectIntoBody(result, `<script data-widget-client="true">\n${clientJs}\n</script>`);
  }

  return result;
}
