import { AuthError } from '@paris/lib/auth';
import type { AdminClient } from '@paris/lib/supabaseAdmin';

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

export class TokenError extends Error {
  constructor(public readonly code: 'TOKEN_INVALID' | 'TOKEN_REVOKED') {
    super(code);
    this.name = 'TokenError';
  }
}

export async function loadInstance(client: AdminClient, publicId: string): Promise<InstanceRecord | null> {
  const { data: instance, error: instanceError } = await client
    .from('widget_instances')
    .select('id, public_id, status, widget_id, draft_token, template_id, schema_version, config, updated_at')
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
    .select('id, workspace_id, type')
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
    widgetType: (widget as any)?.type ?? null,
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
    .select('id, public_id, status, widget_id, draft_token, template_id, schema_version, config, updated_at')
    .eq('draft_token', draftToken)
    .maybeSingle();

  if (error) throw error;
  if (!instance) return null;

  const { data: widget, error: widgetError } = await client
    .from('widgets')
    .select('id, workspace_id, type')
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
    widgetType: (widget as any)?.type ?? null,
    templateId: instance.template_id ?? null,
    schemaVersion: instance.schema_version ?? null,
    config: instance.config ?? {},
    updatedAt: instance.updated_at,
    workspaceId: widget.workspace_id,
  } satisfies InstanceRecord;
}

export type BrandingConfig = { hide: boolean; enforced: boolean };

export function shapeInstanceResponse(record: InstanceRecord, branding?: BrandingConfig) {
  return {
    publicId: record.publicId,
    status: record.status,
    widgetType: record.widgetType,
    templateId: record.templateId,
    schemaVersion: record.schemaVersion,
    config: record.config,
    // Default to safe, enforced branding unless a plan-based branding is provided
    branding: branding ?? { hide: false, enforced: true },
    updatedAt: record.updatedAt,
  };
}

export async function computeBranding(client: AdminClient, workspaceId: string): Promise<BrandingConfig> {
  const { data: ws, error: werr } = await client
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .maybeSingle();
  if (werr) throw werr;
  const planId = (ws?.plan as string) ?? 'free';
  const { data: feats, error: ferr } = await client
    .from('plan_features')
    .select('feature_key, enabled')
    .eq('plan_id', planId);
  if (ferr) throw ferr;
  const find = (k: string) => feats?.find((r) => r.feature_key === k || r.feature_key === k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`))?.enabled ?? false;
  const brandingRemovable = find('brandingRemovable');
  return { hide: false, enforced: !brandingRemovable };
}

export async function validateEmbedOrDraftToken(client: AdminClient, instance: InstanceRecord, token: string) {
  if (instance.draftToken && token === instance.draftToken) {
    return { kind: 'draft' as const };
  }

  const { data, error } = await client
    .from('embed_tokens')
    .select('token, expires_at, revoked_at')
    .eq('widget_instance_id', instance.id)
    .eq('token', token)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new TokenError('TOKEN_INVALID');
  if (data.revoked_at) throw new TokenError('TOKEN_REVOKED');
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    throw new TokenError('TOKEN_REVOKED');
  }

  return { kind: 'embed' as const };
}

export async function ensureInstanceWritable(instance: InstanceRecord) {
  if (instance.status === 'inactive') {
    throw new AuthError('FORBIDDEN', 'Instance is inactive');
  }
}
