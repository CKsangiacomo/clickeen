import { NextRequest, NextResponse } from 'next/server';
import { readWidgetEditableFieldsContract, type WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import { parseLimitsSpec } from '@clickeen/ck-policy';
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

function buildWidgetSourceUrl(args: { tokyoRoot: string; widgetname: string; fileName: string }): string {
  return `${args.tokyoRoot}/widgets/${encodeURIComponent(args.widgetname)}/${args.fileName}`;
}

function buildWidgetProductSourceUrl(args: { tokyoRoot: string; productPath: string }): string {
  const relative = args.productPath.replace(/^product\/widgets\//, '');
  return `${args.tokyoRoot}/widgets/${relative.split('/').map(encodeURIComponent).join('/')}`;
}

async function readRequiredWidgetSource(res: Response): Promise<string> {
  if (res.ok) return res.text();
  return '';
}

function extractStylesheetSources(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
}

function extractScriptSources(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
}

function extractSupportSources(source: string): string[] {
  return [...source.matchAll(/["']([^"']+\.(?:css|js))(?:\?[^"']*)?["']/gi)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
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

async function fetchWidgetPackageSupportFiles(args: {
  tokyoRoot: string;
  widgetname: string;
  htmlText: string;
  cssText: string;
  jsText: string;
  knownFiles: Map<string, WidgetPackageFileContext>;
}): Promise<Map<string, WidgetPackageFileContext>> {
  const next = new Map(args.knownFiles);
  const productPaths = new Set<string>();
  for (const src of [...extractStylesheetSources(args.htmlText), ...extractScriptSources(args.htmlText), ...extractSupportSources(args.cssText), ...extractSupportSources(args.jsText)]) {
    const key = resolveProductPath(args.widgetname, src);
    if (key) productPaths.add(key);
  }
  await Promise.all(
    [...productPaths]
      .filter((key) => !next.has(key))
      .map(async (key) => {
        const response = await fetch(buildWidgetProductSourceUrl({ tokyoRoot: args.tokyoRoot, productPath: key }));
        if (!response.ok) throw new Error(`[Bob] Failed to fetch widget support file ${key} (${response.status} ${response.statusText})`);
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
    const htmlUrl = buildWidgetSourceUrl({ tokyoRoot, widgetname, fileName: 'widget.html' });
    const cssUrl = buildWidgetSourceUrl({ tokyoRoot, widgetname, fileName: 'widget.css' });
    const jsUrl = buildWidgetSourceUrl({ tokyoRoot, widgetname, fileName: 'widget.client.js' });
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
      if (!res.ok) {
        return NextResponse.json(
          { error: `[Bob] Failed to fetch ${label} from Tokyo (${res.status} ${res.statusText})` },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    const specText = await specRes.text();
    const editableFieldsContractBody = editableFieldsRes.ok ? await editableFieldsRes.text() : '';
    const limitsText = limitsRes.ok ? await limitsRes.text() : '';
    const [htmlText, cssText, jsText] = await Promise.all([
      readRequiredWidgetSource(htmlRes),
      readRequiredWidgetSource(cssRes),
      readRequiredWidgetSource(jsRes),
    ]);
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
      htmlText,
      cssText,
      jsText,
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `[Bob] Failed to compile widget ${widgetname}: ${message}` },
      { status: 500, headers: corsHeaders },
    );
  }
}
