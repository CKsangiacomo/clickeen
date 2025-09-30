import { NextResponse } from 'next/server';
import type { PostgrestError } from '@supabase/supabase-js';
import { getServiceClient } from '/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface CreateInstancePayload {
  publicId?: string;
  status?: 'draft' | 'published' | 'inactive';
  widgetType?: string;
  templateId?: string;
  schemaVersion?: string;
  config?: Record<string, unknown>;
}

function normalizePublicId(id?: string) {
  if (id !== undefined && typeof id !== 'string') {
    throw new ValidationError('publicId must be a string', 'publicId');
  }

  const value = id?.trim() || globalThis.crypto?.randomUUID?.()?.replace(/[^a-z0-9-]/g, '').slice(0, 32) ||
    Math.random().toString(36).slice(2, 10);

  if (!/^[a-z0-9-]{6,64}$/.test(value)) {
    throw new ValidationError('publicId must be 6–64 chars (lowercase a-z, 0-9, or -)', 'publicId');
  }

  return value;
}

function normalizeStatus(status: string | undefined) {
  if (!status) return 'draft' as const;
  if (!['draft', 'published', 'inactive'].includes(status)) {
    throw new ValidationError('invalid status', 'status');
  }
  return status as 'draft' | 'published' | 'inactive';
}

function normalizeConfig(config: unknown) {
  if (config === undefined) return {};
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new ValidationError('config must be an object', 'config');
  }
  return config as Record<string, unknown>;
}

class ValidationError extends Error {
  constructor(message: string, public readonly path: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

async function readJson(req: Request) {
  const raw = await req.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CreateInstancePayload;
  } catch {
    throw new ValidationError('invalid JSON payload', 'body');
  }
}

export async function POST(req: Request) {
  try {
    const payload = await readJson(req);

    const publicId = normalizePublicId(payload.publicId);
    const status = normalizeStatus(payload.status);
    const config = normalizeConfig(payload.config);

    const record: Record<string, unknown> = {
      public_id: publicId,
      status,
      config,
    };

    if (payload.widgetType) record.widget_type = payload.widgetType;
    if (payload.templateId) record.template_id = payload.templateId;
    if (payload.schemaVersion) record.schema_version = payload.schemaVersion;

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('widget_instances')
      .insert([record])
      .select('public_id,status,config,updated_at')
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: 'ALREADY_EXISTS', details: 'publicId already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 });
    }

    return NextResponse.json(shapeInstance(data), { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json([{ path: err.path, message: err.message }], { status: 422 });
    }
    return NextResponse.json({ error: 'SERVER_ERROR', details: (err as Error).message ?? String(err) }, { status: 500 });
  }
}

function isUniqueViolation(error: PostgrestError) {
  return /duplicate key|unique constraint|23505/i.test(error.message);
}

function shapeInstance(row: any) {
  return {
    publicId: row.public_id,
    status: row.status,
    config: row.config ?? {},
    updatedAt: row.updated_at,
  };
}
