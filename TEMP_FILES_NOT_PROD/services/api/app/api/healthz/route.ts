import { NextResponse } from 'next/server';
import { getAll } from '@vercel/edge-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUPABASE_JWKS = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL.replace(/\/+$/,'')}/auth/v1/.well-known/jwks.json`
  : undefined;

async function checkSupabase(timeoutMs = 1000) {
  if (!SUPABASE_JWKS) return false;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(SUPABASE_JWKS, { method: 'GET', cache: 'no-store', signal: ctl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function checkEdgeConfig(timeoutMs = 1000) {
  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      getAll()
        .then(() => {
          clearTimeout(t);
          resolve();
        })
        .catch((err) => {
          clearTimeout(t);
          reject(err);
        });
    });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [supabaseOk, edgeConfigOk] = await Promise.all([checkSupabase(), checkEdgeConfig()]);
  const body = {
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    up: true,
    deps: { supabase: supabaseOk, edgeConfig: edgeConfigOk }
  };
  const status = (supabaseOk && edgeConfigOk) ? 200 : 503;
  return NextResponse.json(body, { status });
}
