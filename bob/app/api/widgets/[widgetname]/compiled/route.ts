import { NextResponse } from 'next/server';
import { compileWidgetServer } from '../../../../../lib/compiler.server';

export async function GET(_req: Request, { params }: { params: { widgetname: string } }) {
  const widgetname = params.widgetname;
  if (!widgetname) {
    return NextResponse.json(
      { error: 'Missing widgetname' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }

  const tokyoBase = process.env.NEXT_PUBLIC_TOKYO_URL;
  if (!tokyoBase) {
    return NextResponse.json(
      { error: '[Bob] NEXT_PUBLIC_TOKYO_URL is required' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }

  const tokyoRoot = tokyoBase.replace(/\/+$/, '');
  const specUrl = `${tokyoRoot}/widgets/${encodeURIComponent(widgetname)}/spec.json`;
  try {
    const res = await fetch(specUrl, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: `[Bob] Failed to fetch widget spec from Tokyo (${res.status} ${res.statusText})` },
        { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    const widgetJson = (await res.json()) as unknown;
    const compiled = compileWidgetServer(widgetJson);
    return NextResponse.json(compiled, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `[Bob] Failed to compile widget ${widgetname}: ${message}` },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
