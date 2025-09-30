import { NextResponse } from 'next/server';
import { getServiceClient } from '/lib/supabaseAdmin';

export const runtime = 'nodejs';

type Params = { params: { publicId: string } };

type UpdatePayload = {
  config?: Record<string, unknown>;
  status?: 'draft' | 'published' | 'inactive';
};

class ValidationError extends Error {
  constructor(message: string, public readonly path: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

async function parseJson(req: Request) {
  const raw = await req.text();
  if (!raw) throw new ValidationError('body must not be empty', 'body');
  try {
    return JSON.parse(raw) as UpdatePayload;
  } catch {
    throw new ValidationError('invalid JSON payload', 'body');
  }
}

function assertConfig(config: unknown) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new ValidationError('config must be an object', 'config');
  }
  return config as Record<string, unknown>;
}

function assertStatus(status: unknown) {
  if (status === undefined) return undefined;
  if (status !== 'draft' && status !== 'published' && status !== 'inactive') {
    throw new ValidationError('invalid status', 'status');
  }
  return status;
}

function shape(row: any) {
  return {
    publicId: row.public_id,
    status: row.status,
    config: row.config ?? {},
    updatedAt: row.updated_at,
  };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('widget_instances')
      .select('public_id,status,config,updated_at')
      .eq('public_id', params.publicId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(shape(data));
  } catch (err) {
    return NextResponse.json({ error: 'SERVER_ERROR', details: (err as Error).message ?? String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const payload = await parseJson(req);
    const config = assertConfig(payload.config);
    const status = assertStatus(payload.status);

    const supabase = getServiceClient();

    const { data: existing, error: selectError } = await supabase
      .from('widget_instances')
      .select('public_id')
      .eq('public_id', params.publicId)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json({ error: 'DB_ERROR', details: selectError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const update: Record<string, unknown> = { config };
    if (status) update.status = status;

    const { data, error } = await supabase
      .from('widget_instances')
      .update(update)
      .eq('public_id', params.publicId)
      .select('public_id,status,config,updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 });
    }

    return NextResponse.json(shape(data));
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json([{ path: err.path, message: err.message }], { status: 422 });
    }
    return NextResponse.json({ error: 'SERVER_ERROR', details: (err as Error).message ?? String(err) }, { status: 500 });
  }
}
