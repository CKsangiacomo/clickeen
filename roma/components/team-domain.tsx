'use client';

import Link from 'next/link';
import type { MemberRole } from '@clickeen/ck-policy';
import { useCallback, useEffect, useState } from 'react';
import teamCopy from '../l10n/team/en.json';
import { formatAccountRoleLabel } from '../lib/format';
import { resolvePersonLabel } from '../lib/person-profile';
import ROMA_DIALOGS_UI_COPY from '../l10n/dialogs/en.json';
import { useRomaAccountApi } from './account-api';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { DieterTextfield } from './dieter-textfield';
import { useRomaAccountContext } from './roma-account-context';
import { RomaEmptyState, RomaLoadingState } from './roma-system-state';

type AccountMembersResponse = {
  accountId: string;
  role: MemberRole;
  members: Array<{
    userId: string;
    role: MemberRole;
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
  role: MemberRole;
  invitations: Array<{
    invitationId: string;
    email: string;
    role: MemberRole;
    expiresAt: string;
  }>;
};

function resolveMemberLabel(member: AccountMembersResponse['members'][number]): string | null {
  return resolvePersonLabel(member.profile);
}

export function TeamDomain() {
  const { accountContext, accountPolicy } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const canManage = accountPolicy.role === 'owner' || accountPolicy.role === 'admin';
  const [membersFailed, setMembersFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryPending, setRetryPending] = useState(false);
  const [members, setMembers] = useState<AccountMembersResponse | null>(null);
  const [invitations, setInvitations] = useState<AccountInvitationsResponse | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('viewer');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const [invitationsFailed, setInvitationsFailed] = useState(false);
  const invitationCommandPending = inviteLoading || revokingInvitationId !== null;

  const refreshMembers = useCallback(async (options?: { command?: boolean }) => {
    const command = options?.command === true;
    if (!command) {
      setLoading(true);
      setMembersFailed(false);
    }
    try {
      const payload = await accountApi.fetchJson<AccountMembersResponse>(`/api/account/team`, {
        method: 'GET',
      });
      setMembers(payload);
      setMembersFailed(false);
    } catch {
      setMembers(null);
      setMembersFailed(true);
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
      setInvitationsFailed(false);
      return;
    }

    try {
      const payload = await accountApi.fetchJson<AccountInvitationsResponse>(`/api/account/team/invitations`, {
        method: 'GET',
      });
      setInvitations(payload);
      setInvitationsFailed(false);
    } catch {
      setInvitations(null);
      setInvitationsFailed(true);
    }
  }, [accountApi, canManage]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  useEffect(() => {
    void refreshInvitations();
  }, [refreshInvitations]);

  const issueInvitation = useCallback(async () => {
    if (!canManage) return;
    setInviteLoading(true);
    try {
      await accountApi.fetchJson(`/api/account/team/invitations`, {
        method: 'POST',
        headers: accountApi.buildHeaders({ contentType: 'application/json' }),
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteEmail('');
      setInviteRole('viewer');
      await refreshInvitations();
    } catch {
    } finally {
      setInviteLoading(false);
    }
  }, [accountApi, canManage, inviteEmail, inviteRole, refreshInvitations]);

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      if (!canManage) return;
      setRevokingInvitationId(invitationId);
      try {
        await accountApi.fetchJson(`/api/account/team/invitations/${encodeURIComponent(invitationId)}`, {
          method: 'DELETE',
        });
        await refreshInvitations();
      } catch {
      } finally {
        setRevokingInvitationId(null);
      }
    },
    [accountApi, canManage, refreshInvitations],
  );

  return (
    <>
      <section className="rd-canvas-module">
        <p className="label-s">{teamCopy.account}</p>
        <p className="body-m">{accountContext.accountLabel}</p>

        {membersFailed ? (
          <div className="roma-inline-stack" role="alert">
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
              <span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.retry}</span>
            </button>
          </div>
        ) : null}
      </section>

      {loading && !members && !membersFailed ? <RomaLoadingState className="rd-canvas-module" /> : null}

      {members ? (
        <section className="rd-canvas-module">
          <div className="diet-table">
          <table className="diet-table__table">
            <thead>
              <tr>
                <th className="label-s">{teamCopy.member}</th>
                <th className="label-s">{teamCopy.role}</th>
                <th className="label-s">{teamCopy.joined}</th>
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
                    <RomaEmptyState>{teamCopy.noMembers}</RomaEmptyState>
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
            <h2 className="heading-4">{teamCopy.invitePeople}</h2>
            <div className="roma-form-grid">
              <DieterTextfield
                className="roma-field"
                controlSize="lg"
                label={teamCopy.email}
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={invitationCommandPending}
              />
              <DieterDropdownActions
                className="roma-field"
                size="lg"
                label={teamCopy.role}
                ariaLabel={teamCopy.chooseInvitationRole}
                value={inviteRole}
                onChange={(role) => setInviteRole(role as MemberRole)}
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
                <span className="diet-button__label">{inviteLoading ? teamCopy.creatingInvitation : teamCopy.createInvitation}</span>
              </button>
            </div>
          </section>

          <section className="rd-canvas-module">
            <h2 className="heading-4">{teamCopy.pendingInvitations}</h2>
            <div className="diet-table">
            <table className="diet-table__table">
              <thead>
                <tr>
                  <th className="label-s">{teamCopy.email}</th>
                  <th className="label-s">{teamCopy.role}</th>
                  <th className="label-s">{teamCopy.expires}</th>
                  <th className="label-s diet-table__cell--action">{teamCopy.action}</th>
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
                          {revokingInvitationId === invitation.invitationId ? teamCopy.revoking : teamCopy.revoke}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
                {!invitations ? (!invitationsFailed ? (
                  <tr>
                    <td colSpan={4} className="diet-data-table__state-cell">
                      <RomaLoadingState />
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={4} className="diet-data-table__state-cell">
                      <button className="diet-button" data-size="medium" data-type="tertiary" type="button" onClick={() => void refreshInvitations()}>
                        <span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.retry}</span>
                      </button>
                    </td>
                  </tr>
                )) : invitations.invitations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="diet-data-table__state-cell">
                      <RomaEmptyState>{teamCopy.noInvitations}</RomaEmptyState>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
