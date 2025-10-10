import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';

export async function POST(req: Request) {
  const { email } = await req.json();
  const supabase = createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_DASHBOARD_URL}/auth/confirm` }
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
