import { createSupabaseServer, getCurrentUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function acceptInvite(token: string, userId: string) {
  const db = createSupabaseServer();

  const { data: invite } = await db.from('invites')
    .select('workspace_id,email,role,token,expires_at,used_at,used_by')
    .eq('token', token).maybeSingle();
  if (!invite) return { ok: false, error: 'invalid_token' };
  if (invite.used_at || invite.used_by) return { ok: false, error: 'already_used' };
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) return { ok: false, error: 'expired' };

  await db.from('workspace_members').upsert({
    workspace_id: invite.workspace_id, user_id: userId, role: invite.role,
  });

  await db.from('invites').update({ used_at: new Date().toISOString(), used_by: userId }).eq('token', token);

  try {
    const { logAudit } = await import('@/lib/audit');
    await logAudit({
      action: 'invite_accepted',
      workspaceId: invite.workspace_id,
      entityType: 'invite',
      entityId: token,
      metadata: { email: invite.email, role: invite.role },
      userId
    });
  } catch {}

  return { ok: true, workspaceId: invite.workspace_id };
}

export default async function AcceptPage({ searchParams }: { searchParams: { token?: string }}) {
  const token = searchParams?.token || '';
  const user = await getCurrentUser();
  if (!token) return <main style={{ padding: 24 }}><h1>Invite</h1><p>Missing token.</p></main>;
  if (!user) return <main style={{ padding: 24 }}><h1>Invite</h1><p>You must be signed in to accept the invite. <a href="/auth/login">Sign in</a></p></main>;
  const res = await acceptInvite(token, user.id);
  if (!res.ok) return <main style={{ padding: 24 }}><h1>Invite</h1><p>{res.error}</p></main>;
  return null; // redirect handled by parent or we could redirect here
}
