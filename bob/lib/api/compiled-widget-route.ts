import { NextRequest, NextResponse } from 'next/server';
import { sha256Hex } from '@clickeen/ck-contracts/security';
import { readWidgetContentContract, type WidgetContentContract } from '@clickeen/ck-contracts/overlay-primitives';
import { parseLimitsSpec } from '@clickeen/ck-policy';
import { compileWidgetServer } from '../compiler.server';
import type { RawWidget } from '../compiler.shared';
import { requireTokyoUrl } from '../compiler/media';
import type { WidgetPackageContext, WidgetPackageFileContext } from '../types';
import { resolveCorsHeaders } from './cors';

type CompiledWidgetPayload = Awaited<ReturnType<typeof compileWidgetServer>> & {
  limits: unknown;
  content?: WidgetContentContract;
  widgetPackage?: WidgetPackageContext;
};

type CachedCompiledWidget = {
  freshnessKey: string;
  cachedAt: number;
  payload: CompiledWidgetPayload;
};

const compiledWidgetCache = new Map<string, CachedCompiledWidget>();
const COMPILED_WIDGET_HOT_CACHE_TTL_MS = 10 * 60_000;

function getFreshnessValidator(res: Response) {
  return {
    etag: (res.headers.get('etag') || '').trim(),
    lastModified: (res.headers.get('last-modified') || '').trim(),
  };
}

function hasStrongFreshnessSignal(validator: { etag: string; lastModified: string }) {
  return validator.etag.length > 0 || validator.lastModified.length > 0;
}

function buildSourceSignal(label: string, status: number, validator: { etag: string; lastModified: string }) {
  return `${label}:status=${status};etag=${validator.etag || '-'};lm=${validator.lastModified || '-'}`;
}

function buildWidgetSourceUrl(args: { tokyoRoot: string; widgetname: string; fileName: string }): string {
  return `${args.tokyoRoot}/widgets/${encodeURIComponent(args.widgetname)}/${args.fileName}`;
}

async function readRequiredWidgetSource(res: Response): Promise<string> {
  if (res.ok) return res.text();
  return '';
}

function buildWidgetPackage(args: {
  widgetname: string;
  specText: string;
  contentSource: string;
  htmlText: string;
  cssText: string;
  jsText: string;
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
  if (args.contentSource.trim()) {
    files['content.json'] = {
      mediaType: 'application/json',
      source: args.contentSource,
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
    const contentUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/content.json`;
    const limitsUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/limits.json`;
    const htmlUrl = buildWidgetSourceUrl({ tokyoRoot, widgetname, fileName: 'widget.html' });
    const cssUrl = buildWidgetSourceUrl({ tokyoRoot, widgetname, fileName: 'widget.css' });
    const jsUrl = buildWidgetSourceUrl({ tokyoRoot, widgetname, fileName: 'widget.client.js' });
    const cacheBust = req.nextUrl.searchParams.has('ts') || req.nextUrl.searchParams.has('_t');

    if (!cacheBust) {
      const cached = compiledWidgetCache.get(widgetname);
      if (cached && Date.now() - cached.cachedAt < COMPILED_WIDGET_HOT_CACHE_TTL_MS) {
        return NextResponse.json(cached.payload, {
          headers: {
            ...corsHeaders,
            'X-Bob-Compiled-Cache': 'hot',
          },
        });
      }
    }

    const fetchInit: RequestInit = {};
    if (cacheBust) fetchInit.cache = 'no-store';
    const [specRes, contentRes, limitsRes, htmlRes, cssRes, jsRes] = await Promise.all([
      fetch(specUrl, fetchInit),
      fetch(contentUrl, fetchInit),
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

    if (!contentRes.ok && contentRes.status !== 404) {
      return NextResponse.json(
        { error: `[Bob] Failed to fetch widget content contract from Tokyo (${contentRes.status} ${contentRes.statusText})` },
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

    const specValidator = getFreshnessValidator(specRes);
    const contentValidator = getFreshnessValidator(contentRes);
    const limitsValidator = getFreshnessValidator(limitsRes);
    const htmlValidator = getFreshnessValidator(htmlRes);
    const cssValidator = getFreshnessValidator(cssRes);
    const jsValidator = getFreshnessValidator(jsRes);
    const specText = await specRes.text();
    const contentContractBody = contentRes.ok ? await contentRes.text() : '';
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

    let freshnessKey = [
      `widget=${widgetname}`,
      buildSourceSignal('spec', specRes.status, specValidator),
      buildSourceSignal('content', contentRes.status, contentValidator),
      buildSourceSignal('limits', limitsRes.status, limitsValidator),
      buildSourceSignal('html', htmlRes.status, htmlValidator),
      buildSourceSignal('css', cssRes.status, cssValidator),
      buildSourceSignal('js', jsRes.status, jsValidator),
    ].join('|');

    if (!cacheBust) {
      const cached = compiledWidgetCache.get(widgetname);
      if (
        cached &&
        hasStrongFreshnessSignal(specValidator) &&
        (contentRes.status === 404 || hasStrongFreshnessSignal(contentValidator)) &&
        (limitsRes.status === 404 || hasStrongFreshnessSignal(limitsValidator)) &&
        hasStrongFreshnessSignal(htmlValidator) &&
        hasStrongFreshnessSignal(cssValidator) &&
        hasStrongFreshnessSignal(jsValidator) &&
        cached.freshnessKey === freshnessKey
      ) {
        compiledWidgetCache.set(widgetname, {
          ...cached,
          cachedAt: Date.now(),
        });
        return NextResponse.json(cached.payload, {
          headers: {
            ...corsHeaders,
            'X-Bob-Compiled-Cache': 'hit',
          },
        });
      }
    }

    if (!hasStrongFreshnessSignal(specValidator)) {
      const specHash = await sha256Hex(specText);
      freshnessKey = `${freshnessKey}|specHash=${specHash}`;
    }
    if (limitsRes.ok && !hasStrongFreshnessSignal(limitsValidator)) {
      const limitsHash = await sha256Hex(limitsText);
      freshnessKey = `${freshnessKey}|limitsHash=${limitsHash}`;
    }
    if (contentRes.ok && !hasStrongFreshnessSignal(contentValidator)) {
      const contentHash = await sha256Hex(contentContractBody);
      freshnessKey = `${freshnessKey}|contentHash=${contentHash}`;
    }
    if (!hasStrongFreshnessSignal(htmlValidator)) {
      const htmlHash = await sha256Hex(htmlText);
      freshnessKey = `${freshnessKey}|htmlHash=${htmlHash}`;
    }
    if (!hasStrongFreshnessSignal(cssValidator)) {
      const cssHash = await sha256Hex(cssText);
      freshnessKey = `${freshnessKey}|cssHash=${cssHash}`;
    }
    if (!hasStrongFreshnessSignal(jsValidator)) {
      const jsHash = await sha256Hex(jsText);
      freshnessKey = `${freshnessKey}|jsHash=${jsHash}`;
    }

    if (!cacheBust) {
      const cached = compiledWidgetCache.get(widgetname);
      if (cached && cached.freshnessKey === freshnessKey) {
        compiledWidgetCache.set(widgetname, {
          ...cached,
          cachedAt: Date.now(),
        });
        return NextResponse.json(cached.payload, {
          headers: {
            ...corsHeaders,
            'X-Bob-Compiled-Cache': 'hit',
          },
        });
      }
    }

    const compiled = await compileWidgetServer(widgetJson);
    const content = contentRes.ok && contentContractBody.trim()
      ? readWidgetContentContract(JSON.parse(contentContractBody))
      : undefined;
    let limits = null;
    if (limitsRes.ok && limitsText.trim()) {
      limits = parseLimitsSpec(JSON.parse(limitsText));
    }

    const widgetPackage = buildWidgetPackage({
      widgetname,
      specText,
      contentSource: contentContractBody,
      htmlText,
      cssText,
      jsText,
    });
    const payload: CompiledWidgetPayload = { ...compiled, limits, widgetPackage, ...(content ? { content } : {}) };
    if (!cacheBust) {
      compiledWidgetCache.set(widgetname, {
        freshnessKey,
        cachedAt: Date.now(),
        payload,
      });
    }

    return NextResponse.json(payload, {
      headers: {
        ...corsHeaders,
        'X-Bob-Compiled-Cache': cacheBust ? 'bypass' : 'miss',
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
