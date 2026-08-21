'use client';

import Link from 'next/link';
import type { MemberRole } from '@clickeen/ck-policy';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import teamCopy from '../l10n/team/en.json';
import ROMA_DIALOGS_UI_COPY from '../l10n/dialogs/en.json';
import { formatAccountRoleLabel } from '../lib/format';
import { resolvePersonLabel } from '../lib/person-profile';
import { useRomaAccountApi } from './account-api';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { RomaCommandConfirmationDialog } from './roma-command-confirmation-dialog';
import { useRomaAccountContext } from './roma-account-context';
import { RomaLoadingState } from './roma-system-state';

type TeamMemberProfile = {
  userId: string;
  primaryEmail: string;
  givenName: string | null;
  familyName: string | null;
  primaryLanguage: string | null;
  usePrimaryLanguageForUi: boolean;
  country: string | null;
  timezone: string | null;
};

type TeamMemberResponse = {
  accountId: string;
  role: string;
  member: {
    userId: string;
    role: MemberRole;
    createdAt: string | null;
    profile: TeamMemberProfile | null;
  };
};

type TeamMemberDomainProps = {
  memberId: string;
};

function resolveMemberDisplayName(profile: TeamMemberProfile | null): string | null {
  return resolvePersonLabel(profile);
}

function formatCountryValue(country: string | null): string | null {
  if (country === null) return null;
  try {
    const displayNames = new Intl.DisplayNames(undefined, { type: 'region' });
    return displayNames.of(country) || country;
  } catch {
    return country;
  }
}

export function TeamMemberDomain({ memberId }: TeamMemberDomainProps) {
  const { accountContext, accountPolicy, reload } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const router = useRouter();
  const canManage = accountPolicy.role === 'owner' || accountPolicy.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [retryPending, setRetryPending] = useState(false);
  const [member, setMember] = useState<TeamMemberResponse | null>(null);
  const [memberFailed, setMemberFailed] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);
  const [removeConfirmationOpen, setRemoveConfirmationOpen] = useState(false);
  const [roleDraft, setRoleDraft] = useState<MemberRole>('viewer');

  const refreshMember = useCallback(async (options?: { command?: boolean }) => {
    const command = options?.command === true;
    if (!command) {
      setLoading(true);
      setMemberFailed(false);
    }
    try {
      const payload = await accountApi.fetchJson<TeamMemberResponse>(`/api/account/team/members/${encodeURIComponent(memberId)}`, {
        method: 'GET',
      });
      setMember(payload);
      setRoleDraft(payload.member.role);
      setMemberFailed(false);
    } catch {
      setMember(null);
      setMemberFailed(true);
    } finally {
      if (!command) setLoading(false);
    }
  }, [accountApi, memberId]);

  const retryMember = useCallback(async () => {
    setRetryPending(true);
    try {
      await refreshMember({ command: true });
    } finally {
      setRetryPending(false);
    }
  }, [refreshMember]);

  useEffect(() => {
    void refreshMember();
  }, [refreshMember]);

  const saveRole = useCallback(async () => {
    if (!canManage || !member || member.member.role === 'owner' || roleDraft === 'owner') return;
    setSavingRole(true);
    try {
      const payload = await accountApi.fetchJson<TeamMemberResponse>(`/api/account/team/members/${encodeURIComponent(memberId)}`, {
        method: 'PATCH',
        headers: accountApi.buildHeaders({ contentType: 'application/json' }),
        body: JSON.stringify({ role: roleDraft }),
      });
      setMember(payload);
      setRoleDraft(payload.member.role);
      await reload();
    } catch {
    } finally {
      setSavingRole(false);
    }
  }, [accountApi, canManage, member, memberId, reload, roleDraft]);

  const removeMember = useCallback(async () => {
    if (!canManage || !member || member.member.role === 'owner') return false;
    setRemovingMember(true);
    try {
      await accountApi.fetchJson(`/api/account/team/members/${encodeURIComponent(memberId)}`, {
        method: 'DELETE',
      });
      setRemoveConfirmationOpen(false);
      router.push('/team');
      void reload();
      return true;
    } catch {
      return false;
    } finally {
      setRemovingMember(false);
    }
  }, [accountApi, canManage, member, memberId, reload, router]);

  return (
    <>
      <section className="rd-canvas-module roma-inline-stack" style={{ justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <p className="label-s">{teamCopy.account}</p>
          <p className="body-m">{accountContext.accountLabel}</p>
        </div>
        <Link className="diet-button" data-size="medium" data-type="tertiary" href="/team">
          <span className="diet-button__label">{teamCopy.back}</span>
        </Link>
      </section>

      {memberFailed ? (
        <section className="rd-canvas-module" role="alert">
          <button
            className="diet-button"
            data-size="medium"
            data-type="tertiary"
            data-loading={retryPending || undefined}
            type="button"
            aria-busy={retryPending || undefined}
            onClick={() => void retryMember()}
            disabled={retryPending}
          >
            {retryPending ? <span className="diet-spinner" aria-hidden="true" /> : null}
            <span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.retry}</span>
          </button>
        </section>
      ) : null}

      {loading && !member && !memberFailed ? <RomaLoadingState className="rd-canvas-module" /> : null}

      {member ? (
        <>
          <section className="rd-canvas-module">
            <div className="roma-inline-stack" style={{ justifyContent: 'space-between', gap: '12px' }}>
              <div>
                {resolveMemberDisplayName(member.member.profile) ? <h2 className="heading-3">{resolveMemberDisplayName(member.member.profile)}</h2> : null}
                {member.member.profile?.primaryEmail ? <p className="body-s">{member.member.profile.primaryEmail}</p> : null}
              </div>
              <div>
                <p className="label-s">{teamCopy.role}</p>
                <p className="body-m">{formatAccountRoleLabel(member.member.role)}</p>
                {member.member.createdAt ? <><p className="label-s">{teamCopy.joined}</p><p className="body-s">{member.member.createdAt}</p></> : null}
              </div>
            </div>
          </section>

          <section className="rd-canvas-module">
            <h3 className="heading-4">{teamCopy.membership}</h3>
            <div className="roma-inline-stack" style={{ alignItems: 'flex-end', gap: '12px' }}>
              <DieterDropdownActions
                className="roma-field"
                size="lg"
                label={teamCopy.role}
                ariaLabel={teamCopy.chooseMemberRole}
                value={roleDraft}
                onChange={(role) => setRoleDraft(role as MemberRole)}
                disabled={!canManage || member.member.role === 'owner' || savingRole}
                options={[
                  ...(roleDraft === 'owner' ? [{ value: 'owner', label: formatAccountRoleLabel('owner'), disabled: true }] : []),
                  { value: 'viewer', label: formatAccountRoleLabel('viewer') },
                  { value: 'editor', label: formatAccountRoleLabel('editor') },
                  { value: 'admin', label: formatAccountRoleLabel('admin') },
                ]}
              />
              <button
                className="diet-button"
                data-size="medium"
                data-type="primary"
                data-loading={savingRole || undefined}
                type="button"
                aria-busy={savingRole || undefined}
                onClick={() => void saveRole()}
                disabled={!canManage || member.member.role === 'owner' || savingRole || roleDraft === member.member.role}
              >
                {savingRole ? <span className="diet-spinner" aria-hidden="true" /> : null}
                <span className="diet-button__label">{savingRole ? teamCopy.savingRole : teamCopy.saveRole}</span>
              </button>
              <button
                className="diet-button"
                data-size="medium"
                data-type="tertiary"
                type="button"
                onClick={() => {
                  setRemoveConfirmationOpen(true);
                }}
                disabled={!canManage || member.member.role === 'owner' || removingMember}
              >
                <span className="diet-button__label">{teamCopy.removeMember}</span>
              </button>
            </div>
          </section>

          <section className="rd-canvas-module">
            <h3 className="heading-4">{teamCopy.person}</h3>
            <div className="roma-form-grid">
              <div className="roma-field">
                <span className="label-s">{teamCopy.firstName}</span>
                {member.member.profile?.givenName !== null && member.member.profile?.givenName !== undefined ? <p className="body-m">{member.member.profile.givenName}</p> : null}
              </div>
              <div className="roma-field">
                <span className="label-s">{teamCopy.lastName}</span>
                {member.member.profile?.familyName !== null && member.member.profile?.familyName !== undefined ? <p className="body-m">{member.member.profile.familyName}</p> : null}
              </div>
              <div className="roma-field">
                <span className="label-s">{teamCopy.primaryEmail}</span>
                {member.member.profile?.primaryEmail !== undefined ? <p className="body-m">{member.member.profile.primaryEmail}</p> : null}
              </div>
              <div className="roma-field">
                <span className="label-s">{teamCopy.primaryLanguage}</span>
                {member.member.profile?.primaryLanguage !== null && member.member.profile?.primaryLanguage !== undefined ? <p className="body-m">{member.member.profile.primaryLanguage}</p> : null}
              </div>
              <div className="roma-field">
                <span className="label-s">{teamCopy.country}</span>
                {formatCountryValue(member.member.profile?.country ?? null) ? <p className="body-m">{formatCountryValue(member.member.profile?.country ?? null)}</p> : null}
              </div>
              <div className="roma-field">
                <span className="label-s">{teamCopy.timezone}</span>
                {member.member.profile?.timezone !== null && member.member.profile?.timezone !== undefined ? <p className="body-m">{member.member.profile.timezone}</p> : null}
              </div>
            </div>
          </section>
        </>
      ) : null}
      <RomaCommandConfirmationDialog
        open={removeConfirmationOpen}
        title={teamCopy.removeMember}
        body={resolveMemberDisplayName(member?.member.profile ?? null)}
        confirmLabel={teamCopy.removeMember}
        pending={removingMember}
        onCancel={() => setRemoveConfirmationOpen(false)}
        onConfirm={() => {
          void removeMember();
        }}
      />
    </>
  );
}
