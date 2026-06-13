import { NextRequest, NextResponse } from 'next/server';
import { readWidgetEditableFieldsContract, type WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import { parseLimitsSpec } from '@clickeen/ck-policy';
import { WIDGET_SHELL_CSS_MODULE_KEYS, WIDGET_SHELL_RUNTIME_MODULE_KEYS } from '@clickeen/widget-shell';
import { compileWidgetServer } from '../compiler.server';
import type { RawWidget } from '../compiler.shared';
import { requireTokyoUrl } from '../compiler/media';
import type { WidgetPackageContext, WidgetPackageFileContext } from '../types';
import { resolveCorsHeaders } from './cors';

type CompiledWidgetPayload = Awaited<ReturnType<typeof compileWidgetServer>> & {
  limits: unknown;
  editableFields?: WidgetEditableFieldsContract;
  widgetPackage?: WidgetPackageContext;
};
type WidgetPackageSupportError = { kind: 'WIDGET_PUBLIC_PACKAGE_ERROR'; reasonKey: string; paths: string[] };

function buildWidgetProductSourceUrl(args: { tokyoRoot: string; productPath: string }): string {
  const relative = args.productPath.replace(/^product\/widgets\//, '');
  return `${args.tokyoRoot}/widgets/${relative.split('/').map(encodeURIComponent).join('/')}`;
}

function packageSupportError(reasonKey: string, path: string): never { throw { kind: 'WIDGET_PUBLIC_PACKAGE_ERROR', reasonKey, paths: [path] } satisfies WidgetPackageSupportError; }

function isWidgetPackageSupportError(value: unknown): value is WidgetPackageSupportError { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && (value as WidgetPackageSupportError).kind === 'WIDGET_PUBLIC_PACKAGE_ERROR'; }

async function fetchWidgetPackageSupportFiles(args: {
  tokyoRoot: string;
  widgetname: string;
  knownFiles: Map<string, WidgetPackageFileContext>;
}): Promise<Map<string, WidgetPackageFileContext>> {
  const next = new Map(args.knownFiles);
  const productPaths = new Set<string>([
    ...WIDGET_SHELL_CSS_MODULE_KEYS,
    ...WIDGET_SHELL_RUNTIME_MODULE_KEYS,
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
    return NextResponse.json(
      { error: 'Missing widgetname' },
      { status: 400, headers: corsHeaders },
    );
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
        return NextResponse.json(
          { error: `[Bob] Widget not found in Tokyo: ${widgetname}` },
          { status: 404, headers: corsHeaders },
        );
      }
      return NextResponse.json(
        { error: `[Bob] Failed to fetch widget spec from Tokyo (${specRes.status} ${specRes.statusText})` },
        { status: 502, headers: corsHeaders },
      );
    }

    if (!limitsRes.ok && limitsRes.status !== 404) {
      return NextResponse.json(
        { error: `[Bob] Failed to fetch widget limits from Tokyo (${limitsRes.status} ${limitsRes.statusText})` },
        { status: 502, headers: corsHeaders },
      );
    }

    if (!editableFieldsRes.ok && editableFieldsRes.status !== 404) {
      return NextResponse.json(
        { error: `[Bob] Failed to fetch widget editable-fields contract from Tokyo (${editableFieldsRes.status} ${editableFieldsRes.statusText})` },
        { status: 502, headers: corsHeaders },
      );
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
      return NextResponse.json(
        { error: `[Bob] Unsupported widget spec version for ${widgetname}` },
        { status: 503, headers: corsHeaders },
      );
    }

    const initialPackageFiles = new Map<string, WidgetPackageFileContext>([
      ['product/widgets/' + widgetname + '/widget.css', { mediaType: 'text/css', source: cssText }],
      ['product/widgets/' + widgetname + '/widget.client.js', { mediaType: 'text/javascript', source: jsText }],
    ]);
    const supportFiles = await fetchWidgetPackageSupportFiles({
      tokyoRoot,
      widgetname,
      knownFiles: initialPackageFiles,
    });

    const compiled = await compileWidgetServer(widgetJson);
    const editableFields = editableFieldsRes.ok && editableFieldsContractBody.trim()
      ? readWidgetEditableFieldsContract(JSON.parse(editableFieldsContractBody))
      : undefined;
    let limits = null;
    if (limitsRes.ok && limitsText.trim()) {
      limits = parseLimitsSpec(JSON.parse(limitsText));
    }

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
    if (isWidgetPackageSupportError(err)) return NextResponse.json({ error: err }, { status: 422, headers: corsHeaders });
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `[Bob] Failed to compile widget ${widgetname}: ${message}` },
      { status: 500, headers: corsHeaders },
    );
  }
}
