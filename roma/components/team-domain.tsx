'use client';

import { useEffect, useMemo, useState } from 'react';
import { resolveBootstrapDomainState } from './bootstrap-domain-state';
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
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMembersResponse | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setMembers(null);
      setError(null);
      return;
    }
    const snapshot = me.data?.domains?.team ?? null;
    const hasDomainPayload = Boolean(snapshot && snapshot.workspaceId === workspaceId && Array.isArray(snapshot.members));
    const domainState = resolveBootstrapDomainState({
      data: me.data,
      domainKey: 'team',
      hasDomainPayload,
    });
    if (!hasDomainPayload || domainState.kind !== 'ok') {
      setMembers(null);
      setError(domainState.reasonKey);
      return;
    }
    const safeSnapshot = snapshot as NonNullable<typeof snapshot>;
    setMembers(safeSnapshot);
    setError(null);
  }, [workspaceId, me.data]);

  if (me.loading) return <section className="rd-canvas-module body-m">Loading team context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!workspaceId) {
    return <section className="rd-canvas-module body-m">No workspace membership found for team controls.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">
          Workspace: {context.workspaceName || workspaceId}
          {context.workspaceSlug ? ` (${context.workspaceSlug})` : ''}
        </p>

        {error ? (
          <div className="roma-inline-stack">
            <p className="body-m">roma.errors.bootstrap.domain_unavailable</p>
            <p className="body-m">{error}</p>
            <button className="diet-btn-txt" data-size="md" data-variant="line2" type="button" onClick={() => void me.reload()}>
              <span className="diet-btn-txt__label body-m">Retry</span>
            </button>
          </div>
        ) : null}
      </section>

      {members ? (
        <section className="rd-canvas-module">
          <table className="roma-table">
            <thead>
              <tr>
                <th className="table-header label-s">User ID</th>
                <th className="table-header label-s">Role</th>
                <th className="table-header label-s">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.members.map((member) => (
                <tr key={member.userId}>
                  <td className="body-s">{member.userId}</td>
                  <td className="body-s">{member.role}</td>
                  <td className="body-s">{member.createdAt ?? 'unknown'}</td>
                </tr>
              ))}
              {members.members.length === 0 ? (
                <tr>
                  <td colSpan={3} className="body-s">
                    No members found for this workspace.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="rd-canvas-module">
        <p className="body-m">Invite/revoke flows are intentionally blocked until invite schema + audit tables are introduced.</p>
      </section>
    </>
  );
}
