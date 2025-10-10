import { createClient } from '@supabase/supabase-js';

// Client used in the browser (public anon key)
export function getBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Server-side client (service role) - only import in server contexts
export function getServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

// Types for widget_instances table
export interface WidgetInstance {
  id: string;
  workspace_id: string | null;
  type_id: string;
  public_id: string;
  version: number;
  status: string;
  config: Record<string, any>;
  allowed_domains: string[];
  show_badge: boolean;
  created_by: string;
  created_at: string;
}

export interface CreateWidgetInstancePayload {
  workspace_id: string | null;
  type_id: string;
  public_id: string;
  status: string;
  config: Record<string, any>;
  allowed_domains?: string[];
  show_badge?: boolean;
  created_by?: string;
}
