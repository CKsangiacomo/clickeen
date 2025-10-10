import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({} as any));
    const email: string = body?.email || '';
    const type: string = body?.type || 'contact-form';
    const config = (body?.config ?? {}) as Record<string, unknown>;

    const { data, error } = await supabase.rpc('create_widget_with_instance', {
      p_name: `Anonymous Widget - ${email}`,
      p_type: type,
      p_config: config,
    });

    if (error) {
      console.error('RPC error:', error.message || error);
      return NextResponse.json({ error: 'Internal server error', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({
      publicKey: (data as any)?.public_key,
      publicId: (data as any)?.public_id
    });
  } catch (e) {
    console.error('Anon create failed:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
