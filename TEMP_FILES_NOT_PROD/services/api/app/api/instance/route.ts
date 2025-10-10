// services/api/app/api/instance/route.ts
// Paris MVP — Instance Create (Phase-1)
// STATUS: Implements POST /api/instance to create widget_instances rows explicitly (no upsert).

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type CreateBody = { publicId?: string; status?: 'draft'|'published'|'inactive'; config?: unknown };

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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

async function safeJson(req: Request): Promise<{ ok: true; value: any } | { ok: false; error: string }> {
  try {
    const text = await req.text();
    if (!text) return { ok: true, value: {} };
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
}

// POST /api/instance
// Body (optional): { publicId?: string, status?: 'draft'|'published'|'inactive', config?: object }
// Notes:
// - publicId: if omitted, server generates crypto.randomUUID()
// - status: defaults to 'draft'; validation is strict to avoid drift from dbschemacontext
// - config: defaults to {}
export async function POST(req: Request) {
  try {
    const body = await safeJson(req);
    if (!body.ok) {
      return NextResponse.json([{ path: 'body', message: body.error }], { status: 422 });
    }
    const payload = body.value as CreateBody;

    let publicId = payload.publicId;
    if (publicId !== undefined && typeof publicId !== 'string') {
      return NextResponse.json([{ path: 'publicId', message: 'publicId must be a string' }], { status: 422 });
    }
    if (!publicId) {
      // Node 20 global crypto
      publicId = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)).toLowerCase();
    }
    // Basic sanity: keep it URL-safe
    if (!/^[a-z0-9-]{6,64}$/.test(publicId)) {
      return NextResponse.json([{ path: 'publicId', message: 'publicId must be 6–64 chars, lowercase a-z, 0-9, or -' }], { status: 422 });
    }

    const status = payload.status ?? 'draft';
    if (!['draft', 'published', 'inactive'].includes(status)) {
      return NextResponse.json([{ path: 'status', message: 'invalid status' }], { status: 422 });
    }

    const config = payload.config === undefined ? {} : payload.config;
    if (!isPlainObject(config)) {
      return NextResponse.json([{ path: 'config', message: 'config must be an object' }], { status: 422 });
    }

    const supabase = getAdmin();
    const { data, error } = await supabase
      .from('widget_instances')
      .insert([{ public_id: publicId, status, config }])
      .select('public_id,status,config,updated_at')
      .single();

    if (error) {
      // Handle unique violation politely if public_id is unique in DB
      const msg = (error as any)?.message || '';
      if (/duplicate key|unique constraint|23505/i.test(msg)) {
        return NextResponse.json({ error: 'ALREADY_EXISTS', details: 'publicId already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'DB_ERROR', details: msg }, { status: 500 });
    }

    return NextResponse.json(shape(data), { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'SERVER_ERROR', details: err?.message ?? String(err) }, { status: 500 });
  }
}


