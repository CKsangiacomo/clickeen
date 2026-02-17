'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchParisJson } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type WorkspaceMembersResponse = {
  workspaceId: string;
  role: string;
  members: Array<{
    userId: string;
    role: string;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
};

export function TeamDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const workspaceId = context.workspaceId;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMembersResponse | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchParisJson<WorkspaceMembersResponse>(
          `/api/paris/workspaces/${encodeURIComponent(workspaceId)}/members`,
        );
        if (cancelled) return;
        setMembers(payload);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setMembers(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (me.loading) return <section className="roma-module-surface">Loading team context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!workspaceId) {
    return <section className="roma-module-surface">No workspace membership found for team controls.</section>;
  }

  return (
    <section className="roma-module-surface">
      <p>
        Workspace: {context.workspaceName || workspaceId}
        {context.workspaceSlug ? ` (${context.workspaceSlug})` : ''}
      </p>

      {loading ? <p>Loading workspace members...</p> : null}
      {error ? <p>Failed to load workspace members: {error}</p> : null}

      {members ? (
        <table className="roma-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.members.map((member) => (
              <tr key={member.userId}>
                <td>{member.userId}</td>
                <td>{member.role}</td>
                <td>{member.createdAt ?? 'unknown'}</td>
              </tr>
            ))}
            {!loading && members.members.length === 0 ? (
              <tr>
                <td colSpan={3}>No members found for this workspace.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}

      <p>Invite/revoke flows are intentionally blocked until invite schema + audit tables are introduced.</p>
    </section>
  );
}
