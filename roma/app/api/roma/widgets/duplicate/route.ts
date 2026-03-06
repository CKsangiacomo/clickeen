import { NextRequest } from 'next/server';
import { proxyToParis } from '../../../../../lib/api/paris-proxy';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  return proxyToParis(request, {
    method: 'POST',
    path: '/api/roma/widgets/duplicate',
  });
}

