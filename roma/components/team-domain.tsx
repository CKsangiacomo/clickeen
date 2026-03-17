'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolvePersonLabel } from '../lib/person-profile';
import { resolveAccountShellErrorCopy, resolveAccountShellReason } from '../lib/account-shell-copy';
import { resolveAccountPolicyFromRomaAuthz, resolveActiveRomaContext, useRomaMe } from './use-roma-me';

type AccountMembersResponse = {
  accountId: string;
  role: string;
  members: Array<{
    userId: string;
    role: string;
    createdAt: string | null;
    profile: {
      givenName: string | null;
      familyName: string | null;
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
  }>;
};

function resolveMemberLabel(member: AccountMembersResponse['members'][number]): string {
  return resolvePersonLabel(member.profile, 'Team member');
}

export function TeamDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveActiveRomaContext(me.data), [me.data]);
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
        throw new Error(resolveAccountShellReason(payload, `HTTP_${response.status}`));
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
      setError(resolveAccountShellErrorCopy(message, 'Failed to load team members. Please try again.'));
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
        throw new Error(resolveAccountShellReason(payload, `HTTP_${response.status}`));
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
      setInviteError(resolveAccountShellErrorCopy(message, 'Failed to load invitations. Please try again.'));
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
        throw new Error(resolveAccountShellReason(payload, `HTTP_${response.status}`));
      }
      setInviteEmail('');
      setInviteRole('viewer');
      await refreshInvitations();
    } catch (nextError) {
      const reason = nextError instanceof Error ? nextError.message : String(nextError);
      setInviteError(resolveAccountShellErrorCopy(reason, 'Creating the invitation failed. Please try again.'));
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
          throw new Error(resolveAccountShellReason(payload, `HTTP_${response.status}`));
        }
        await refreshInvitations();
      } catch (nextError) {
        const reason = nextError instanceof Error ? nextError.message : String(nextError);
        setInviteError(resolveAccountShellErrorCopy(reason, 'Revoking the invitation failed. Please try again.'));
      } finally {
        setInviteLoading(false);
      }
    },
    [accountId, canManage, refreshInvitations],
  );

  if (me.loading) return <section className="rd-canvas-module body-m">Loading team context...</section>;
  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module body-m">
        {resolveAccountShellErrorCopy(
          me.error ?? 'coreui.errors.auth.contextUnavailable',
          'Team is unavailable right now. Please try again.',
        )}
      </section>
    );
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account is available for team controls right now.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {context.accountName || 'Current account'}</p>
        {context.accountSlug ? <p className="body-s">Slug: {context.accountSlug}</p> : null}

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
                      <span className="diet-btn-txt__label body-m">{resolveMemberLabel(member)}</span>
                    </Link>
                    <div className="body-s">{member.profile?.primaryEmail ?? 'No primary email recorded'}</div>
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
              Invitations are Berlin-owned. Team shows pending invitations here until the Berlin acceptance flow is completed.
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
                    <td colSpan={4} className="body-s">
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
