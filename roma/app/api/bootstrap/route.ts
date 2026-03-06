import { NextRequest } from 'next/server';
import { proxyToParis } from '../../../lib/api/paris-proxy';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  return proxyToParis(request, {
    method: 'GET',
    path: '/api/roma/bootstrap',
  });
}
