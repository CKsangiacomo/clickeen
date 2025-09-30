import { getServiceClient, type AdminClient } from '@paris/lib/supabaseAdmin';

export interface InstanceRecord {
  id: string;
  publicId: string;
  status: string;
  widgetId: string;
  draftToken: string | null;
  widgetType: string | null;
  templateId: string | null;
  schemaVersion: string | null;
  config: Record<string, unknown>;
  updatedAt: string;
  workspaceId: string;
}

export async function loadInstance(client: AdminClient, publicId: string): Promise<InstanceRecord | null> {
  const { data: instance, error: instanceError } = await client
    .from('widget_instances')
    .select('id, public_id, status, widget_id, draft_token, widget_type, template_id, schema_version, config, updated_at')
    .eq('public_id', publicId)
    .maybeSingle();

  if (instanceError) {
    throw instanceError;
  }

  if (!instance) {
    return null;
  }

  const { data: widget, error: widgetError } = await client
    .from('widgets')
    .select('id, workspace_id')
    .eq('id', instance.widget_id)
    .maybeSingle();

  if (widgetError) {
    throw widgetError;
  }

  if (!widget) {
    throw new Error('Widget not found for instance');
  }

  return {
    id: instance.id,
    publicId: instance.public_id,
    status: instance.status,
    widgetId: instance.widget_id,
    draftToken: instance.draft_token,
    widgetType: instance.widget_type ?? null,
    templateId: instance.template_id ?? null,
    schemaVersion: instance.schema_version ?? null,
    config: instance.config ?? {},
    updatedAt: instance.updated_at,
    workspaceId: widget.workspace_id,
  };
}

export async function loadInstanceByDraftToken(client: AdminClient, draftToken: string) {
  const { data: instance, error } = await client
    .from('widget_instances')
    .select('id, public_id, status, widget_id, draft_token, widget_type, template_id, schema_version, config, updated_at')
    .eq('draft_token', draftToken)
    .maybeSingle();

  if (error) throw error;
  if (!instance) return null;

  const { data: widget, error: widgetError } = await client
    .from('widgets')
    .select('id, workspace_id')
    .eq('id', instance.widget_id)
    .maybeSingle();

  if (widgetError) throw widgetError;
  if (!widget) throw new Error('Widget not found for instance');

  return {
    id: instance.id,
    publicId: instance.public_id,
    status: instance.status,
    widgetId: instance.widget_id,
    draftToken: instance.draft_token,
    widgetType: instance.widget_type ?? null,
    templateId: instance.template_id ?? null,
    schemaVersion: instance.schema_version ?? null,
    config: instance.config ?? {},
    updatedAt: instance.updated_at,
    workspaceId: widget.workspace_id,
  } satisfies InstanceRecord;
}

export function shapeInstanceResponse(record: InstanceRecord) {
  return {
    publicId: record.publicId,
    status: record.status,
    widgetType: record.widgetType,
    templateId: record.templateId,
    schemaVersion: record.schemaVersion,
    config: record.config,
    branding: {
      hide: false,
      enforced: record.status !== 'published',
    },
    updatedAt: record.updatedAt,
  };
}
