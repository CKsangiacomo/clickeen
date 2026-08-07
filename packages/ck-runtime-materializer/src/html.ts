import { materializerFailure } from './errors';
import type { RuntimeMaterializerCompiledWidget, RuntimeMaterializerFailure } from './types';

export function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

export function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] || '' : html;
}

function readHtmlAttribute(openingTag: string, attrName: string): string {
  const escapedAttr = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = openingTag.match(
    new RegExp(`\\s${escapedAttr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

export function extractStylesheetSources(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
}

export function stripScripts(body: string): { body: string; scriptSources: string[] } {
  const scriptSources: string[] = [];
  const nextBody = body.replace(
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (_full, src) => {
      scriptSources.push(String(src));
      return '';
    },
  );
  return { body: nextBody, scriptSources };
}

export function stripStylesheetLinks(body: string): string {
  return body.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>\s*/gi, '');
}

export function stampPackageShell(args: {
  html: string;
  widgetType: string;
  instanceId: string;
}): { ok: true; body: string } | RuntimeMaterializerFailure {
  const shells: Array<{
    start: number;
    end: number;
    tag: string;
    widgetType: string;
    insideShell: boolean;
  }> = [];
  const stack: Array<{ tagName: string; isShell: boolean }> = [];
  const voidTags = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'source',
    'track',
    'wbr',
  ]);
  const tagPattern = /<\/?([a-z][\w:-]*)(?:\s[^<>]*)?>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(args.html))) {
    const tag = match[0];
    const tagName = String(match[1] || '').toLowerCase();
    const isClosing = tag.startsWith('</');
    if (isClosing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const popped = stack.pop();
        if (popped?.tagName === tagName) break;
      }
      continue;
    }

    const shellWidgetType = readHtmlAttribute(tag, 'data-ck-widget');
    const classTokens = readHtmlAttribute(tag, 'class').split(/\s+/).filter(Boolean);
    const isShell = Boolean(shellWidgetType) && classTokens.includes('ck-headerLayout');
    const insideShell = stack.some((entry) => entry.isShell);
    if (isShell) {
      shells.push({
        start: match.index,
        end: match.index + tag.length,
        tag,
        widgetType: shellWidgetType,
        insideShell,
      });
    }

    if (!tag.endsWith('/>') && !voidTags.has(tagName)) {
      stack.push({ tagName, isShell });
    }
  }

  const topLevelShells = shells.filter((shell) => !shell.insideShell);
  if (topLevelShells.length !== 1 || topLevelShells[0]?.widgetType !== args.widgetType) {
    return materializerFailure('widget_package_shell_invalid');
  }

  const shell = topLevelShells[0]!;
  const withoutExistingInstanceId = shell.tag.replace(
    /\sdata-ck-instance-id\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,
    '',
  );
  const stampedTag = withoutExistingInstanceId.replace(
    />$/,
    ` data-ck-instance-id="${escapeAttribute(args.instanceId)}">`,
  );
  return {
    ok: true,
    body: `${args.html.slice(0, shell.start)}${stampedTag}${args.html.slice(shell.end)}`,
  };
}

export function buildIndexHtml(args: {
  compiled: RuntimeMaterializerCompiledWidget;
  htmlLocale: string;
  displayName: string | null;
  body: string;
  publicPath: string;
}): string {
  return `<!doctype html>
<html lang="${escapeAttribute(args.htmlLocale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(args.displayName || `${args.compiled.displayName || args.compiled.widgetname} widget`)}</title>
    <script>window.CK_LOCALE_CONTEXT = null;</script>
    <link rel="stylesheet" href="${escapeAttribute(`${args.publicPath}/styles.css`)}" />
  </head>
  <body>
${args.body}
    <script src="${escapeAttribute(`${args.publicPath}/runtime.js`)}" defer></script>
  </body>
</html>
`;
}
