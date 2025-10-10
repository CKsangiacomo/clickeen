import { createSupabaseServer, getCurrentUser } from '@/lib/supabase';
import { isOwnerOrAdmin } from '@/lib/roles';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { RateLimiter } from '@/lib/rateLimiter';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
const inviteLimiter = new RateLimiter(60_000, 5); // 5/min per IP

async function getMyMembership(workspaceId: string, userId: string) {
  const db = createSupabaseServer();
  const { data } = await db
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.role ?? null;
}

async function fetchData(workspaceId: string) {
  const db = createSupabaseServer();
  const [{ data: ws }, { data: members }, { data: invites }] = await Promise.all([
    db.from('workspaces').select('id,name,created_by').eq('id', workspaceId).single(),
    db.from('workspace_members').select('user_id,role,created_at').eq('workspace_id', workspaceId).order('created_at'),
    db.from('invites').select('email,role,token,expires_at,created_at,used_at,used_by').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
  ]);
  return { ws, members: members || [], invites: invites || [] };
}

async function createInvite(formData: FormData) {
  'use server';
  const workspaceId = String(formData.get('workspaceId') || '');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const role = (String(formData.get('role') || 'editor') as any);
  if (!workspaceId || !email) return;

  const ip = headers().get('x-forwarded-for') || 'unknown';
  if (!inviteLimiter.check(ip)) throw new Error('rate_limited');
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!ok) throw new Error('invalid_email');

  const db = createSupabaseServer();
  const user = await getCurrentUser();
  if (!user) throw new Error('not_authenticated');

  // Permission check via data, enforced again by RLS
  const { data: me } = await db
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!me || !['owner','admin'].includes(me.role)) throw new Error('not_authorized');

  const nowIso = new Date().toISOString();
  const { data: existing } = await db
    .from('invites')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .is('used_at', null)
    .gte('expires_at', nowIso)
    .maybeSingle();
  if (existing) throw new Error('invite_exists');

  const token = crypto.randomUUID();
  const { error } = await db.from('invites').insert({
    workspace_id: workspaceId, email, role, token, created_by: user.id,
    expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  });
  if (error) throw error;

  await logAudit({
    action: 'invite_created',
    workspaceId,
    entityType: 'invite',
    entityId: token,
    metadata: { email, role },
    userId: user.id
  });

  revalidatePath(`/workspaces/${workspaceId}/members`);
}

export default async function MembersPage({ params }: { params: { id: string }}) {
  const workspaceId = params.id;
  const user = await getCurrentUser();
  if (!user) {
    return <main style={{ padding:24 }}><h1>Workspace Members</h1><p>You must be signed in.</p></main>;
  }
  const myRole = await getMyMembership(workspaceId, user.id);
  const { ws, members, invites } = await fetchData(workspaceId);
  const inviteUrlBase = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';

  return (
    <main style={{ padding: 24, display: 'grid', gap: 24 }}>
      <h1>Workspace Members</h1>
      {ws ? (
        <p>
          <b>{ws.name}</b> (id: {ws.id})
          {myRole && <span style={{ marginLeft: 8, fontSize: 12, color: '#777', padding: '2px 6px', border: '1px solid #ddd', borderRadius: 4 }}>Role: {myRole}</span>}
        </p>
      ) : <p>Workspace not found</p>}

      <section>
        <h2>Members</h2>
        <table style={{ width: '100%', borderCollapse:'collapse' }}>
          <thead><tr><th align="left">User ID</th><th align="left">Role</th><th align="left">Joined</th></tr></thead>
          <tbody>
            {members.map((m: any) => (
              <tr key={m.user_id}>
                <td style={{ padding: '6px 8px', borderTop: '1px solid #eee' }}>{m.user_id}</td>
                <td style={{ padding: '6px 8px', borderTop: '1px solid #eee' }}>{m.role}</td>
                <td style={{ padding: '6px 8px', borderTop: '1px solid #eee' }}>{new Date(m.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!members.length && <tr><td colSpan={3} style={{ padding: 8, color:'#777' }}>No members yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Invite a teammate</h2>
        {isOwnerOrAdmin(myRole) ? (
          <form action={createInvite} style={{ display: 'flex', gap: 12, flexWrap:'wrap' }}>
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input name="email" placeholder="teammate@example.com" required style={{ padding:8, border:'1px solid #ddd', borderRadius:8 }} />
            <select name="role" defaultValue="editor" style={{ padding:8, border:'1px solid #ddd', borderRadius:8 }}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8 }}>Create invite</button>
          </form>
        ) : (
          <p style={{ color:'#777' }}>Only workspace owners or admins can send invitations.</p>
        )}
      </section>

      <section>
        <h2>Pending invites</h2>
        <table style={{ width: '100%', borderCollapse:'collapse' }}>
          <thead><tr><th align="left">Email</th><th align="left">Role</th><th align="left">Token</th><th align="left">Accept link</th><th align="left">Created</th></tr></thead>
          <tbody>
            {invites.map((i: any) => {
              const link = `${inviteUrlBase}/invites/accept?token=${encodeURIComponent(i.token)}`;
              return (
                <tr key={i.token}>
                  <td style={{ padding: '6px 8px', borderTop: '1px solid #eee' }}>{i.email}</td>
                  <td style={{ padding: '6px 8px', borderTop: '1px solid #eee' }}>{i.role}</td>
                  <td style={{ padding: '6px 8px', borderTop: '1px solid #eee', fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{i.token}</td>
                  <td style={{ padding: '6px 8px', borderTop: '1px solid #eee' }}><a href={link} target="_blank">Accept</a></td>
                  <td style={{ padding: '6px 8px', borderTop: '1px solid #eee' }}>{new Date(i.created_at).toLocaleString()}</td>
                </tr>
              );
            })}
            {!invites.length && <tr><td colSpan={5} style={{ padding: 8, color:'#777' }}>No invites yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
