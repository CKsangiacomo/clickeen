import type { NextRequest } from 'next/server';
import { OPTIONS as bobOptions, POST as bobPost } from '../../../../../bob/app/api/assets/upload/route';

export const runtime = 'edge';

export function OPTIONS() {
  return bobOptions();
}

export function POST(request: NextRequest) {
  return bobPost(request);
}
