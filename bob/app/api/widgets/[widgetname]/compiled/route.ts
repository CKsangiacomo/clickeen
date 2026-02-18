import { NextRequest, NextResponse } from 'next/server';
import { compileWidgetServer } from '../../../../../lib/compiler.server';
import type { RawWidget } from '../../../../../lib/compiler.shared';
import { requireTokyoUrl } from '../../../../../lib/compiler/assets';
import { parseLimitsSpec } from '@clickeen/ck-policy';

export const runtime = 'edge';

type CompiledWidgetPayload = Awaited<ReturnType<typeof compileWidgetServer>> & { limits: unknown };
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

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ widgetname: string }> }) {
  const { widgetname } = await ctx.params;
  if (!widgetname) {
    return NextResponse.json(
      { error: 'Missing widgetname' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }

  try {
    const tokyoRoot = requireTokyoUrl().replace(/\/+$/, '');
    const specUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/spec.json`;
    const limitsUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/limits.json`;
    const cacheBust = req.nextUrl.searchParams.has('ts') || req.nextUrl.searchParams.has('_t');

    if (!cacheBust) {
      const cached = compiledWidgetCache.get(widgetname);
      if (cached && Date.now() - cached.cachedAt < COMPILED_WIDGET_HOT_CACHE_TTL_MS) {
        return NextResponse.json(cached.payload, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'X-Bob-Compiled-Cache': 'hot',
          },
        });
      }
    }

    const fetchInit: RequestInit = {};
    if (cacheBust) fetchInit.cache = 'no-store';
    const [specRes, limitsRes] = await Promise.all([fetch(specUrl, fetchInit), fetch(limitsUrl, fetchInit)]);

    if (!specRes.ok) {
      if (specRes.status === 404) {
        return NextResponse.json(
          { error: `[Bob] Widget not found in Tokyo: ${widgetname}` },
          { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } },
        );
      }
      return NextResponse.json(
        { error: `[Bob] Failed to fetch widget spec from Tokyo (${specRes.status} ${specRes.statusText})` },
        { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    if (!limitsRes.ok && limitsRes.status !== 404) {
      return NextResponse.json(
        { error: `[Bob] Failed to fetch widget limits from Tokyo (${limitsRes.status} ${limitsRes.statusText})` },
        { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    const specValidator = getFreshnessValidator(specRes);
    const limitsValidator = getFreshnessValidator(limitsRes);
    let freshnessKey = [
      `widget=${widgetname}`,
      buildSourceSignal('spec', specRes.status, specValidator),
      buildSourceSignal('limits', limitsRes.status, limitsValidator),
    ].join('|');

    if (!cacheBust) {
      const cached = compiledWidgetCache.get(widgetname);
      if (cached && hasStrongFreshnessSignal(specValidator) && (limitsRes.status === 404 || hasStrongFreshnessSignal(limitsValidator)) && cached.freshnessKey === freshnessKey) {
        compiledWidgetCache.set(widgetname, {
          ...cached,
          cachedAt: Date.now(),
        });
        return NextResponse.json(cached.payload, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'X-Bob-Compiled-Cache': 'hit',
          },
        });
      }
    }

    const specText = await specRes.text();
    const limitsText = limitsRes.ok ? await limitsRes.text() : '';

    if (!hasStrongFreshnessSignal(specValidator)) {
      const specHash = await sha256Hex(specText);
      freshnessKey = `${freshnessKey}|specHash=${specHash}`;
    }
    if (limitsRes.ok && !hasStrongFreshnessSignal(limitsValidator)) {
      const limitsHash = await sha256Hex(limitsText);
      freshnessKey = `${freshnessKey}|limitsHash=${limitsHash}`;
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
            'Access-Control-Allow-Origin': '*',
            'X-Bob-Compiled-Cache': 'hit',
          },
        });
      }
    }

    const widgetJson = JSON.parse(specText) as RawWidget;
    const compiled = await compileWidgetServer(widgetJson);
    let limits = null;
    if (limitsRes.ok && limitsText.trim()) {
      limits = parseLimitsSpec(JSON.parse(limitsText));
    }

    const payload: CompiledWidgetPayload = { ...compiled, limits };
    if (!cacheBust) {
      compiledWidgetCache.set(widgetname, {
        freshnessKey,
        cachedAt: Date.now(),
        payload,
      });
    }

    return NextResponse.json(payload, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'X-Bob-Compiled-Cache': cacheBust ? 'bypass' : 'miss',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `[Bob] Failed to compile widget ${widgetname}: ${message}` },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
