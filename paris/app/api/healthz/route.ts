import { NextResponse } from 'next/server';
import { getAll } from '@vercel/edge-config';
import { withTimeout } from '@paris/lib/timeout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUPABASE_JWKS = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`
  : undefined;

async function checkSupabase(timeoutMs = 1000) {
  if (!SUPABASE_JWKS) return false;

  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(SUPABASE_JWKS, {
        method: 'GET',
        cache: 'no-store',
        signal,
      });
      return res.ok;
    }, timeoutMs);
  } catch {
    return false;
  }
}

async function checkEdgeConfig(timeoutMs = 1000) {
  try {
    await withTimeout(async () => {
      await getAll();
    }, timeoutMs);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [supabaseOk, edgeConfigOk] = await Promise.all([checkSupabase(), checkEdgeConfig()]);

  const rawAllow = process.env.ALLOWED_ORIGINS;
  const allowlist = rawAllow ? rawAllow.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const corsOk = process.env.NODE_ENV === 'development' ? true : allowlist.length > 0;

  const body = {
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    up: true,
    deps: {
      supabase: { status: supabaseOk },
      edgeConfig: { status: edgeConfigOk },
      cors: { configured: corsOk, allowlistCount: allowlist.length },
    },
  } as const;

  // In development, Edge Config is optional since it's not available locally
  const isDevelopment = process.env.NODE_ENV === 'development';
  const status = supabaseOk && (edgeConfigOk || isDevelopment) ? 200 : 503;
  return NextResponse.json(body, { status });
}
