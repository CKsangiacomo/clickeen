import { NextRequest, NextResponse } from 'next/server';
import { compileWidgetServer } from '../../../../../lib/compiler.server';
import type { RawWidget } from '../../../../../lib/compiler.shared';
import { requireTokyoUrl } from '../../../../../lib/compiler/assets';
import { parseLimitsSpec } from '@clickeen/ck-policy';

export const runtime = 'edge';

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
    const cacheBust = req.nextUrl.searchParams.has('ts') || req.nextUrl.searchParams.has('_t');
    const fetchInit: RequestInit = { cache: cacheBust ? 'no-store' : 'default' };
    const res = await fetch(specUrl, fetchInit);
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          { error: `[Bob] Widget not found in Tokyo: ${widgetname}` },
          { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } },
        );
      }
      return NextResponse.json(
        { error: `[Bob] Failed to fetch widget spec from Tokyo (${res.status} ${res.statusText})` },
        { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    const widgetJson = (await res.json()) as RawWidget;
    const compiled = await compileWidgetServer(widgetJson);
    const limitsUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/limits.json`;
    let limits = null;
    const limitsRes = await fetch(limitsUrl, fetchInit);
    if (limitsRes.ok) {
      limits = parseLimitsSpec(await limitsRes.json());
    } else if (limitsRes.status !== 404) {
      return NextResponse.json(
        { error: `[Bob] Failed to fetch widget limits from Tokyo (${limitsRes.status} ${limitsRes.statusText})` },
        { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    return NextResponse.json({ ...compiled, limits }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `[Bob] Failed to compile widget ${widgetname}: ${message}` },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
