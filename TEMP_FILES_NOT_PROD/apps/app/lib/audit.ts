import { headers } from 'next/headers';
import { supabaseAdmin } from './supabaseServer';

export async function logAudit(input: {
  action: string;
  workspaceId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  userId?: string; // dev shim (DEV_USER_ID)
}) {
  try {
    const db = supabaseAdmin(); // dev-only OK
    const h = headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0] || null;
    const ua = h.get('user-agent') || null;

    await db.from('audit_logs').insert({
      workspace_id: input.workspaceId ?? null,
      user_id: input.userId ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? null,
      ip_address: ip,
      user_agent: ua,
    });
  } catch (e) {
    console.error('audit log failed (ignored):', e);
  }
}
