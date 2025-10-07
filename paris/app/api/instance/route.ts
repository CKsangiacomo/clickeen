import { NextResponse } from 'next/server';
import type { PostgrestError } from '@supabase/supabase-js';
import { getServiceClient } from '@paris/lib/supabaseAdmin';
import { loadInstance, shapeInstanceResponse } from '@paris/lib/instances';
import { getTemplateDescriptor, validateConfig } from '@paris/lib/geneva';

export const runtime = 'nodejs';

interface CreateInstancePayload {
  publicId?: string;
  status?: 'draft' | 'published' | 'inactive';
  widgetType?: string;
  templateId?: string;
  schemaVersion?: string;
  config?: Record<string, unknown>;
}

function generatePublicId() {
  // Phase-1 contract: wgt_{base36_6}
  const rand = Math.random().toString(36).slice(2, 8);
  return `wgt_${rand}`;
}

function normalizePublicId(id?: string) {
  if (id !== undefined && typeof id !== 'string') {
    throw new ValidationError('publicId must be a string', 'publicId');
  }
  const value = id?.trim() || generatePublicId();
  // Enforce prefix and basic format
  if (!/^wgt_[a-z0-9]{6}$/.test(value)) {
    throw new ValidationError('publicId must match wgt_{base36_6}', 'publicId');
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
    // Phase-1 note: creating an instance without a backing widget (workspace)
    // leads to orphan rows due to the NOT NULL FK on widget_id.
    // The primary flow is `/api/instance/from-template` which creates a widget row
    // and associates the instance properly. Until a workspace-aware
    // implementation for this endpoint is introduced, return a clear error
    // instructing clients to use the supported flow.
    return NextResponse.json(
      [{ path: 'endpoint', message: 'Use /api/instance/from-template (workspace-scoped) in Phase-1' }],
      { status: 422 },
    );

    // The code path below remains as reference but is not executed because of
    // the early return above. When enabling this endpoint, ensure a widget row
    // is created (workspace-scoped) and its id set as widget_id on the insert.

    const payload = await readJson(req);

    const publicId = normalizePublicId(payload.publicId);
    const status = normalizeStatus(payload.status);
    const config = normalizeConfig(payload.config);

    // Determine widgetType + schemaVersion
    let widgetType = payload.widgetType;
    let schemaVersion = payload.schemaVersion ?? undefined;
    if (!widgetType && payload.templateId) {
      const client = getServiceClient();
      const tpl = await getTemplateDescriptor(client, payload.templateId as string);
      if (!tpl) {
        return NextResponse.json([{ path: 'templateId', message: 'unknown templateId' }], { status: 422 });
      }
      const t = tpl!;
      widgetType = t.widgetType;
      schemaVersion = t.schemaVersion;
    }
    if (!widgetType || !schemaVersion) {
      return NextResponse.json([
        { path: 'widgetType', message: 'widgetType is required (or provide templateId)' },
        { path: 'schemaVersion', message: 'schemaVersion is required (or derive from templateId)' },
      ], { status: 422 });
    }

    // Validate config against Geneva schema
    const supabase = getServiceClient();
    const result = await validateConfig(supabase, widgetType as string, schemaVersion as string, config);
    if (!result.ok) {
      return NextResponse.json(result.errors, { status: 422 });
    }

    const record: Record<string, unknown> = {
      public_id: publicId,
      status,
      config,
      template_id: payload.templateId,
      schema_version: schemaVersion,
    };

    const { error } = await supabase
      .from('widget_instances')
      .insert([record]);

    if (error) {
      if (isUniqueViolation(error as PostgrestError)) {
        return NextResponse.json({ error: 'ALREADY_EXISTS', details: 'publicId already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'DB_ERROR', details: (error as PostgrestError).message }, { status: 500 });
    }

    const created = await loadInstance(supabase, publicId);
    if (!created) {
      return NextResponse.json({ error: 'SERVER_ERROR', details: 'Instance created but could not be reloaded' }, { status: 500 });
    }

    return NextResponse.json(shapeInstanceResponse(created as any), { status: 201 });
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
