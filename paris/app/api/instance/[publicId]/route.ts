import { NextResponse } from 'next/server';
import { getServiceClient } from '@paris/lib/supabaseAdmin';
import { loadInstance, shapeInstanceResponse } from '@paris/lib/instances';

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
  return status as 'draft' | 'published' | 'inactive';
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const supabase = getServiceClient();
    const record = await loadInstance(supabase, params.publicId);
    if (!record) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json(shapeInstanceResponse(record));
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
    const existing = await loadInstance(supabase, params.publicId);
    if (!existing) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    const update: Record<string, unknown> = { config };
    if (status) update.status = status;

    const { error } = await supabase
      .from('widget_instances')
      .update(update)
      .eq('public_id', params.publicId);

    if (error) {
      return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 });
    }

    const refreshed = await loadInstance(supabase, params.publicId);
    if (!refreshed) {
      return NextResponse.json({ error: 'SERVER_ERROR', details: 'Instance updated but could not be reloaded' }, { status: 500 });
    }

    return NextResponse.json(shapeInstanceResponse(refreshed));
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json([{ path: err.path, message: err.message }], { status: 422 });
    }
    return NextResponse.json({ error: 'SERVER_ERROR', details: (err as Error).message ?? String(err) }, { status: 500 });
  }
}
