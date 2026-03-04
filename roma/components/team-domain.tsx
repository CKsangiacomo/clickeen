'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchParisJson } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AccountMembersResponse = {
  accountId: string;
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<AccountMembersResponse | null>(null);
  const accountId = context.accountId;

  const refreshMembers = useCallback(async () => {
    if (!accountId) {
      setMembers(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchParisJson<AccountMembersResponse>(
        `/api/paris/accounts/${encodeURIComponent(accountId)}/members`,
        { method: 'GET' },
      );
      setMembers(payload);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMembers(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  if (me.loading) return <section className="rd-canvas-module body-m">Loading team context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account membership found for team controls.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountId}</p>

        {error ? (
          <div className="roma-inline-stack">
            <p className="body-m">{error}</p>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="line2"
              type="button"
              onClick={() => void refreshMembers()}
              disabled={loading}
            >
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
                    No members found for this account.
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
