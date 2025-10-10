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
