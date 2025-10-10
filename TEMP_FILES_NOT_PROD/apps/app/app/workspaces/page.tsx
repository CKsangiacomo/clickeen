import Link from 'next/link';
import { createSupabaseServer, getCurrentUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function WorkspacesIndex() {
  const user = await getCurrentUser();
  if (!user) {
    return <main style={{ padding:24 }}><h1>My Workspaces</h1><p>You must be signed in.</p></main>;
  }
  const db = createSupabaseServer();

  // fetch workspaces where current user is a member
  const { data: rows, error } = await db
    .from('workspace_members')
    .select('workspace_id, role, workspaces!inner(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return <main style={{ padding:24 }}><h1>My Workspaces</h1><p style={{color:'crimson'}}>Error loading workspaces.</p></main>;
  }

  const items = (rows || []).map((r: any) => ({
    id: r.workspaces?.id,
    name: r.workspaces?.name ?? r.workspace_id,
    role: r.role,
  }));

  return (
    <main style={{ padding:24, display:'grid', gap:16 }}>
      <h1>My Workspaces</h1>
      {!items.length && (
        <p style={{ color:'#555' }}>You're not a member of any workspaces yet.</p>
      )}
      <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:12 }}>
        {items.map((w: any) => (
          <li key={w.id} style={{ border:'1px solid #eee', borderRadius:10, padding:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:600 }}>{w.name}</div>
                <div style={{ color:'#777', fontSize:13 }}>Role: {w.role}</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <Link href={`/workspaces/${w.id}/members`} className="btn">Members</Link>
                <Link href={`/workspaces/${w.id}`} className="btn">Overview</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
