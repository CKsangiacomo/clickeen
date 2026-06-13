import { NextRequest, NextResponse } from 'next/server';
import { readWidgetEditableFieldsContract, type WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import { parseLimitsSpec, type LimitsSpec } from '@clickeen/ck-policy';
import { WIDGET_SHELL_CSS_MODULE_KEYS, WIDGET_SHELL_RUNTIME_MODULE_KEYS } from '@clickeen/widget-shell';
import { compileWidgetServer } from '../compiler.server';
import type { RawWidget } from '../compiler.shared';
import { requireTokyoUrl } from '../compiler/media';
import type { WidgetPackageContext, WidgetPackageFileContext } from '../types';
import { resolveCorsHeaders } from './cors';

type CompiledWidgetPayload = Awaited<ReturnType<typeof compileWidgetServer>> & {
  limits: LimitsSpec;
  editableFields?: WidgetEditableFieldsContract;
  widgetPackage?: WidgetPackageContext;
};
type WidgetPackageSupportError = { kind: 'WIDGET_PUBLIC_PACKAGE_ERROR'; reasonKey: string; paths: string[] };

function compiledWidgetError(args: { reasonKey: string; status: number; paths?: string[] }, headers: HeadersInit) {
  const error = { kind: 'VALIDATION', reasonKey: args.reasonKey, ...(args.paths?.length ? { paths: args.paths } : {}) };
  return NextResponse.json({ error }, { status: args.status, headers });
}

function buildWidgetProductSourceUrl(args: { tokyoRoot: string; productPath: string }): string {
  const relative = args.productPath.replace(/^product\/widgets\//, '');
  return `${args.tokyoRoot}/widgets/${relative.split('/').map(encodeURIComponent).join('/')}`;
}

function packageSupportError(reasonKey: string, path: string): never { throw { kind: 'WIDGET_PUBLIC_PACKAGE_ERROR', reasonKey, paths: [path] } satisfies WidgetPackageSupportError; }

function isWidgetPackageSupportError(value: unknown): value is WidgetPackageSupportError { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && (value as WidgetPackageSupportError).kind === 'WIDGET_PUBLIC_PACKAGE_ERROR'; }

function tagAttr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function readDeclaredWidgetProductFiles(args: { widgetname: string; htmlText: string }): string[] {
  const productPaths = new Set<string>();
  const add = (ref: string, extension: '.css' | '.js') => {
    if (!ref || ref.startsWith('#')) return;
    const url = new URL(ref, `https://clickeen.local/product/widgets/${encodeURIComponent(args.widgetname)}/widget.html`);
    if (url.origin !== 'https://clickeen.local') return;
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (path.startsWith('product/widgets/') && path.endsWith(extension)) productPaths.add(path);
  };
  for (const tag of args.htmlText.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/\bstylesheet\b/i.test(tagAttr(tag, 'rel'))) continue;
    add(tagAttr(tag, 'href'), '.css');
  }
  for (const tag of args.htmlText.match(/<script\b[^>]*>/gi) ?? []) {
    add(tagAttr(tag, 'src'), '.js');
  }
  return [...productPaths];
}

async function fetchWidgetPackageSupportFiles(args: {
  tokyoRoot: string;
  widgetname: string;
  declaredProductFiles: readonly string[];
  knownFiles: Map<string, WidgetPackageFileContext>;
}): Promise<Map<string, WidgetPackageFileContext>> {
  const next = new Map(args.knownFiles);
  const productPaths = new Set<string>([
    ...WIDGET_SHELL_CSS_MODULE_KEYS,
    ...WIDGET_SHELL_RUNTIME_MODULE_KEYS,
    ...args.declaredProductFiles,
  ]);
  await Promise.all(
    [...productPaths]
      .filter((key) => !next.has(key))
      .map(async (key) => {
        const response = await fetch(buildWidgetProductSourceUrl({ tokyoRoot: args.tokyoRoot, productPath: key }));
        if (!response.ok) packageSupportError('coreui.errors.widget.packageMissing', key);
        const source = await response.text();
        next.set(key, {
          mediaType: key.endsWith('.css') ? 'text/css' : 'text/javascript',
          source,
        });
      }),
  );
  return next;
}

function buildWidgetPackage(args: {
  widgetname: string;
  specText: string;
  editableFieldsSource: string;
  htmlText: string;
  cssText: string;
  jsText: string;
  supportFiles: Map<string, WidgetPackageFileContext>;
}): WidgetPackageContext {
  const files: WidgetPackageContext['files'] = {
    'spec.json': {
      mediaType: 'application/json',
      source: args.specText,
    },
    'widget.html': {
      mediaType: 'text/html',
      source: args.htmlText,
    },
    'widget.css': {
      mediaType: 'text/css',
      source: args.cssText,
    },
    'widget.client.js': {
      mediaType: 'text/javascript',
      source: args.jsText,
    },
  };
  args.supportFiles.forEach((file, key) => {
    files[key] = file;
  });
  if (args.editableFieldsSource.trim()) {
    files['editable-fields.json'] = {
      mediaType: 'application/json',
      source: args.editableFieldsSource,
    } satisfies WidgetPackageFileContext;
  }
  return {
    v: 1,
    widgetType: args.widgetname,
    files,
  };
}

export async function getCompiledWidgetRouteResponse(req: NextRequest, ctx: { params: Promise<{ widgetname: string }> }) {
  const { widgetname } = await ctx.params;
  const corsHeaders = resolveCorsHeaders(req, 'GET,OPTIONS');
  if (!widgetname) {
    return compiledWidgetError({ reasonKey: 'coreui.errors.widgetType.invalid', status: 400 }, corsHeaders);
  }

  try {
    const tokyoRoot = requireTokyoUrl().replace(/\/+$/, '');
    const specUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/spec.json`;
    const editableFieldsUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/editable-fields.json`;
    const limitsUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/limits.json`;
    const htmlUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/widget.html`;
    const cssUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/widget.css`;
    const jsUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/widget.client.js`;
    const fetchInit: RequestInit = {};
    if (req.nextUrl.searchParams.has('ts') || req.nextUrl.searchParams.has('_t')) fetchInit.cache = 'no-store';
    const [specRes, editableFieldsRes, limitsRes, htmlRes, cssRes, jsRes] = await Promise.all([
      fetch(specUrl, fetchInit),
      fetch(editableFieldsUrl, fetchInit),
      fetch(limitsUrl, fetchInit),
      fetch(htmlUrl, fetchInit),
      fetch(cssUrl, fetchInit),
      fetch(jsUrl, fetchInit),
    ]);

    if (!specRes.ok) {
      if (specRes.status === 404) {
        return compiledWidgetError({ reasonKey: 'coreui.errors.widgetType.invalid', status: 404 }, corsHeaders);
      }
      return compiledWidgetError({ reasonKey: 'coreui.errors.widget.compiled.invalid', status: 502 }, corsHeaders);
    }

    if (!limitsRes.ok) {
      return compiledWidgetError({ reasonKey: 'coreui.errors.widget.compiled.invalid', status: 502 }, corsHeaders);
    }

    if (!editableFieldsRes.ok && editableFieldsRes.status !== 404) {
      return compiledWidgetError({ reasonKey: 'coreui.errors.widget.compiled.invalid', status: 502 }, corsHeaders);
    }

    for (const [label, res] of [
      ['widget.html', htmlRes],
      ['widget.css', cssRes],
      ['widget.client.js', jsRes],
    ] as const) {
      if (!res.ok) packageSupportError('coreui.errors.widget.packageMissing', `product/widgets/${widgetname}/${label}`);
    }

    const specText = await specRes.text();
    const editableFieldsContractBody = editableFieldsRes.ok ? await editableFieldsRes.text() : '';
    const limitsText = limitsRes.ok ? await limitsRes.text() : '';
    const [htmlText, cssText, jsText] = await Promise.all([htmlRes.text(), cssRes.text(), jsRes.text()]);
    const widgetJson = JSON.parse(specText) as RawWidget;
    if (widgetJson.v !== 1) {
      return compiledWidgetError({ reasonKey: 'coreui.errors.widget.compiled.invalid', status: 503 }, corsHeaders);
    }

    const initialPackageFiles = new Map<string, WidgetPackageFileContext>([
      ['product/widgets/' + widgetname + '/widget.css', { mediaType: 'text/css', source: cssText }],
      ['product/widgets/' + widgetname + '/widget.client.js', { mediaType: 'text/javascript', source: jsText }],
    ]);
    const supportFiles = await fetchWidgetPackageSupportFiles({
      tokyoRoot,
      widgetname,
      declaredProductFiles: readDeclaredWidgetProductFiles({ widgetname, htmlText }),
      knownFiles: initialPackageFiles,
    });

    const compiled = await compileWidgetServer(widgetJson);
    const editableFields = editableFieldsRes.ok && editableFieldsContractBody.trim()
      ? readWidgetEditableFieldsContract(JSON.parse(editableFieldsContractBody))
      : undefined;
    const limits = parseLimitsSpec(JSON.parse(limitsText));

    const widgetPackage = buildWidgetPackage({
      widgetname,
      specText,
      editableFieldsSource: editableFieldsContractBody,
      htmlText,
      cssText,
      jsText,
      supportFiles,
    });
    const payload: CompiledWidgetPayload = { ...compiled, limits, widgetPackage, ...(editableFields ? { editableFields } : {}) };

    return NextResponse.json(payload, {
      headers: {
        ...corsHeaders,
      },
    });
  } catch (err) {
    if (isWidgetPackageSupportError(err)) {
      return compiledWidgetError({ reasonKey: err.reasonKey, status: 422, paths: err.paths }, corsHeaders);
    }
    return compiledWidgetError({ reasonKey: 'coreui.errors.widget.compiled.invalid', status: 500 }, corsHeaders);
  }
}
