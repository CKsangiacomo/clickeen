import type { RuntimeMaterializerCompiledWidget } from './types';

export function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

export function extractBody(html: string): string {
  return html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)![1]!;
}

export function extractStylesheetSources(html: string): string[] {
  return [
    ...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi),
  ].map((match) => match[1]!);
}

export function stripScripts(body: string): { body: string; scriptSources: string[] } {
  const scriptSources: string[] = [];
  return {
    body: body.replace(
      /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
      (_script, source) => {
        scriptSources.push(source);
        return '';
      },
    ),
    scriptSources,
  };
}

export function buildIndexHtml(args: {
  compiled: RuntimeMaterializerCompiledWidget;
  htmlLocale: string;
  body: string;
  publicPath: string;
  fontStylesheets: string[];
}): string {
  return `<!doctype html>
<html lang="${escapeAttribute(args.htmlLocale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(args.compiled.discovery.baseline.title)}</title>
    <meta name="description" content="${escapeAttribute(args.compiled.discovery.baseline.description)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${args.fontStylesheets.map((href) => `    <link rel="stylesheet" href="${escapeAttribute(href)}" />`).join('\n')}
    <link rel="stylesheet" href="${escapeAttribute(`${args.publicPath}/styles.css`)}" />
  </head>
  <body>
${args.body}
    <script src="${escapeAttribute(`${args.publicPath}/runtime.js`)}" defer></script>
  </body>
</html>
`;
}
