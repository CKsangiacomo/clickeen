'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveAccountPolicyFromRomaAuthz, resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AccountMembersResponse = {
  accountId: string;
  role: string;
  members: Array<{
    userId: string;
    role: string;
    createdAt: string | null;
    profile: {
      displayName: string;
      primaryEmail: string;
    } | null;
  }>;
};

type AccountInvitationsResponse = {
  accountId: string;
  role: string;
  invitations: Array<{
    invitationId: string;
    email: string;
    role: string;
    expiresAt: string;
    acceptToken: string;
  }>;
};

function resolveErrorReason(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  return String((error as { reasonKey?: unknown }).reasonKey || fallback);
}

export function TeamDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const policy = useMemo(
    () => (context.accountId ? resolveAccountPolicyFromRomaAuthz(me.data, context.accountId) : null),
    [context.accountId, me.data],
  );
  const canManage = policy?.role === 'owner' || policy?.role === 'admin';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<AccountMembersResponse | null>(null);
  const [invitations, setInvitations] = useState<AccountInvitationsResponse | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
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
      const response = await fetch(`/api/accounts/${encodeURIComponent(accountId)}/members`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as AccountMembersResponse | { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      const parsed = payload as AccountMembersResponse | null;
      if (!parsed || !Array.isArray(parsed.members)) {
        throw new Error('coreui.errors.payload.invalid');
      }
      setMembers(parsed);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMembers(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  const refreshInvitations = useCallback(async () => {
    if (!accountId || !canManage) {
      setInvitations(null);
      setInviteError(null);
      return;
    }

    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(accountId)}/invitations`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as
        | AccountInvitationsResponse
        | { error?: unknown }
        | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      const parsed = payload as AccountInvitationsResponse | null;
      if (!parsed || !Array.isArray(parsed.invitations)) {
        throw new Error('coreui.errors.payload.invalid');
      }
      setInvitations(parsed);
      setInviteError(null);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError);
      setInvitations(null);
      setInviteError(message);
    }
  }, [accountId, canManage]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  useEffect(() => {
    void refreshInvitations();
  }, [refreshInvitations]);

  const issueInvitation = useCallback(async () => {
    if (!accountId || !canManage) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(accountId)}/invitations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      setInviteEmail('');
      setInviteRole('viewer');
      await refreshInvitations();
    } catch (nextError) {
      setInviteError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setInviteLoading(false);
    }
  }, [accountId, canManage, inviteEmail, inviteRole, refreshInvitations]);

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      if (!accountId || !canManage) return;
      setInviteLoading(true);
      setInviteError(null);
      try {
        const response = await fetch(
          `/api/accounts/${encodeURIComponent(accountId)}/invitations/${encodeURIComponent(invitationId)}`,
          {
            method: 'DELETE',
          },
        );
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        if (!response.ok) {
          throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
        }
        await refreshInvitations();
      } catch (nextError) {
        setInviteError(nextError instanceof Error ? nextError.message : String(nextError));
      } finally {
        setInviteLoading(false);
      }
    },
    [accountId, canManage, refreshInvitations],
  );

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
                <th className="table-header label-s">Member</th>
                <th className="table-header label-s">Role</th>
                <th className="table-header label-s">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.members.map((member) => (
                <tr key={member.userId}>
                  <td className="body-s">
                    <Link href={`/team/${encodeURIComponent(member.userId)}`} className="diet-btn-txt" data-size="md" data-variant="line2">
                      <span className="diet-btn-txt__label body-m">{member.profile?.displayName || member.userId}</span>
                    </Link>
                    <div className="body-s">{member.profile?.primaryEmail ?? member.userId}</div>
                  </td>
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

      {canManage ? (
        <>
          <section className="rd-canvas-module">
            <h2 className="heading-h4">Invite people</h2>
            <p className="body-s">
              Invitations are Berlin-owned. Until delivery infrastructure exists, Team shows the manual accept path to share.
            </p>
            {inviteError ? <p className="body-m">{inviteError}</p> : null}
            <div className="roma-form-grid">
              <label className="roma-field">
                <span className="label-s">Email</span>
                <input
                  className="roma-input body-m"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  disabled={inviteLoading}
                />
              </label>
              <label className="roma-field">
                <span className="label-s">Role</span>
                <select
                  className="roma-input body-m"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value)}
                  disabled={inviteLoading}
                >
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option>
                  <option value="admin">admin</option>
                </select>
              </label>
            </div>
            <div className="rd-canvas-module__actions" style={{ justifyContent: 'flex-start' }}>
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="solid"
                type="button"
                onClick={() => void issueInvitation()}
                disabled={inviteLoading || !inviteEmail.trim()}
              >
                <span className="diet-btn-txt__label body-m">{inviteLoading ? 'Saving...' : 'Create invitation'}</span>
              </button>
            </div>
          </section>

          <section className="rd-canvas-module">
            <h2 className="heading-h4">Pending invitations</h2>
            {inviteError && !invitations ? <p className="body-m">{inviteError}</p> : null}
            <table className="roma-table">
              <thead>
                <tr>
                  <th className="table-header label-s">Email</th>
                  <th className="table-header label-s">Role</th>
                  <th className="table-header label-s">Expires</th>
                  <th className="table-header label-s">Accept path</th>
                  <th className="table-header label-s">Action</th>
                </tr>
              </thead>
              <tbody>
                {invitations?.invitations.map((invitation) => (
                  <tr key={invitation.invitationId}>
                    <td className="body-s">{invitation.email}</td>
                    <td className="body-s">{invitation.role}</td>
                    <td className="body-s">{invitation.expiresAt}</td>
                    <td className="body-s">
                      <code>/accept-invite/{invitation.acceptToken}</code>
                    </td>
                    <td className="body-s">
                      <button
                        className="diet-btn-txt"
                        data-size="md"
                        data-variant="line2"
                        type="button"
                        onClick={() => void revokeInvitation(invitation.invitationId)}
                        disabled={inviteLoading}
                      >
                        <span className="diet-btn-txt__label body-m">Revoke</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {!invitations || invitations.invitations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="body-s">
                      No pending invitations.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <section className="rd-canvas-module">
          <p className="body-m">Pending invitations are managed by account owners/admins.</p>
        </section>
      )}
    </>
  );
}
