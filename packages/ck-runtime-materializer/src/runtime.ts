import {
  WIDGET_PACKAGE_RUNTIME_MODULE_END,
  WIDGET_PACKAGE_RUNTIME_PAYLOAD_END,
  WIDGET_PACKAGE_RUNTIME_PAYLOAD_START,
  WIDGET_PACKAGE_STYLE_CHUNK_END,
} from '@clickeen/widget-foundation';
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
import type { RuntimeTypographyData } from '@clickeen/widget-foundation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function styleChunk(id: string, body: string): string {
  return `/* ck-style-module:${chunkMarkerId(id)} */\n${body}\n${WIDGET_PACKAGE_STYLE_CHUNK_END}`;
}

export function runtimeModuleChunk(id: string, body: string): string {
  return `/* ck-runtime-module:${chunkMarkerId(id)} */\n${body}\n${WIDGET_PACKAGE_RUNTIME_MODULE_END}`;
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
      const source = packageSource({ compiled: args.compiled, key: href });
      if (!source) return materializerFailure('widget_package_file_missing', href, [href]);
      chunks.push(styleChunk(href, source));
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
  publicPath: string;
  baseState: Record<string, unknown>;
  typographyData?: RuntimeTypographyData;
}): { ok: true; runtimeJs: string } | RuntimeMaterializerFailure {
  const payload = `${WIDGET_PACKAGE_RUNTIME_PAYLOAD_START}
(function () {
  var payload = ${JSON.stringify({
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    baseState: args.baseState,
  })};

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function applyExactOverlay(baseState, values) {
    if (!isRecord(values)) throw new Error('[Clickeen] Invalid locale overlay values');
    var state = JSON.parse(JSON.stringify(baseState));
    Object.entries(values).forEach(function (entry) {
      var path = entry[0];
      var value = entry[1];
      if (typeof value !== 'string' || !path || path.includes('[') || path.includes(']') || path.includes('*')) {
        throw new Error('[Clickeen] Invalid locale overlay value at ' + path);
      }
      var parts = path.split('.');
      if (
        parts.some(function (part) {
          return !part || part === '__proto__' || part === 'prototype' || part === 'constructor';
        })
      ) {
        throw new Error('[Clickeen] Invalid locale overlay path ' + path);
      }
      var current = state;
      for (var index = 0; index < parts.length - 1; index += 1) {
        var part = parts[index];
        if (/^[0-9]+$/.test(part)) {
          if (!Array.isArray(current) || Number(part) >= current.length) {
            throw new Error('[Clickeen] Locale overlay path does not exist: ' + path);
          }
          current = current[Number(part)];
        } else {
          if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
            throw new Error('[Clickeen] Locale overlay path does not exist: ' + path);
          }
          current = current[part];
        }
      }
      var leaf = parts[parts.length - 1];
      if (/^[0-9]+$/.test(leaf)) {
        if (!Array.isArray(current) || typeof current[Number(leaf)] !== 'string') {
          throw new Error('[Clickeen] Locale overlay target is not text: ' + path);
        }
        current[Number(leaf)] = value;
      } else {
        if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, leaf) || typeof current[leaf] !== 'string') {
          throw new Error('[Clickeen] Locale overlay target is not text: ' + path);
        }
        current[leaf] = value;
      }
    });
    return state;
  }

  var localeContext = window.CK_LOCALE_CONTEXT;
  var selectedLocale = payload.baseLocale;
  var selectedState = payload.baseState;
  var locales = { [payload.baseLocale]: payload.baseState };
  var languages = [payload.baseLocale];
  if (localeContext !== null && typeof localeContext !== 'undefined') {
    if (
      !isRecord(localeContext) ||
      typeof localeContext.locale !== 'string' ||
      localeContext.baseLocale !== payload.baseLocale ||
      !Array.isArray(localeContext.languages) ||
      localeContext.languages.some(function (locale) { return typeof locale !== 'string' || !locale; })
    ) {
      throw new Error('[Clickeen] Invalid public locale context');
    }
    selectedLocale = localeContext.locale;
    languages = Array.from(new Set(localeContext.languages));
    if (!selectedLocale || languages.indexOf(selectedLocale) < 0 || languages.indexOf(payload.baseLocale) < 0) {
      throw new Error('[Clickeen] Invalid public locale context coordinate');
    }
    if (selectedLocale === payload.baseLocale) {
      if (localeContext.values !== null) {
        throw new Error('[Clickeen] Base locale context must not contain overlay values');
      }
    } else {
      if (!isRecord(localeContext.values)) {
        throw new Error('[Clickeen] Requested locale context is missing overlay values');
      }
      selectedState = applyExactOverlay(payload.baseState, localeContext.values);
      locales[selectedLocale] = selectedState;
    }
  }
  document.documentElement.lang = selectedLocale;
  window.CK_LOCALE_POLICY = Object.assign({}, window.CK_LOCALE_POLICY || {}, {
    baseLocale: payload.baseLocale,
    languages: languages
  });
  window.CK_WIDGETS = Object.assign({}, window.CK_WIDGETS || {});
  window.CK_WIDGETS[payload.instanceId] = {
    instanceId: payload.instanceId,
    locale: selectedLocale,
    baseLocale: payload.baseLocale,
    state: selectedState,
    locales: locales
  };
})();
${WIDGET_PACKAGE_RUNTIME_PAYLOAD_END}`;

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
