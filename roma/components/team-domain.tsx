'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatAccountRoleLabel } from '../lib/format';
import { resolvePersonLabel } from '../lib/person-profile';
import { resolveAccountShellErrorCopy, resolveAccountShellReason } from '../lib/account-shell-copy';
import { ROMA_UI_COPY } from '../lib/ui-copy';
import { useRomaAccountApi } from './account-api';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { DieterTextfield } from './dieter-textfield';
import { useRomaAccountContext } from './roma-account-context';
import { RomaEmptyState, RomaLoadingState } from './roma-system-state';

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
  const { accountContext, accountPolicy } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const canManage = accountPolicy.role === 'owner' || accountPolicy.role === 'admin';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryPending, setRetryPending] = useState(false);
  const [members, setMembers] = useState<AccountMembersResponse | null>(null);
  const [invitations, setInvitations] = useState<AccountInvitationsResponse | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const accountId = accountContext.accountId;
  const invitationCommandPending = inviteLoading || revokingInvitationId !== null;

  const refreshMembers = useCallback(async (options?: { command?: boolean }) => {
    const command = options?.command === true;
    if (!command) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await accountApi.fetchRaw(`/api/account/team`, {
        method: 'GET',
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
      if (!command) setLoading(false);
    }
  }, [accountApi]);

  const retryMembers = useCallback(async () => {
    setRetryPending(true);
    try {
      await refreshMembers({ command: true });
    } finally {
      setRetryPending(false);
    }
  }, [refreshMembers]);

  const refreshInvitations = useCallback(async () => {
    if (!canManage) {
      setInvitations(null);
      setInviteError(null);
      return;
    }

    try {
      const response = await accountApi.fetchRaw(`/api/account/team/invitations`, {
        method: 'GET',
      });
      const payload = (await response.json().catch(() => null)) as AccountInvitationsResponse | { error?: unknown } | null;
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
  }, [accountApi, canManage]);

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
      const response = await accountApi.fetchRaw(`/api/account/team/invitations`, {
        method: 'POST',
        headers: accountApi.buildHeaders({ contentType: 'application/json' }),
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;
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
  }, [accountApi, accountId, canManage, inviteEmail, inviteRole, refreshInvitations]);

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      if (!accountId || !canManage) return;
      setRevokingInvitationId(invitationId);
      setInviteError(null);
      try {
        const response = await accountApi.fetchRaw(`/api/account/team/invitations/${encodeURIComponent(invitationId)}`, {
          method: 'DELETE',
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        if (!response.ok) {
          throw new Error(resolveAccountShellReason(payload, `HTTP_${response.status}`));
        }
        await refreshInvitations();
      } catch (nextError) {
        const reason = nextError instanceof Error ? nextError.message : String(nextError);
        setInviteError(resolveAccountShellErrorCopy(reason, 'Revoking the invitation failed. Please try again.'));
      } finally {
        setRevokingInvitationId(null);
      }
    },
    [accountApi, accountId, canManage, refreshInvitations],
  );

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountContext.accountLabel}</p>

        {error ? (
          <div className="roma-inline-stack" role="alert">
            <p className="body-m">{error}</p>
            <button
              className="diet-button"
              data-size="medium"
              data-type="tertiary"
              data-loading={retryPending || undefined}
              type="button"
              aria-busy={retryPending || undefined}
              onClick={() => void retryMembers()}
              disabled={retryPending}
            >
              {retryPending ? <span className="diet-spinner" aria-hidden="true" /> : null}
              <span className="diet-button__label">Retry</span>
            </button>
          </div>
        ) : null}
      </section>

      {loading && !members && !error ? <RomaLoadingState className="rd-canvas-module" /> : null}

      {members ? (
        <section className="rd-canvas-module">
          <div className="diet-table">
          <table className="diet-table__table">
            <thead>
              <tr>
                <th className="label-s">Member</th>
                <th className="label-s">Role</th>
                <th className="label-s">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.members.map((member) => (
                <tr key={member.userId}>
                  <td className="body-s">
                    <Link href={`/team/${encodeURIComponent(member.userId)}`} className="diet-button" data-size="medium" data-type="tertiary">
                      <span className="diet-button__label">{resolveMemberLabel(member)}</span>
                    </Link>
                    {member.profile?.primaryEmail ? <div className="body-s">{member.profile.primaryEmail}</div> : null}
                  </td>
                  <td className="body-s">{formatAccountRoleLabel(member.role)}</td>
                  <td className="body-s">{member.createdAt}</td>
                </tr>
              ))}
              {members.members.length === 0 ? (
                <tr>
                  <td colSpan={3} className="diet-data-table__state-cell">
                    <RomaEmptyState>{ROMA_UI_COPY.state.empty.teamMembers}</RomaEmptyState>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </section>
      ) : null}

      {canManage ? (
        <>
          <section className="rd-canvas-module">
            <h2 className="heading-4">Invite people</h2>
            <p className="body-s">Pending invitations appear here until they are accepted.</p>
            {inviteError ? <p className="body-m" role="alert">{inviteError}</p> : null}
            <div className="roma-form-grid">
              <DieterTextfield
                className="roma-field"
                controlSize="lg"
                label="Email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={invitationCommandPending}
              />
              <DieterDropdownActions
                className="roma-field"
                size="lg"
                label="Role"
                ariaLabel="Choose invitation role"
                value={inviteRole}
                onChange={setInviteRole}
                disabled={invitationCommandPending}
                options={[
                  { value: 'viewer', label: formatAccountRoleLabel('viewer') },
                  { value: 'editor', label: formatAccountRoleLabel('editor') },
                  { value: 'admin', label: formatAccountRoleLabel('admin') },
                ]}
              />
            </div>
            <div className="rd-canvas-module__actions" style={{ justifyContent: 'flex-start' }}>
              <button
                className="diet-button"
                data-size="medium"
                data-type="primary"
                data-loading={inviteLoading || undefined}
                type="button"
                aria-busy={inviteLoading || undefined}
                onClick={() => void issueInvitation()}
                disabled={invitationCommandPending || !inviteEmail.trim()}
              >
                {inviteLoading ? <span className="diet-spinner" aria-hidden="true" /> : null}
                <span className="diet-button__label">{inviteLoading ? 'Saving...' : 'Create invitation'}</span>
              </button>
            </div>
          </section>

          <section className="rd-canvas-module">
            <h2 className="heading-4">Pending invitations</h2>
            {inviteError && !invitations ? <p className="body-m" role="alert">{inviteError}</p> : null}
            <div className="diet-table">
            <table className="diet-table__table">
              <thead>
                <tr>
                  <th className="label-s">Email</th>
                  <th className="label-s">Role</th>
                  <th className="label-s">Expires</th>
                  <th className="label-s diet-table__cell--action">Action</th>
                </tr>
              </thead>
              <tbody>
                {invitations?.invitations.map((invitation) => (
                  <tr key={invitation.invitationId}>
                    <td className="body-s">{invitation.email}</td>
                    <td className="body-s">{formatAccountRoleLabel(invitation.role)}</td>
                    <td className="body-s">{invitation.expiresAt}</td>
                    <td className="body-s diet-table__cell--action">
                      <button
                        className="diet-button"
                        data-size="medium"
                        data-type="tertiary"
                        data-loading={revokingInvitationId === invitation.invitationId || undefined}
                        type="button"
                        aria-busy={revokingInvitationId === invitation.invitationId || undefined}
                        onClick={() => void revokeInvitation(invitation.invitationId)}
                        disabled={invitationCommandPending}
                      >
                        {revokingInvitationId === invitation.invitationId ? <span className="diet-spinner" aria-hidden="true" /> : null}
                        <span className="diet-button__label">
                          {revokingInvitationId === invitation.invitationId ? 'Revoking…' : 'Revoke'}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
                {!invitations ? (!inviteError ? (
                  <tr>
                    <td colSpan={4} className="diet-data-table__state-cell">
                      <RomaLoadingState />
                    </td>
                  </tr>
                ) : null) : invitations.invitations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="diet-data-table__state-cell">
                      <RomaEmptyState>{ROMA_UI_COPY.state.empty.invitations}</RomaEmptyState>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
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
