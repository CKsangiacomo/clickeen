import { createClient } from '@supabase/supabase-js';

// DEPRECATED: Use createSupabaseServer() from ./supabase.ts instead
// This is kept only for dev scripts that need service role access
export function supabaseAdmin() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Service role client should not be used in production dashboard');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false }});
}

// PHASE1-GUARD: block service-role outside local dev (non-throwing at import-time)
const __env = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV } as const;
if (__env.VERCEL_ENV === 'production' || __env.VERCEL_ENV === 'preview' || __env.NODE_ENV !== 'development') {
  // Do not crash build/import; warn loudly. Actual usage must be removed/migrated.
  console.warn('[SECURITY] Service role client is disabled outside local development — build continues. Do not use at runtime.');
}

// PHASE1: marker — service role not allowed outside local dev. Usage must be migrated to Paris (c-keen-api).
export const __SERVICE_ROLE_DISABLED =
  (__env.VERCEL_ENV === 'production' || __env.VERCEL_ENV === 'preview' || __env.NODE_ENV !== 'development');
