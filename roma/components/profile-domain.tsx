'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRomaMe } from './use-roma-me';

type ProfileDraft = {
  displayName: string;
  givenName: string;
  familyName: string;
  preferredLanguage: string;
  countryCode: string;
  timezone: string;
};

type RomaIdentityResponse = {
  userId: string;
  identities: Array<{
    identityId: string;
    provider: string;
    providerSubject: string | null;
  }>;
};

function toDraft(
  profile:
    | {
        displayName: string;
        givenName: string | null;
        familyName: string | null;
        preferredLanguage: string | null;
        countryCode: string | null;
        timezone: string | null;
      }
    | null
    | undefined,
): ProfileDraft {
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

export function ProfileDomain() {
  const me = useRomaMe();
  const profile = me.data?.profile ?? null;
  const userId = me.data?.user.id ?? null;
  const accountCount = me.data?.accounts?.length ?? 0;

  const [draft, setDraft] = useState<ProfileDraft>(toDraft(profile));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [identitiesLoading, setIdentitiesLoading] = useState(false);
  const [identitiesError, setIdentitiesError] = useState<string | null>(null);
  const [identities, setIdentities] = useState<RomaIdentityResponse['identities']>([]);

  useEffect(() => {
    setDraft(toDraft(profile));
  }, [profile]);

  const profileSummary = useMemo(() => {
    if (!profile) return null;
    return {
      primaryEmail: profile.primaryEmail,
      emailVerified: profile.emailVerified,
      userId: profile.userId,
    };
  }, [profile]);

  const loadIdentities = useCallback(async () => {
    setIdentitiesLoading(true);
    setIdentitiesError(null);
    try {
      const response = await fetch('/api/me/identities', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as RomaIdentityResponse | { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      const parsed = payload as RomaIdentityResponse | null;
      if (!parsed || !Array.isArray(parsed.identities)) {
        throw new Error('coreui.errors.payload.invalid');
      }
      setIdentities(parsed.identities);
    } catch (error) {
      setIdentities([]);
      setIdentitiesError(error instanceof Error ? error.message : String(error));
    } finally {
      setIdentitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    void loadIdentities();
  }, [loadIdentities, userId]);

  const saveProfile = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const response = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            user?: unknown;
            profile?: {
              displayName: string;
              givenName: string | null;
              familyName: string | null;
              preferredLanguage: string | null;
              countryCode: string | null;
              timezone: string | null;
            } | null;
            error?: unknown;
          }
        | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      if (!payload?.profile) {
        throw new Error('coreui.errors.payload.invalid');
      }
      setDraft(toDraft(payload.profile));
      setSaveNotice('Profile saved');
      await me.reload();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [draft, me]);

  if (me.loading) return <section className="rd-canvas-module body-m">Loading profile context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load profile context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!profileSummary) {
    return <section className="rd-canvas-module body-m">No canonical profile context is available for this user.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">My Profile is person-scoped. Changes here apply across all account memberships.</p>
        <p className="body-s">
          User ID: {profileSummary.userId} | Account memberships: {accountCount}
        </p>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Profile</h2>
        <div className="roma-form-grid">
          <label className="roma-field">
            <span className="label-s">Display name</span>
            <input
              className="roma-input body-m"
              value={draft.displayName}
              onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
              disabled={saving}
            />
          </label>
          <label className="roma-field">
            <span className="label-s">Preferred language</span>
            <input
              className="roma-input body-m"
              value={draft.preferredLanguage}
              onChange={(event) => setDraft((current) => ({ ...current, preferredLanguage: event.target.value }))}
              disabled={saving}
            />
          </label>
          <label className="roma-field">
            <span className="label-s">Given name</span>
            <input
              className="roma-input body-m"
              value={draft.givenName}
              onChange={(event) => setDraft((current) => ({ ...current, givenName: event.target.value }))}
              disabled={saving}
            />
          </label>
          <label className="roma-field">
            <span className="label-s">Family name</span>
            <input
              className="roma-input body-m"
              value={draft.familyName}
              onChange={(event) => setDraft((current) => ({ ...current, familyName: event.target.value }))}
              disabled={saving}
            />
          </label>
          <label className="roma-field">
            <span className="label-s">Country code</span>
            <input
              className="roma-input body-m"
              value={draft.countryCode}
              onChange={(event) => setDraft((current) => ({ ...current, countryCode: event.target.value }))}
              disabled={saving}
            />
          </label>
          <label className="roma-field">
            <span className="label-s">Timezone</span>
            <input
              className="roma-input body-m"
              value={draft.timezone}
              onChange={(event) => setDraft((current) => ({ ...current, timezone: event.target.value }))}
              disabled={saving}
            />
          </label>
        </div>
        <div className="roma-inline-stack" style={{ justifyContent: 'space-between', gap: '12px', marginTop: '12px' }}>
          <div>
            <p className="body-s">Primary email: {profileSummary.primaryEmail}</p>
            <p className="body-s">Email verified: {profileSummary.emailVerified ? 'yes' : 'no'}</p>
          </div>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="solid"
            type="button"
            onClick={() => void saveProfile()}
            disabled={saving}
          >
            <span className="diet-btn-txt__label body-m">{saving ? 'Saving...' : 'Save profile'}</span>
          </button>
        </div>
      </section>

      {saveError ? (
        <section className="rd-canvas-module">
          <p className="body-m">{saveError}</p>
        </section>
      ) : null}

      {saveNotice ? (
        <section className="rd-canvas-module">
          <p className="body-m">{saveNotice}</p>
        </section>
      ) : null}

      <section className="rd-canvas-module">
        <h2 className="heading-6">Linked identities</h2>
        <p className="body-s">Berlin owns linked identity visibility. Roma only renders the current normalized list.</p>
        {identitiesError ? <p className="body-m">{identitiesError}</p> : null}
        {identitiesLoading ? <p className="body-m">Loading linked identities...</p> : null}
        {!identitiesLoading && !identities.length ? <p className="body-m">No linked identities are recorded.</p> : null}
        {identities.length ? (
          <div className="roma-grid roma-grid--three" style={{ marginTop: '12px' }}>
            {identities.map((identity) => (
              <article className="roma-card" key={identity.identityId}>
                <p className="label-s">{identity.provider}</p>
                <p className="body-m">{identity.providerSubject ?? identity.identityId}</p>
                <p className="body-s">Identity ID: {identity.identityId}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
