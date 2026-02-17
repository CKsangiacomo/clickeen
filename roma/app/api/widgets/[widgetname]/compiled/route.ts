import type { NextRequest } from 'next/server';
import { GET as bobGet } from '../../../../../../bob/app/api/widgets/[widgetname]/compiled/route';

export const runtime = 'edge';

export function GET(req: NextRequest, ctx: { params: Promise<{ widgetname: string }> }) {
  return bobGet(req, ctx);
}
