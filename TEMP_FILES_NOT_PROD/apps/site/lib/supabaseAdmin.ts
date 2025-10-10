import { createClient } from '@supabase/supabase-js';

// Server-side service role client for privileged operations.
// Never import this in client components.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase environment variables for service role client');
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}


