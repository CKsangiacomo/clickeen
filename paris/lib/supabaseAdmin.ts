import { createClient } from '@supabase/supabase-js';

export function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase service credentials are missing (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).');
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export type AdminClient = ReturnType<typeof getServiceClient>;
