import { NextResponse } from 'next/server';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

type SupabaseTarget = 'local' | 'remote' | 'unknown';

function normalizeSupabaseTarget(value: string): SupabaseTarget {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'local' || normalized === 'remote') return normalized;
  return 'unknown';
}

function inferSupabaseTargetFromUrl(): SupabaseTarget {
  const raw = String(process.env.SUPABASE_URL || '').trim();
  if (!raw) return 'unknown';
  try {
    const url = new URL(raw);
    const hostname = url.hostname.trim().toLowerCase();
    if (!hostname) return 'unknown';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
    return 'remote';
  } catch {
    return 'unknown';
  }
}

function resolveSupabaseTarget(): SupabaseTarget {
  const explicit = normalizeSupabaseTarget(String(process.env.CK_SUPABASE_TARGET || ''));
  if (explicit !== 'unknown') return explicit;
  return inferSupabaseTargetFromUrl();
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function GET() {
  const envStage = String(process.env.ENV_STAGE || '').trim().toLowerCase() || 'unknown';
  const payload = {
    envStage,
    supabaseTarget: resolveSupabaseTarget(),
  };

  const response = NextResponse.json(payload, { headers: CORS_HEADERS });
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}
