// services/api/app/api/instance/[publicId]/route.ts
// Paris MVP — Instance Load/Save (Phase-1)
// STATUS: Implements GET and PUT (update-only) for widget_instances by public_id.
// RUNTIME: node (service-role server only)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Params = { params: { publicId: string } };

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service credentials are missing');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function shape(row: any) {
  return {
    publicId: row.public_id,
    status: row.status,
    config: row.config ?? {},
    updated_at: row.updated_at,
  };
}

// GET /api/instance/:publicId
export async function GET(_req: Request, { params }: Params) {
  try {
    const supabase = getAdmin();
    const { data, error } = await supabase
      .from('widget_instances')
      .select('public_id,status,config,updated_at')
      .eq('public_id', params.publicId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 });
    if (!data)  return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json(shape(data), { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'SERVER_ERROR', details: err?.message ?? String(err) }, { status: 500 });
  }
}

// PUT /api/instance/:publicId
// Body: { config: object, status?: 'draft'|'published'|'inactive' }
export async function PUT(req: Request, { params }: Params) {
  try {
    const supabase = getAdmin();
    const body = await safeJson(req);
    if (!body.ok) {
      return NextResponse.json([{ path: 'body', message: body.error }], { status: 422 });
    }
    const { config, status } = body.value as { config?: unknown; status?: string };

    if (config === undefined || config === null || typeof config !== 'object' || Array.isArray(config)) {
      return NextResponse.json([{ path: 'config', message: 'config must be an object' }], { status: 422 });
    }
    if (status && !['draft', 'published', 'inactive'].includes(status)) {
      return NextResponse.json([{ path: 'status', message: 'invalid status' }], { status: 422 });
    }

    const { data: exists, error: selErr } = await supabase
      .from('widget_instances')
      .select('public_id')
      .eq('public_id', params.publicId)
      .maybeSingle();

    if (selErr)   return NextResponse.json({ error: 'DB_ERROR', details: selErr.message }, { status: 500 });
    if (!exists)  return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const update: any = { config };
    if (status) update.status = status;

    const { data, error } = await supabase
      .from('widget_instances')
      .update(update)
      .eq('public_id', params.publicId)
      .select('public_id,status,config,updated_at')
      .single();

    if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 });
    return NextResponse.json(shape(data), { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'SERVER_ERROR', details: err?.message ?? String(err) }, { status: 500 });
  }
}

async function safeJson(req: Request): Promise<{ ok: true; value: any } | { ok: false; error: string }> {
  try {
    const txt = await req.text();
    if (!txt) return { ok: false, error: 'empty body' };
    return { ok: true, value: JSON.parse(txt) };
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
}


