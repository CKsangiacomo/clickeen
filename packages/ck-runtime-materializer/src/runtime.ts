import {
  WIDGET_SHELL_RUNTIME_MODULE_END,
  WIDGET_SHELL_RUNTIME_PAYLOAD_END,
  WIDGET_SHELL_RUNTIME_PAYLOAD_START,
  WIDGET_SHELL_STYLE_CHUNK_END,
} from '@clickeen/widget-shell';
import { extractStylesheetSources } from './html';
import {
  chunkMarkerId,
  packageSource,
  resolveProductPath,
  SOCIAL_SHARE_CSS_MODULE_KEY,
  SOCIAL_SHARE_RUNTIME_MODULE_KEY,
} from './files';
import { materializerFailure } from './errors';
import type { RuntimeMaterializerCompiledWidget, RuntimeMaterializerFailure } from './types';
import type { RuntimeTypographyData } from '@clickeen/widget-shell';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function styleChunk(id: string, body: string): string {
  return `/* ck-style-module:${chunkMarkerId(id)} */\n${body}\n${WIDGET_SHELL_STYLE_CHUNK_END}`;
}

export function runtimeModuleChunk(id: string, body: string): string {
  return `/* ck-runtime-module:${chunkMarkerId(id)} */\n${body}\n${WIDGET_SHELL_RUNTIME_MODULE_END}`;
}

export function socialShareEnabled(state: Record<string, unknown>): boolean {
  const behavior = isRecord(state.behavior) ? state.behavior : {};
  const socialShare = isRecord(behavior.socialShare) ? behavior.socialShare : {};
  return socialShare.enabled === true;
}

export function buildStyles(args: {
  compiled: RuntimeMaterializerCompiledWidget;
  widgetHtml: string;
  includeSocialShare: boolean;
}): { ok: true; stylesCss: string } | RuntimeMaterializerFailure {
  const chunks: string[] = [];
  const includedStyleKeys = new Set<string>();
  for (const href of extractStylesheetSources(args.widgetHtml)) {
    if (href.startsWith('/dieter/')) {
      chunks.push(styleChunk(href, `@import "${href}";`));
      includedStyleKeys.add(href);
      continue;
    }
    const key = resolveProductPath(args.compiled.widgetname, href);
    if (!key || !key.endsWith('.css')) continue;
    const source = packageSource({ compiled: args.compiled, key });
    if (!source) return materializerFailure('widget_package_file_missing', key, [key]);
    chunks.push(styleChunk(key, source));
    includedStyleKeys.add(key);
  }
  if (args.includeSocialShare && !includedStyleKeys.has(SOCIAL_SHARE_CSS_MODULE_KEY)) {
    const source = packageSource({ compiled: args.compiled, key: SOCIAL_SHARE_CSS_MODULE_KEY });
    if (source) chunks.push(styleChunk('shared/socialShare.css', source));
  }
  return { ok: true, stylesCss: `${chunks.join('\n\n')}\n` };
}

export function buildRuntime(args: {
  compiled: RuntimeMaterializerCompiledWidget;
  scriptSources: string[];
  includeSocialShare: boolean;
  instanceId: string;
  baseLocale: string;
  requestedLocale: string;
  locales: Record<string, Record<string, unknown>>;
  typographyData?: RuntimeTypographyData;
}): { ok: true; runtimeJs: string } | RuntimeMaterializerFailure {
  const localePolicy = {
    baseLocale: args.baseLocale,
    languages: Object.keys(args.locales),
  };
  const selectedLocaleExpression =
    args.requestedLocale === args.baseLocale ? 'payload.baseLocale' : JSON.stringify(args.requestedLocale);
  const payload = `${WIDGET_SHELL_RUNTIME_PAYLOAD_START}
(function () {
  var payload = ${JSON.stringify({ instanceId: args.instanceId, baseLocale: args.baseLocale, locales: args.locales })};
  var selectedLocale = ${selectedLocaleExpression};
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
${WIDGET_SHELL_RUNTIME_PAYLOAD_END}`;

  const chunks = [payload];
  if (args.typographyData) {
    chunks.push(runtimeModuleChunk(
      'shared/accountTypographyData.js',
      `(function () {
  if (typeof window === 'undefined') return;
  window.CK_WIDGET_TYPOGRAPHY_DATA = Object.freeze(${JSON.stringify(args.typographyData)});
})();`,
    ));
  }
  let widgetClientChunk: string | null = null;
  const includedRuntimeKeys = new Set<string>();
  for (const src of args.scriptSources) {
    const key = resolveProductPath(args.compiled.widgetname, src);
    if (!key || !key.endsWith('.js')) continue;
    if (args.typographyData && key === 'product/widgets/shared/typography-data.js') continue;
    const source = packageSource({ compiled: args.compiled, key });
    if (!source) return materializerFailure('widget_package_file_missing', key, [key]);
    const chunk = runtimeModuleChunk(key, source);
    includedRuntimeKeys.add(key);
    if (key.endsWith('/widget.client.js')) {
      widgetClientChunk = chunk;
      continue;
    }
    chunks.push(chunk);
  }
  if (args.includeSocialShare && !includedRuntimeKeys.has(SOCIAL_SHARE_RUNTIME_MODULE_KEY)) {
    const source = packageSource({ compiled: args.compiled, key: SOCIAL_SHARE_RUNTIME_MODULE_KEY });
    if (source) chunks.push(runtimeModuleChunk('shared/socialShare.js', source));
  }
  if (widgetClientChunk) chunks.push(widgetClientChunk);
  return { ok: true, runtimeJs: `${chunks.join('\n\n')}\n` };
}
