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
};

type WidgetPackageFileContext = {
  mediaType: 'application/json' | 'text/html' | 'text/css' | 'text/javascript';
  source: string;
};

export type CompiledWidgetForPublicPackage = {
  widgetname: string;
  displayName?: string;
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

function insertBeforeTopLevelRootClose(html: string, markup: string): string {
  const stack: string[] = [];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const tagPattern = /<\/?([a-z][\w:-]*)(?:\s[^<>]*)?>/gi;
  let rootStarted = false;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    const tag = match[0];
    const tagName = String(match[1] || '').toLowerCase();
    const isClosing = tag.startsWith('</');
    if (!rootStarted) {
      const isRoot = !isClosing && Boolean(readHtmlAttribute(tag, 'data-ck-widget')) && readHtmlAttribute(tag, 'data-role') === 'root';
      if (!isRoot) continue;
      rootStarted = true;
      if (!tag.endsWith('/>') && !voidTags.has(tagName)) stack.push(tagName);
      continue;
    }

    if (isClosing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const popped = stack.pop();
        if (popped === tagName) break;
      }
      if (stack.length === 0) {
        return `${html.slice(0, match.index)}${markup}\n${html.slice(match.index)}`;
      }
      continue;
    }

    if (!tag.endsWith('/>') && !voidTags.has(tagName)) stack.push(tagName);
  }
  return html;
}

function socialShareEnabled(state: Record<string, unknown>): boolean {
  const behavior = isRecord(state.behavior) ? state.behavior : {};
  const socialShare = isRecord(behavior.socialShare) ? behavior.socialShare : {};
  return socialShare.enabled === true;
}

function socialShareIcon(name: string): string {
  switch (name) {
    case 'share':
      return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 7.5 12 4l3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 14v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    case 'copy':
      return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 9h9a2 2 0 0 1 2 2v9H11a2 2 0 0 1-2-2V9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    default:
      return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
}

function shareCard(action: string, label: string, iconName = action): string {
  return `<button type="button" class="ck-socialShare__card" data-action="${escapeAttribute(action)}" data-ck-share-label="${escapeAttribute(label)}"><span class="ck-socialShare__icon" aria-hidden="true">${socialShareIcon(iconName)}</span><span class="ck-socialShare__cardLabel">${escapeHtml(label)}</span></button>`;
}

function socialShareMarkup(args: { instanceId: string; widgetType: string; title: string }): string {
  const anchorId = `ck-instance-${args.instanceId.replace(/[^a-z0-9_-]+/gi, '-')}`;
  const messageCards = [
    ['copy', 'Copy link', 'copy'],
    ['sms', 'SMS', 'copy'],
    ['email', 'Email', 'copy'],
    ['whatsapp', 'WhatsApp', 'copy'],
    ['telegram', 'Telegram', 'copy'],
    ['signal', 'Signal', 'copy'],
    ['messenger', 'Messenger', 'copy'],
    ['wechat', 'WeChat', 'copy'],
    ['line', 'LINE', 'copy'],
    ['slack', 'Slack', 'copy'],
    ['teams', 'Teams', 'copy'],
    ['discord', 'Discord', 'copy'],
  ] as const;
  const socialCards = [
    ['x', 'X', 'share'],
    ['linkedin', 'LinkedIn', 'share'],
    ['facebook', 'Facebook', 'share'],
    ['reddit', 'Reddit', 'share'],
    ['instagram', 'Instagram', 'share'],
    ['tiktok', 'TikTok', 'share'],
  ] as const;

  return `<div class="ck-socialShare" data-ck-social-share-root data-ck-share-anchor-id="${escapeAttribute(anchorId)}" data-ck-widget-label="${escapeAttribute(args.title || args.widgetType)}">
  <div class="ck-socialShare__toast" role="status" aria-live="polite"></div>
  <div class="ck-socialShare__topbar">
    <details class="ck-socialShare__details">
      <summary class="ck-socialShare__button"><span class="ck-socialShare__icon" aria-hidden="true">${socialShareIcon('share')}</span><span data-ck-share-copy-key="share">Share</span></summary>
      <div class="ck-socialShare__menu" role="menu" aria-label="Share">
        <div class="ck-socialShare__sectionTitle" data-ck-share-copy-key="sendSection">Send this widget as message</div>
        <div class="ck-socialShare__grid">${messageCards.map(([action, label, icon]) => shareCard(action, label, icon)).join('')}</div>
        <div class="ck-socialShare__sectionTitle" data-ck-share-copy-key="socialSection">Share this widget on social</div>
        <div class="ck-socialShare__grid">${socialCards.map(([action, label, icon]) => shareCard(action, label, icon)).join('')}</div>
      </div>
    </details>
  </div>
</div>`;
}

function buildStyles(args: PackageBuildArgs, widgetHtml: string, includeSocialShare: boolean): string {
  const chunks: string[] = [];
  for (const href of extractStylesheetSources(widgetHtml)) {
    if (href.startsWith('/dieter/')) {
      chunks.push(styleChunk(href, `@import "${href}";`));
      continue;
    }
    const key = resolveProductPath(args.compiled.widgetname, href);
    if (!key || !key.endsWith('.css')) continue;
    const source = packageSource({
      compiled: args.compiled,
      key,
      fallback: key.endsWith('/widget.css') ? 'widget.css' : undefined,
    });
    if (source) chunks.push(styleChunk(key, source));
  }
  if (includeSocialShare) {
    const source = packageSource({ compiled: args.compiled, key: WIDGET_SHELL_SOCIAL_SHARE_CSS_MODULE_KEY });
    if (source) chunks.push(styleChunk('shared/socialShare.css', source));
  }
  return `${chunks.join('\n\n')}\n`;
}

function buildRuntime(args: PackageBuildArgs, scriptSources: string[], includeSocialShare: boolean): string {
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
  for (const src of scriptSources) {
    const key = resolveProductPath(args.compiled.widgetname, src);
    if (!key || !key.endsWith('.js')) continue;
    const source = packageSource({
      compiled: args.compiled,
      key,
      fallback: key.endsWith('/widget.client.js') ? 'widget.client.js' : undefined,
    });
    if (source) chunks.push(runtimeModuleChunk(key, source));
  }
  if (includeSocialShare) {
    const source = packageSource({ compiled: args.compiled, key: WIDGET_SHELL_SOCIAL_SHARE_RUNTIME_MODULE_KEY });
    if (source) chunks.push(runtimeModuleChunk('shared/socialShare.js', source));
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
  const body = includeSocialShare
    ? insertBeforeTopLevelRootClose(stripped.body, socialShareMarkup({
        instanceId: args.instanceId,
        widgetType: args.compiled.widgetname,
        title: args.displayName || args.compiled.displayName || args.compiled.widgetname,
      }))
    : stripped.body;
  return {
    v: 1,
    indexHtml: buildIndexHtml(args, body),
    stylesCss: buildStyles(args, widgetHtml, includeSocialShare),
    runtimeJs: buildRuntime(args, stripped.scriptSources, includeSocialShare),
  };
}
