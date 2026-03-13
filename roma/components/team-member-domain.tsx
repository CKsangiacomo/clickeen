'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolvePersonLabel } from '../lib/person-profile';
import { resolveAccountPolicyFromRomaAuthz, resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type TeamMemberProfile = {
  userId: string;
  primaryEmail: string;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
  primaryLanguage: string | null;
  country: string | null;
  timezone: string | null;
};

type TeamMemberResponse = {
  accountId: string;
  role: string;
  member: {
    userId: string;
    role: string;
    createdAt: string | null;
    profile: TeamMemberProfile | null;
  };
};

type TeamMemberDomainProps = {
  memberId: string;
};

const TEAM_MEMBER_REASON_COPY: Record<string, string> = {
  'coreui.errors.account.memberNotFound': 'That team member could not be found.',
  'coreui.errors.auth.required': 'You need to sign in again to manage team settings.',
  'coreui.errors.auth.forbidden': 'You do not have permission to manage this team member.',
  'coreui.errors.db.readFailed': 'Failed to load this team member. Please try again.',
  'coreui.errors.db.writeFailed': 'Saving the membership failed. Please try again.',
  'coreui.errors.payload.invalid': 'The membership update was invalid. Please try again.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
};

function resolveTeamMemberErrorCopy(reason: string, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = TEAM_MEMBER_REASON_COPY[normalized];
  if (mapped) return mapped;
  if (normalized.startsWith('HTTP_') || normalized.startsWith('coreui.')) return fallback;
  return normalized;
}

function resolveErrorReason(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  return String((error as { reasonKey?: unknown }).reasonKey || fallback);
}

function resolveMemberDisplayName(profile: TeamMemberProfile | null, memberId: string): string {
  return resolvePersonLabel(profile, memberId);
}

function formatNullableValue(value: string | null | undefined): string {
  const normalized = String(value || '').trim();
  return normalized || 'Not set';
}

function formatCountryValue(value: string | null | undefined): string {
  const country = String(value || '').trim();
  if (!country) return 'Not set';
  try {
    const displayNames = new Intl.DisplayNames(undefined, { type: 'region' });
    return displayNames.of(country) || country;
  } catch {
    return country;
  }
}

export function TeamMemberDomain({ memberId }: TeamMemberDomainProps) {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const policy = useMemo(
    () => (context.accountId ? resolveAccountPolicyFromRomaAuthz(me.data, context.accountId) : null),
    [context.accountId, me.data],
  );
  const canManage = policy?.role === 'owner' || policy?.role === 'admin';

  const [loading, setLoading] = useState(false);
  const [member, setMember] = useState<TeamMemberResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [roleDraft, setRoleDraft] = useState('viewer');

  const accountId = context.accountId;

  const refreshMember = useCallback(async () => {
    if (!accountId) {
      setMember(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(accountId)}/members/${encodeURIComponent(memberId)}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as TeamMemberResponse | { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      const parsed = payload as TeamMemberResponse | null;
      if (!parsed?.member) {
        throw new Error('coreui.errors.payload.invalid');
      }
      setMember(parsed);
      setRoleDraft(parsed.member.role);
      setMutationError(null);
    } catch (nextError) {
      const reason = nextError instanceof Error ? nextError.message : String(nextError);
      setMember(null);
      setError(resolveTeamMemberErrorCopy(reason, 'Failed to load this team member. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [accountId, memberId]);

  useEffect(() => {
    void refreshMember();
  }, [refreshMember]);

  const saveRole = useCallback(async () => {
    if (!accountId || !canManage) return;
    setSavingRole(true);
    setMutationError(null);
    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(accountId)}/members/${encodeURIComponent(memberId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: roleDraft }),
      });
      const payload = (await response.json().catch(() => null)) as TeamMemberResponse | { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      const parsed = payload as TeamMemberResponse | null;
      if (!parsed?.member) {
        throw new Error('coreui.errors.payload.invalid');
      }
      setMember(parsed);
      setRoleDraft(parsed.member.role);
    } catch (nextError) {
      const reason = nextError instanceof Error ? nextError.message : String(nextError);
      setMutationError(resolveTeamMemberErrorCopy(reason, 'Saving the membership failed. Please try again.'));
    } finally {
      setSavingRole(false);
    }
  }, [accountId, canManage, memberId, roleDraft]);

  if (me.loading) return <section className="rd-canvas-module body-m">Loading team context...</section>;
  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module body-m">
        {resolveTeamMemberErrorCopy(me.error ?? 'coreui.errors.auth.contextUnavailable', 'Failed to load team context.')}
      </section>
    );
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No workspace membership found for team controls.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module roma-inline-stack" style={{ justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <p className="body-m">Workspace: {context.accountName || 'Current workspace'}</p>
          <p className="body-s">Team manages memberships. Personal details stay with the member in User Settings.</p>
        </div>
        <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/team">
          <span className="diet-btn-txt__label body-m">Back to team</span>
        </Link>
      </section>

      {error ? (
        <section className="rd-canvas-module">
          <p className="body-m">{error}</p>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="line2"
            type="button"
            onClick={() => void refreshMember()}
            disabled={loading}
          >
            <span className="diet-btn-txt__label body-m">Retry</span>
          </button>
        </section>
      ) : null}

      {member ? (
        <>
          <section className="rd-canvas-module">
            <div className="roma-inline-stack" style={{ justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <h2 className="heading-h3">{resolveMemberDisplayName(member.member.profile, member.member.userId)}</h2>
                <p className="body-s">{member.member.profile?.primaryEmail ?? 'No primary email recorded'}</p>
              </div>
              <div>
                <p className="label-s">Role</p>
                <p className="body-m">{member.member.role}</p>
                <p className="body-s">Joined: {member.member.createdAt ?? 'unknown'}</p>
              </div>
            </div>
          </section>

          <section className="rd-canvas-module">
            <h3 className="heading-h4">Membership</h3>
            {member.member.role === 'owner' ? (
              <p className="body-s">Owner role is final account-holder authority. Ownership transfer stays on a dedicated flow.</p>
            ) : null}
            <div className="roma-inline-stack" style={{ alignItems: 'flex-end', gap: '12px' }}>
              <label className="roma-field">
                <span className="label-s">Role</span>
                <select
                  className="roma-input body-m"
                  value={roleDraft}
                  onChange={(event) => setRoleDraft(event.target.value)}
                  disabled={!canManage || member.member.role === 'owner' || savingRole}
                >
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="solid"
                type="button"
                onClick={() => void saveRole()}
                disabled={!canManage || member.member.role === 'owner' || savingRole || roleDraft === member.member.role}
              >
                <span className="diet-btn-txt__label body-m">{savingRole ? 'Saving...' : 'Save role'}</span>
              </button>
            </div>
          </section>

          <section className="rd-canvas-module">
            <h3 className="heading-h4">Person</h3>
            <p className="body-s">Personal details are read-only here. The member manages them in User Settings.</p>
            <div className="roma-form-grid">
              <div className="roma-field">
                <span className="label-s">First name</span>
                <p className="body-m">{formatNullableValue(member.member.profile?.givenName)}</p>
              </div>
              <div className="roma-field">
                <span className="label-s">Last name</span>
                <p className="body-m">{formatNullableValue(member.member.profile?.familyName)}</p>
              </div>
              <div className="roma-field">
                <span className="label-s">Primary email</span>
                <p className="body-m">{formatNullableValue(member.member.profile?.primaryEmail)}</p>
              </div>
              <div className="roma-field">
                <span className="label-s">Email verified</span>
                <p className="body-m">
                  {member.member.profile ? (member.member.profile.emailVerified ? 'Yes' : 'No') : 'Not set'}
                </p>
              </div>
              <div className="roma-field">
                <span className="label-s">Primary Language</span>
                <p className="body-m">{formatNullableValue(member.member.profile?.primaryLanguage)}</p>
              </div>
              <div className="roma-field">
                <span className="label-s">Country</span>
                <p className="body-m">{formatCountryValue(member.member.profile?.country)}</p>
              </div>
              <div className="roma-field">
                <span className="label-s">Timezone</span>
                <p className="body-m">{formatNullableValue(member.member.profile?.timezone)}</p>
              </div>
            </div>
          </section>

          {mutationError ? (
            <section className="rd-canvas-module">
              <p className="body-m">{mutationError}</p>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
