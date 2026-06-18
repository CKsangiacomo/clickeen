import { getCompiledWidgetRouteResponse } from '@clickeen/bob/compiled-widget-route';
import {
  collectConfigMediaAssetRefs,
  materializeConfigMedia,
} from '@clickeen/ck-contracts';
import type { LimitsSpec } from '@clickeen/ck-policy';
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import {
  WIDGET_SHELL_RUNTIME_MODULE_END,
  WIDGET_SHELL_RUNTIME_PAYLOAD_END,
  WIDGET_SHELL_RUNTIME_PAYLOAD_START,
  WIDGET_SHELL_STYLE_CHUNK_END,
} from '@clickeen/widget-shell';
import { NextRequest } from 'next/server';
import { parseResolvedAccountAsset } from './account-asset-record';
import {
  buildTokyoAssetControlHeaders,
  fetchTokyoAssetControl,
} from './tokyo-asset-control';

type WidgetPackageFileContext = {
  mediaType: 'application/json' | 'text/html' | 'text/css' | 'text/javascript';
  source: string;
};

export type SavedWidgetPublicPackage = {
  v: 1;
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
  dependencies: {
    instanceIds: string[];
  };
};

export type CompiledWidgetForPublicPackage = {
  widgetname: string;
  displayName?: string;
  limits: LimitsSpec;
  editableFields?: WidgetEditableFieldsContract;
  controls?: Array<{
    path?: string;
  }>;
  widgetPackage?: {
    files: Partial<Record<string, WidgetPackageFileContext>>;
  };
};

export type InstancePackageFailure = {
  ok: false;
  status: 422 | 502;
  error: {
    kind: 'VALIDATION' | 'UPSTREAM_UNAVAILABLE';
    reasonKey: string;
    detail?: string;
    paths?: string[];
  };
};

type PackageBuildArgs = {
  compiled: CompiledWidgetForPublicPackage;
  instanceId: string;
  baseLocale: string;
  displayName: string | null;
  state: Record<string, unknown>;
};

const WIDGET_PACKAGE_MISSING_PREFIX = 'coreui.errors.widget.packageMissing:';
const STYLE_CHUNK_END = WIDGET_SHELL_STYLE_CHUNK_END;
const RUNTIME_PAYLOAD_START = WIDGET_SHELL_RUNTIME_PAYLOAD_START;
const RUNTIME_PAYLOAD_END = WIDGET_SHELL_RUNTIME_PAYLOAD_END;
const RUNTIME_MODULE_END = WIDGET_SHELL_RUNTIME_MODULE_END;
const SOCIAL_SHARE_CSS_MODULE_KEY = 'product/widgets/shared/socialShare.css';
const SOCIAL_SHARE_RUNTIME_MODULE_KEY = 'product/widgets/shared/socialShare.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCompiledWidgetForPublicPackage(value: unknown): value is CompiledWidgetForPublicPackage {
  if (!isRecord(value)) return false;
  const widgetPackage = value.widgetPackage;
  return (
    typeof value.widgetname === 'string' &&
    (typeof value.displayName === 'undefined' || typeof value.displayName === 'string') &&
    isRecord(value.limits) &&
    isRecord(widgetPackage)
  );
}

function compileFailureFromPayload(payload: unknown): InstancePackageFailure {
  const error = isRecord(payload) ? payload.error : null;
  if (isRecord(error) && typeof error.reasonKey === 'string') {
    const paths = Array.isArray(error.paths)
      ? error.paths.filter((path): path is string => typeof path === 'string')
      : undefined;
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: error.reasonKey,
        ...(paths?.length ? { paths } : {}),
      },
    };
  }
  return {
    ok: false,
    status: 422,
    error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widget.compiled.invalid' },
  };
}

export async function compileWidgetForInstancePackage(
  request: NextRequest,
  widgetType: string,
): Promise<
  | { ok: true; value: CompiledWidgetForPublicPackage }
  | InstancePackageFailure
> {
  const response = await getCompiledWidgetRouteResponse(
    new NextRequest(new URL(`/api/widgets/${encodeURIComponent(widgetType)}/compiled`, request.url)),
    { params: Promise.resolve({ widgetname: widgetType }) },
  );
  const payload = await response.json().catch(() => null);
  if (response.ok && isCompiledWidgetForPublicPackage(payload)) {
    return { ok: true, value: payload };
  }
  return compileFailureFromPayload(payload);
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

function packageSource(args: { compiled: CompiledWidgetForPublicPackage; key: string }): string {
  return fileSource(args.compiled.widgetPackage?.files[args.key]);
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
    const source = packageSource({ compiled: args.compiled, key });
    if (!source) throw new Error(`coreui.errors.widget.packageMissing:${key}`);
    chunks.push(styleChunk(key, source));
    includedStyleKeys.add(key);
  }
  if (includeSocialShare && !includedStyleKeys.has(SOCIAL_SHARE_CSS_MODULE_KEY)) {
    const source = packageSource({ compiled: args.compiled, key: SOCIAL_SHARE_CSS_MODULE_KEY });
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
  let widgetClientChunk: string | null = null;
  const includedRuntimeKeys = new Set<string>();
  for (const src of scriptSources) {
    const key = resolveProductPath(args.compiled.widgetname, src);
    if (!key || !key.endsWith('.js')) continue;
    const source = packageSource({ compiled: args.compiled, key });
    if (!source) throw new Error(`coreui.errors.widget.packageMissing:${key}`);
    const chunk = runtimeModuleChunk(key, source);
    includedRuntimeKeys.add(key);
    if (key.endsWith('/widget.client.js')) {
      widgetClientChunk = chunk;
      continue;
    }
    chunks.push(chunk);
  }
  if (includeSocialShare && !includedRuntimeKeys.has(SOCIAL_SHARE_RUNTIME_MODULE_KEY)) {
    const source = packageSource({ compiled: args.compiled, key: SOCIAL_SHARE_RUNTIME_MODULE_KEY });
    if (source) chunks.push(runtimeModuleChunk('shared/socialShare.js', source));
  }
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
    dependencies: { instanceIds: [] },
  };
}

function validationFailure(reasonKey: string, detail?: string, paths?: string[]): InstancePackageFailure {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey,
      ...(detail ? { detail } : {}),
      ...(paths?.length ? { paths } : {}),
    },
  };
}

function validationFailureFromPayload(payload: unknown, fallbackReasonKey: string): InstancePackageFailure {
  const error = isRecord(payload) ? payload.error : null;
  if (isRecord(error) && typeof error.reasonKey === 'string' && error.reasonKey) {
    const detail = typeof error.detail === 'string' && error.detail ? error.detail : undefined;
    const paths = Array.isArray(error.paths)
      ? error.paths.filter((path): path is string => typeof path === 'string' && Boolean(path))
      : undefined;
    return validationFailure(error.reasonKey, detail, paths);
  }
  return validationFailure(fallbackReasonKey);
}

export function parseExactResolvedAssetPayload(args: {
  payload: unknown;
  requestedAssetRefs: string[];
}):
  | { ok: true; assetsByRef: Record<string, unknown> }
  | InstancePackageFailure {
  const invalid = () => validationFailure('coreui.errors.assets.resolve.invalidMaterialization');
  if (!isRecord(args.payload)) return invalid();
  const keys = Object.keys(args.payload);
  if (keys.length !== 1 || keys[0] !== 'assets' || !Array.isArray(args.payload.assets)) return invalid();
  if (args.payload.assets.length !== args.requestedAssetRefs.length) return invalid();

  const requested = new Set(args.requestedAssetRefs);
  const assetsByRef: Record<string, unknown> = {};
  for (const raw of args.payload.assets) {
    const asset = parseResolvedAccountAsset(raw);
    if (!asset || !requested.has(asset.assetRef) || Object.prototype.hasOwnProperty.call(assetsByRef, asset.assetRef)) {
      return invalid();
    }
    assetsByRef[asset.assetRef] = asset;
  }

  if (Object.keys(assetsByRef).length !== requested.size) return invalid();
  return { ok: true, assetsByRef };
}

async function materializePublicPackageMedia(args: {
  accountId: string;
  accountCapsule: string;
  requestId: string;
  config: Record<string, unknown>;
}): Promise<
  | { ok: true; state: Record<string, unknown> }
  | InstancePackageFailure
> {
  const assetRefs = collectConfigMediaAssetRefs(args.config);
  if (!assetRefs.length) return { ok: true, state: args.config };

  let upstream: Response;
  try {
    upstream = await fetchTokyoAssetControl({
      path: `/__internal/assets/account/${encodeURIComponent(args.accountId)}/resolve`,
      method: 'POST',
      headers: buildTokyoAssetControlHeaders({
        accountId: args.accountId,
        accountCapsule: args.accountCapsule,
        contentType: 'application/json',
        requestId: args.requestId,
      }),
      body: JSON.stringify({ assetRefs }),
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'roma.errors.proxy.tokyo_unavailable',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    if (upstream.status === 422) return validationFailureFromPayload(payload, 'coreui.errors.assets.resolve.failed');
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.assets.resolve.failed',
      },
    };
  }

  const resolved = parseExactResolvedAssetPayload({ payload, requestedAssetRefs: assetRefs });
  if (!resolved.ok) return resolved;

  const materialized = materializeConfigMedia(args.config, resolved.assetsByRef);
  if (!isRecord(materialized)) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.assets.resolve.invalidMaterialization',
      },
    };
  }
  return { ok: true, state: materialized };
}

export async function materializeAccountInstancePublicPackage(args: {
  compiled: CompiledWidgetForPublicPackage;
  accountId: string;
  accountCapsule: string;
  requestId: string;
  instanceId: string;
  baseLocale: string;
  displayName: string | null;
  config: Record<string, unknown>;
}): Promise<
  | { ok: true; value: SavedWidgetPublicPackage }
  | InstancePackageFailure
> {
  const materializedMedia = await materializePublicPackageMedia({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
    config: args.config,
  });
  if (!materializedMedia.ok) return materializedMedia;

  try {
    return {
      ok: true,
      value: buildSavedWidgetPublicPackage({
        compiled: args.compiled,
        instanceId: args.instanceId,
        baseLocale: args.baseLocale,
        displayName: args.displayName,
        state: materializedMedia.state,
      }),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.startsWith(WIDGET_PACKAGE_MISSING_PREFIX)) {
      return {
        ok: false,
        status: 422,
        error: { kind: 'VALIDATION', reasonKey: detail },
      };
    }
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.widget.compiled.invalid',
        detail,
      },
    };
  }
}
