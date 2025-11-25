import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { compileWidgetServer } from '../../../../../lib/compiler.server';

export async function GET(_req: Request, { params }: { params: { widgetname: string } }) {
  const widgetname = params.widgetname;
  if (!widgetname) {
    return NextResponse.json({ error: 'Missing widgetname' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const specPathCurrent = path.join(process.cwd(), 'denver', 'widgets', widgetname, 'spec.json');
  const specPathParent = path.join(process.cwd(), '..', 'denver', 'widgets', widgetname, 'spec.json');
  const specPath = await (async () => {
    try {
      await fs.access(specPathCurrent);
      return specPathCurrent;
    } catch {
      return specPathParent;
    }
  })();
  try {
    const raw = await fs.readFile(specPath, 'utf8');
    const widgetJson = JSON.parse(raw);
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
