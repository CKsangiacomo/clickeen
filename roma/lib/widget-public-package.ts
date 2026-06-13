import type { LimitsSpec } from '@clickeen/ck-policy';
import {
  WIDGET_SHELL_CSS_MODULE_KEYS,
  WIDGET_SHELL_RUNTIME_MODULE_KEYS,
  WIDGET_SHELL_RUNTIME_MODULE_END,
  WIDGET_SHELL_RUNTIME_PAYLOAD_END,
  WIDGET_SHELL_RUNTIME_PAYLOAD_START,
  WIDGET_SHELL_STYLE_CHUNK_END,
} from '@clickeen/widget-shell';

export type SavedWidgetPublicPackage = {
  v: 1;
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

type WidgetPackageFileContext = {
  mediaType: 'application/json' | 'text/html' | 'text/css' | 'text/javascript';
  source: string;
};

export type CompiledWidgetForPublicPackage = {
  widgetname: string;
  displayName?: string;
  limits: LimitsSpec;
  widgetPackage?: {
    files: Partial<Record<string, WidgetPackageFileContext>>;
  };
};

type PackageBuildArgs = {
  compiled: CompiledWidgetForPublicPackage;
  instanceId: string;
  baseLocale: string;
  displayName: string | null;
  state: Record<string, unknown>;
};

const STYLE_CHUNK_END = WIDGET_SHELL_STYLE_CHUNK_END;
const RUNTIME_PAYLOAD_START = WIDGET_SHELL_RUNTIME_PAYLOAD_START;
const RUNTIME_PAYLOAD_END = WIDGET_SHELL_RUNTIME_PAYLOAD_END;
const RUNTIME_MODULE_END = WIDGET_SHELL_RUNTIME_MODULE_END;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fileSource(file: WidgetPackageFileContext | undefined): string {
  return typeof file?.source === 'string' ? file.source : '';
}

function escapeHtml(raw: string): string {
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

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] || '' : html;
}

function readHtmlAttribute(openingTag: string, attrName: string): string {
  const escapedAttr = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = openingTag.match(new RegExp(`\\s${escapedAttr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function extractDieterStylesheetSources(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*>/gi)].filter((match) => readHtmlAttribute(match[0], 'rel').toLowerCase() === 'stylesheet').map((match) => readHtmlAttribute(match[0], 'href')).filter(Boolean);
}

function stripScripts(body: string): string { return body.replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi, ''); }

function chunkMarkerId(value: string): string {
  const sourceNeutral = value
    .replace(/^product\/widgets\//, '')
    .replace(/\/widget\./g, '/widget-')
    .replace(/\.\.\//g, '')
    .replace(/^\/+/, '');
  return sourceNeutral.replace(/[^A-Za-z0-9_.:-]+/g, '-');
}

function styleChunk(id: string, body: string): string {
  return `/* ck-style-module:${chunkMarkerId(id)} */\n${body}\n${STYLE_CHUNK_END}`;
}

function runtimeModuleChunk(id: string, body: string): string {
  return `/* ck-runtime-module:${chunkMarkerId(id)} */\n${body}\n${RUNTIME_MODULE_END}`;
}

function widgetPackageBuildError(reasonKey: string, path: string): never { throw { kind: 'WIDGET_PUBLIC_PACKAGE_ERROR', reasonKey, paths: [path] }; }

export function isWidgetPublicPackageBuildError(value: unknown): value is { reasonKey: string; paths: string[] } { return isRecord(value) && value.kind === 'WIDGET_PUBLIC_PACKAGE_ERROR' && typeof value.reasonKey === 'string' && Array.isArray(value.paths); }

function stampPackageRoot(args: {
  html: string;
  widgetType: string;
  instanceId: string;
}): string {
  const roots: Array<{ start: number; end: number; tag: string; widgetType: string; insideRoot: boolean }> = [];
  const stack: Array<{ tagName: string; isRoot: boolean }> = [];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
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

    const rootWidgetType = readHtmlAttribute(tag, 'data-ck-widget');
    const isRoot = Boolean(rootWidgetType) && readHtmlAttribute(tag, 'data-role') === 'root';
    const insideRoot = stack.some((entry) => entry.isRoot);
    if (isRoot) {
      roots.push({ start: match.index, end: match.index + tag.length, tag, widgetType: rootWidgetType, insideRoot });
    }

    if (!tag.endsWith('/>') && !voidTags.has(tagName)) {
      stack.push({ tagName, isRoot });
    }
  }

  const topLevelRoots = roots.filter((root) => !root.insideRoot);
  if (topLevelRoots.length !== 1 || topLevelRoots[0]?.widgetType !== args.widgetType) {
    throw new Error('coreui.errors.widget.packageRootInvalid');
  }

  const root = topLevelRoots[0];
  const withoutExistingInstanceId = root.tag.replace(/\sdata-ck-instance-id\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '');
  const stampedTag = withoutExistingInstanceId.replace(/>$/, ` data-ck-instance-id="${escapeAttribute(args.instanceId)}">`);
  return `${args.html.slice(0, root.start)}${stampedTag}${args.html.slice(root.end)}`;
}

function buildStyles(args: PackageBuildArgs, widgetHtml: string): string {
  const chunks: string[] = [];
  for (const href of extractDieterStylesheetSources(widgetHtml).filter((href) => href.startsWith('/dieter/'))) {
    chunks.push(styleChunk(href, `@import "${href}";`));
  }
  for (const key of [...WIDGET_SHELL_CSS_MODULE_KEYS, `product/widgets/${args.compiled.widgetname}/widget.css`]) {
    const source = fileSource(args.compiled.widgetPackage?.files[key]) || widgetPackageBuildError('coreui.errors.widget.packageMissing', key);
    chunks.push(styleChunk(key, source));
  }
  return `${chunks.join('\n\n')}\n`;
}

function buildRuntime(args: PackageBuildArgs): string {
  const locales = { [args.baseLocale]: args.state };
  const localePolicy = {
    baseLocale: args.baseLocale,
    languages: [args.baseLocale],
  };
  const payload = `${RUNTIME_PAYLOAD_START}
(function () {
  var payload = ${JSON.stringify({ instanceId: args.instanceId, baseLocale: args.baseLocale, locales })};
  var params = new URLSearchParams(window.location.search || '');
  var requestedLocale = String(params.get('locale') || '').toLowerCase();
  var selectedLocale = Object.prototype.hasOwnProperty.call(payload.locales, requestedLocale)
    ? requestedLocale
    : payload.baseLocale;
  var selectedState = payload.locales[selectedLocale];
  if (!selectedState || typeof selectedState !== 'object') {
    throw new Error('[Clickeen] Missing saved widget state for ' + payload.instanceId + ' / ' + selectedLocale);
  }
  window.CK_LOCALE_POLICY = Object.assign({}, window.CK_LOCALE_POLICY || {}, ${JSON.stringify(localePolicy)});
  window.CK_WIDGETS = Object.assign({}, window.CK_WIDGETS || {});
  window.CK_WIDGETS[payload.instanceId] = {
    instanceId: payload.instanceId,
    locale: selectedLocale,
    baseLocale: payload.baseLocale,
    state: selectedState,
    locales: payload.locales
  };
})();
${RUNTIME_PAYLOAD_END}`;

  const chunks = [payload];
  for (const key of [...WIDGET_SHELL_RUNTIME_MODULE_KEYS, `product/widgets/${args.compiled.widgetname}/widget.client.js`]) {
    const source = fileSource(args.compiled.widgetPackage?.files[key]) || widgetPackageBuildError('coreui.errors.widget.packageMissing', key);
    chunks.push(runtimeModuleChunk(key, source));
  }
  return `${chunks.join('\n\n')}\n`;
}

function buildIndexHtml(args: PackageBuildArgs, body: string): string {
  return `<!doctype html>
<html lang="${escapeAttribute(args.baseLocale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(args.displayName || `${args.compiled.displayName || args.compiled.widgetname} widget`)}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
${body}
    <script src="./runtime.js" defer></script>
  </body>
</html>
`;
}

export function buildSavedWidgetPublicPackage(args: PackageBuildArgs): SavedWidgetPublicPackage {
  const widgetHtml = fileSource(args.compiled.widgetPackage?.files['widget.html']) || widgetPackageBuildError('coreui.errors.widget.packageMissing', 'widget.html');
  const stamped = stampPackageRoot({
    html: extractBody(widgetHtml),
    widgetType: args.compiled.widgetname,
    instanceId: args.instanceId,
  });
  const stripped = stripScripts(stamped);
  return {
    v: 1,
    indexHtml: buildIndexHtml(args, stripped),
    stylesCss: buildStyles(args, widgetHtml),
    runtimeJs: buildRuntime(args),
  };
}
