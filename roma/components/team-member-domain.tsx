'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveAccountPolicyFromRomaAuthz, resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type TeamMemberProfile = {
  userId: string;
  primaryEmail: string;
  emailVerified: boolean;
  displayName: string;
  givenName: string | null;
  familyName: string | null;
  preferredLanguage: string | null;
  countryCode: string | null;
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

type ProfileDraft = {
  displayName: string;
  givenName: string;
  familyName: string;
  preferredLanguage: string;
  countryCode: string;
  timezone: string;
};

function toDraft(profile: TeamMemberProfile | null): ProfileDraft {
  return {
    displayName: profile?.displayName ?? '',
    givenName: profile?.givenName ?? '',
    familyName: profile?.familyName ?? '',
    preferredLanguage: profile?.preferredLanguage ?? '',
    countryCode: profile?.countryCode ?? '',
    timezone: profile?.timezone ?? '',
  };
}

function resolveErrorReason(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  return String((error as { reasonKey?: unknown }).reasonKey || fallback);
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(toDraft(null));
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
      setDraft(toDraft(parsed.member.profile));
      setRoleDraft(parsed.member.role);
      setSaveError(null);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : String(nextError);
      setMember(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [accountId, memberId]);

  useEffect(() => {
    void refreshMember();
  }, [refreshMember]);

  const saveProfile = useCallback(async () => {
    if (!accountId || !canManage) return;
    setSavingProfile(true);
    setSaveError(null);
    try {
      const response = await fetch(
        `/api/accounts/${encodeURIComponent(accountId)}/members/${encodeURIComponent(memberId)}/profile`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(draft),
        },
      );
      const payload = (await response.json().catch(() => null)) as TeamMemberResponse | { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      const parsed = payload as TeamMemberResponse | null;
      if (!parsed?.member) {
        throw new Error('coreui.errors.payload.invalid');
      }
      setMember(parsed);
      setDraft(toDraft(parsed.member.profile));
    } catch (nextError) {
      setSaveError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSavingProfile(false);
    }
  }, [accountId, canManage, draft, memberId]);

  const saveRole = useCallback(async () => {
    if (!accountId || !canManage) return;
    setSavingRole(true);
    setSaveError(null);
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
      setSaveError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSavingRole(false);
    }
  }, [accountId, canManage, memberId, roleDraft]);

  if (me.loading) return <section className="rd-canvas-module body-m">Loading team context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account membership found for team controls.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module roma-inline-stack" style={{ justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <p className="body-m">Account: {context.accountName || accountId}</p>
          <p className="body-s">Member detail is Berlin-owned account context, not an account-local shadow profile.</p>
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
                <h2 className="heading-h3">{member.member.profile?.displayName ?? member.member.userId}</h2>
                <p className="body-s">{member.member.profile?.primaryEmail ?? 'No primary email recorded'}</p>
                <p className="body-s">User ID: {member.member.userId}</p>
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
            <h3 className="heading-h4">Profile</h3>
            <div className="roma-form-grid">
              <label className="roma-field">
                <span className="label-s">Display name</span>
                <input
                  className="roma-input body-m"
                  value={draft.displayName}
                  onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                  disabled={!canManage || savingProfile}
                />
              </label>
              <label className="roma-field">
                <span className="label-s">Preferred language</span>
                <input
                  className="roma-input body-m"
                  value={draft.preferredLanguage}
                  onChange={(event) => setDraft((current) => ({ ...current, preferredLanguage: event.target.value }))}
                  disabled={!canManage || savingProfile}
                />
              </label>
              <label className="roma-field">
                <span className="label-s">Given name</span>
                <input
                  className="roma-input body-m"
                  value={draft.givenName}
                  onChange={(event) => setDraft((current) => ({ ...current, givenName: event.target.value }))}
                  disabled={!canManage || savingProfile}
                />
              </label>
              <label className="roma-field">
                <span className="label-s">Family name</span>
                <input
                  className="roma-input body-m"
                  value={draft.familyName}
                  onChange={(event) => setDraft((current) => ({ ...current, familyName: event.target.value }))}
                  disabled={!canManage || savingProfile}
                />
              </label>
              <label className="roma-field">
                <span className="label-s">Country code</span>
                <input
                  className="roma-input body-m"
                  value={draft.countryCode}
                  onChange={(event) => setDraft((current) => ({ ...current, countryCode: event.target.value }))}
                  disabled={!canManage || savingProfile}
                />
              </label>
              <label className="roma-field">
                <span className="label-s">Timezone</span>
                <input
                  className="roma-input body-m"
                  value={draft.timezone}
                  onChange={(event) => setDraft((current) => ({ ...current, timezone: event.target.value }))}
                  disabled={!canManage || savingProfile}
                />
              </label>
            </div>
            <div className="roma-inline-stack" style={{ justifyContent: 'space-between', gap: '12px', marginTop: '12px' }}>
              <div>
                <p className="body-s">Primary email: {member.member.profile?.primaryEmail ?? 'unknown'}</p>
                <p className="body-s">Email verified: {member.member.profile?.emailVerified ? 'yes' : 'no'}</p>
              </div>
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="solid"
                type="button"
                onClick={() => void saveProfile()}
                disabled={!canManage || savingProfile}
              >
                <span className="diet-btn-txt__label body-m">{savingProfile ? 'Saving...' : 'Save profile'}</span>
              </button>
            </div>
          </section>

          {saveError ? (
            <section className="rd-canvas-module">
              <p className="body-m">{saveError}</p>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
