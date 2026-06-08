import { isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import type { LimitsSpec } from '@clickeen/ck-policy';
import {
  WIDGET_SHELL_RUNTIME_MODULE_END,
  WIDGET_SHELL_RUNTIME_PAYLOAD_END,
  WIDGET_SHELL_RUNTIME_PAYLOAD_START,
  WIDGET_SHELL_SOCIAL_SHARE_CSS_MODULE_KEY,
  WIDGET_SHELL_SOCIAL_SHARE_RUNTIME_MODULE_KEY,
  WIDGET_SHELL_STYLE_CHUNK_END,
} from '@clickeen/widget-shell';

export type SavedWidgetPublicPackage = {
  v: 1;
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
  dependencies: {
    instanceIds: string[];
  };
};

export type EmbeddedWidgetPublicPackage = {
  instanceId: string;
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
  limits?: LimitsSpec | null;
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
  embeddedPackages?: EmbeddedWidgetPublicPackage[];
};

const STYLE_CHUNK_END = WIDGET_SHELL_STYLE_CHUNK_END;
const RUNTIME_PAYLOAD_START = WIDGET_SHELL_RUNTIME_PAYLOAD_START;
const RUNTIME_PAYLOAD_END = WIDGET_SHELL_RUNTIME_PAYLOAD_END;
const RUNTIME_MODULE_END = WIDGET_SHELL_RUNTIME_MODULE_END;
const STYLE_MODULE_RE = new RegExp(
  `/\\*\\s*ck-style-module:[^*]*\\*/\\n([\\s\\S]*?)\\n${STYLE_CHUNK_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  'g',
);
const RUNTIME_MODULE_RE = new RegExp(
  `/\\*\\s*ck-runtime-module:[^*]*\\*/\\n([\\s\\S]*?)\\n${RUNTIME_MODULE_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  'g',
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractSplitChildInstanceIds(state: Record<string, unknown>, parentInstanceId: string): string[] {
  const split = isRecord(state.split) ? state.split : null;
  const items = Array.isArray(split?.items) ? split.items : [];
  const ids = new Set<string>();
  items.forEach((item) => {
    if (!isRecord(item) || item.kind !== 'instance') return;
    const instance = isRecord(item.instance) ? item.instance : null;
    const instanceId = typeof instance?.instanceId === 'string' ? instance.instanceId.trim().toUpperCase() : '';
    if (!isCompactInstanceId(instanceId)) {
      throw new Error('coreui.errors.widget.embeddedInstanceInvalid');
    }
    if (instanceId === parentInstanceId) {
      throw new Error('coreui.errors.widget.embeddedInstanceSelfReference');
    }
    ids.add(instanceId);
  });
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function buildPackageDependencies(args: PackageBuildArgs): SavedWidgetPublicPackage['dependencies'] {
  if (args.compiled.widgetname !== 'split') return { instanceIds: [] };
  return {
    instanceIds: extractSplitChildInstanceIds(args.state, args.instanceId),
  };
}

function extractMarkedChunks(args: { body: string; pattern: RegExp }): string[] {
  args.pattern.lastIndex = 0;
  return [...args.body.matchAll(args.pattern)].map((match) => String(match[1] ?? '').trim()).filter(Boolean);
}

function extractRuntimeContribution(runtime: string): { payload: string; modules: string[] } {
  const startIndex = runtime.indexOf(RUNTIME_PAYLOAD_START);
  const endIndex = runtime.indexOf(RUNTIME_PAYLOAD_END);
  if (startIndex < 0 || endIndex < startIndex) {
    throw new Error('coreui.errors.widget.embeddedRuntimeInvalid');
  }
  const payload = runtime.slice(startIndex, endIndex + RUNTIME_PAYLOAD_END.length).trim();
  const modulesSource = `${runtime.slice(0, startIndex)}\n${runtime.slice(endIndex + RUNTIME_PAYLOAD_END.length)}`;
  return {
    payload,
    modules: extractMarkedChunks({ body: modulesSource, pattern: RUNTIME_MODULE_RE }),
  };
}

function extractSingleWidgetRoot(html: string, instanceId: string): { htmlRoot: string; widgetType: string } {
  const roots: Array<{ start: number; end: number; openingTag: string; insideRoot: boolean }> = [];
  const stack: Array<{ tagName: string; isRoot: boolean; start: number; openingTag: string }> = [];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const tagPattern = /<\/?([a-z][\w:-]*)(?:\s[^<>]*)?>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    const tag = match[0];
    const tagName = String(match[1] || '').toLowerCase();
    const isClosing = tag.startsWith('</');
    if (isClosing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const popped = stack.pop();
        if (!popped) break;
        if (popped.tagName !== tagName) continue;
        if (popped.isRoot) {
          roots.push({
            start: popped.start,
            end: match.index + tag.length,
            openingTag: popped.openingTag,
            insideRoot: stack.some((entry) => entry.isRoot),
          });
        }
        break;
      }
      continue;
    }
    const widgetType = readHtmlAttribute(tag, 'data-ck-widget');
    const isRoot = Boolean(widgetType) && readHtmlAttribute(tag, 'data-role') === 'root';
    if (!tag.endsWith('/>') && !voidTags.has(tagName)) {
      stack.push({ tagName, isRoot, start: match.index, openingTag: tag });
    }
  }
  const topLevelRoots = roots.filter((root) => !root.insideRoot);
  if (topLevelRoots.length !== 1) throw new Error('coreui.errors.widget.embeddedRootInvalid');
  const root = topLevelRoots[0]!;
  if (readHtmlAttribute(root.openingTag, 'data-ck-instance-id') !== instanceId) {
    throw new Error('coreui.errors.widget.embeddedRootInvalid');
  }
  return {
    htmlRoot: extractBody(html),
    widgetType: readHtmlAttribute(root.openingTag, 'data-ck-widget'),
  };
}

function embeddedPackageContributions(args: PackageBuildArgs): Array<{
  instanceId: string;
  widgetType: string;
  htmlRoot: string;
  styleChunks: string[];
  runtimePayload: string;
  runtimeModules: string[];
}> {
  const required = new Set(buildPackageDependencies(args).instanceIds);
  const embedded = args.embeddedPackages ?? [];
  return [...required].map((instanceId) => {
    const pkg = embedded.find((entry) => entry.instanceId === instanceId);
    if (!pkg) throw new Error(`coreui.errors.widget.embeddedPackageMissing:${instanceId}`);
    const root = extractSingleWidgetRoot(pkg.indexHtml, instanceId);
    const runtime = extractRuntimeContribution(pkg.runtimeJs);
    return {
      instanceId,
      widgetType: root.widgetType,
      htmlRoot: root.htmlRoot,
      styleChunks: extractMarkedChunks({ body: pkg.stylesCss, pattern: STYLE_MODULE_RE }),
      runtimePayload: runtime.payload,
      runtimeModules: runtime.modules,
    };
  });
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

function extractStylesheetSources(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
}

function stripScripts(body: string): { body: string; scriptSources: string[] } {
  const scriptSources: string[] = [];
  const nextBody = body.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (_full, src) => {
    scriptSources.push(String(src));
    return '';
  });
  return { body: nextBody, scriptSources };
}

function resolveProductPath(widgetType: string, src: string): string | null {
  const withoutQuery = src.split('?')[0] || '';
  if (!withoutQuery || withoutQuery.startsWith('/') || /^https?:\/\//i.test(withoutQuery)) return null;
  const base = `product/widgets/${widgetType}/`;
  const stack = base.split('/').filter(Boolean);
  for (const part of withoutQuery.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  const normalized = stack.join('/');
  return normalized.startsWith('product/widgets/') ? normalized : null;
}

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

function packageSource(args: { compiled: CompiledWidgetForPublicPackage; key: string; fallback?: string }): string {
  return fileSource(args.compiled.widgetPackage?.files[args.key] ?? (args.fallback ? args.compiled.widgetPackage?.files[args.fallback] : undefined));
}

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

function socialShareEnabled(state: Record<string, unknown>): boolean {
  const behavior = isRecord(state.behavior) ? state.behavior : {};
  const socialShare = isRecord(behavior.socialShare) ? behavior.socialShare : {};
  return socialShare.enabled === true;
}

function buildStyles(args: PackageBuildArgs, widgetHtml: string, includeSocialShare: boolean): string {
  const chunks: string[] = [];
  const includedStyleKeys = new Set<string>();
  for (const href of extractStylesheetSources(widgetHtml)) {
    if (href.startsWith('/dieter/')) {
      chunks.push(styleChunk(href, `@import "${href}";`));
      includedStyleKeys.add(href);
      continue;
    }
    const key = resolveProductPath(args.compiled.widgetname, href);
    if (!key || !key.endsWith('.css')) continue;
    const source = packageSource({
      compiled: args.compiled,
      key,
      fallback: key.endsWith('/widget.css') ? 'widget.css' : undefined,
    });
    if (source) {
      chunks.push(styleChunk(key, source));
      includedStyleKeys.add(key);
    }
  }
  if (includeSocialShare && !includedStyleKeys.has(WIDGET_SHELL_SOCIAL_SHARE_CSS_MODULE_KEY)) {
    const source = packageSource({ compiled: args.compiled, key: WIDGET_SHELL_SOCIAL_SHARE_CSS_MODULE_KEY });
    if (source) chunks.push(styleChunk('shared/socialShare.css', source));
  }
  embeddedPackageContributions(args).forEach((entry) => {
    chunks.push(...entry.styleChunks.map((chunk, index) => styleChunk(`embedded/${entry.instanceId}/${index}.css`, chunk)));
  });
  return `${chunks.join('\n\n')}\n`;
}

function buildRuntime(args: PackageBuildArgs, scriptSources: string[], includeSocialShare: boolean): string {
  const embeddedContributions = embeddedPackageContributions(args);
  const embeddedInstances = Object.fromEntries(embeddedContributions.map((entry) => [
    entry.instanceId,
    {
      instanceId: entry.instanceId,
      widgetType: entry.widgetType,
      htmlRoot: entry.htmlRoot,
    },
  ]));
  const locales = { [args.baseLocale]: args.state };
  const localePolicy = {
    baseLocale: args.baseLocale,
    languages: [args.baseLocale],
  };
  const payload = `${RUNTIME_PAYLOAD_START}
(function () {
  var payload = ${JSON.stringify({ instanceId: args.instanceId, baseLocale: args.baseLocale, locales, embeddedInstances })};
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
    locales: payload.locales,
    embeddedInstances: payload.embeddedInstances || {}
  };
})();
${RUNTIME_PAYLOAD_END}`;

  const chunks = [payload];
  let widgetClientChunk: string | null = null;
  const includedRuntimeKeys = new Set<string>();
  for (const src of scriptSources) {
    const key = resolveProductPath(args.compiled.widgetname, src);
    if (!key || !key.endsWith('.js')) continue;
    const source = packageSource({
      compiled: args.compiled,
      key,
      fallback: key.endsWith('/widget.client.js') ? 'widget.client.js' : undefined,
    });
    if (!source) continue;
    const chunk = runtimeModuleChunk(key, source);
    includedRuntimeKeys.add(key);
    if (key.endsWith('/widget.client.js')) {
      widgetClientChunk = chunk;
      continue;
    }
    chunks.push(chunk);
  }
  if (includeSocialShare && !includedRuntimeKeys.has(WIDGET_SHELL_SOCIAL_SHARE_RUNTIME_MODULE_KEY)) {
    const source = packageSource({ compiled: args.compiled, key: WIDGET_SHELL_SOCIAL_SHARE_RUNTIME_MODULE_KEY });
    if (source) chunks.push(runtimeModuleChunk('shared/socialShare.js', source));
  }
  embeddedContributions.forEach((entry) => {
    chunks.push(entry.runtimePayload);
    entry.runtimeModules.forEach((moduleSource, index) => {
      chunks.push(runtimeModuleChunk(`embedded/${entry.instanceId}/${index}.js`, moduleSource));
    });
  });
  if (widgetClientChunk) chunks.push(widgetClientChunk);
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
  const widgetHtml = packageSource({ compiled: args.compiled, key: 'widget.html' });
  if (!args.compiled.widgetPackage || !widgetHtml) {
    throw new Error('coreui.errors.widget.packageMissing');
  }
  const includeSocialShare = socialShareEnabled(args.state);
  const stamped = stampPackageRoot({
    html: extractBody(widgetHtml),
    widgetType: args.compiled.widgetname,
    instanceId: args.instanceId,
  });
  const stripped = stripScripts(stamped);
  return {
    v: 1,
    indexHtml: buildIndexHtml(args, stripped.body),
    stylesCss: buildStyles(args, widgetHtml, includeSocialShare),
    runtimeJs: buildRuntime(args, stripped.scriptSources, includeSocialShare),
    dependencies: buildPackageDependencies(args),
  };
}
