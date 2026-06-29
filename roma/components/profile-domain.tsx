'use client';

import {
  isUserSettingsTimezoneSupported,
  listUserSettingsCountries,
  listUserSettingsTimezones,
  resolveUserSettingsTimezone,
  userSettingsCountryRequiresTimezoneChoice,
} from '@clickeen/ck-contracts';
import { useCallback, useEffect, useState } from 'react';
import { useRomaAccountContext } from './roma-account-context';

type ProfileDraft = {
  firstName: string;
  lastName: string;
  primaryLanguage: string;
  country: string;
  timezone: string;
};

type UserSettingsProfile = {
  givenName: string | null;
  familyName: string | null;
  primaryLanguage: string | null;
  country: string | null;
  timezone: string | null;
  primaryEmail: string;
};

const USER_SETTINGS_REASON_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again to manage your settings.',
  'coreui.errors.auth.contextUnavailable': 'User settings are unavailable right now. Please try again.',
  'coreui.errors.db.readFailed': 'Failed to load your settings. Please try again.',
  'coreui.errors.db.writeFailed': 'Saving your settings failed. Please try again.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
  'coreui.errors.payload.invalid': 'The settings request was invalid. Please try again.',
};

function resolveUserSettingsErrorCopy(reason: string, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = USER_SETTINGS_REASON_COPY[normalized];
  if (mapped) return mapped;
  if (normalized.startsWith('HTTP_') || normalized.startsWith('coreui.')) return fallback;
  return fallback;
}

function resolveErrorReason(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  return String((error as { reasonKey?: unknown }).reasonKey || fallback);
}

function resolveCountryLabel(country: string): string {
  try {
    const displayNames = new Intl.DisplayNames(undefined, { type: 'region' });
    return displayNames.of(country) || country;
  } catch {
    return country;
  }
}

function formatTimezoneLabel(timezone: string): string {
  return timezone
    .split('/')
    .map((part) => part.replace(/_/g, ' '))
    .join(' / ');
}

function toDraft(profile: UserSettingsProfile | null | undefined): ProfileDraft {
  const country = typeof profile?.country === 'string' ? profile.country.trim() : '';
  const rawTimezone = typeof profile?.timezone === 'string' ? profile.timezone.trim() : '';
  const timezone = isUserSettingsTimezoneSupported(country, rawTimezone)
    ? rawTimezone
    : listUserSettingsTimezones(country).length === 1
      ? listUserSettingsTimezones(country)[0] || ''
      : '';

  return {
    firstName: profile?.givenName ?? '',
    lastName: profile?.familyName ?? '',
    primaryLanguage: profile?.primaryLanguage ?? '',
    country,
    timezone,
  };
}

const USER_SETTINGS_COUNTRY_OPTIONS = listUserSettingsCountries()
  .map((country) => ({ value: country, label: resolveCountryLabel(country) }))
  .sort((left, right) => left.label.localeCompare(right.label));

export function ProfileDomain() {
  const { data, reload } = useRomaAccountContext();
  const profile = (data.profile ?? null) as UserSettingsProfile | null;

  const [draft, setDraft] = useState<ProfileDraft>(toDraft(profile));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const timezoneOptions = listUserSettingsTimezones(draft.country);
  const requiresTimezoneChoice = userSettingsCountryRequiresTimezoneChoice(draft.country);
  const derivedTimezone = draft.country ? (resolveUserSettingsTimezone(draft.country, draft.timezone, null) ?? '') : '';

  useEffect(() => {
    setDraft(toDraft(profile));
  }, [profile]);

  const saveProfile = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const response = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          givenName: draft.firstName || null,
          familyName: draft.lastName || null,
          primaryLanguage: draft.primaryLanguage || null,
          country: draft.country || null,
          timezone: draft.country ? resolveUserSettingsTimezone(draft.country, draft.timezone || null, null) : null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        profile?: UserSettingsProfile | null;
        error?: unknown;
      } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      if (!payload?.profile) {
        throw new Error('coreui.errors.payload.invalid');
      }
      setDraft(toDraft(payload.profile));
      setSaveNotice('User settings saved.');
      await reload();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setSaveError(resolveUserSettingsErrorCopy(reason, 'Saving your settings failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  }, [draft, profile, reload]);


  if (!profile) {
    return <section className="rd-canvas-module body-m">User settings are unavailable right now.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">User settings are person-scoped. Changes here apply across every account you belong to.</p>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Personal details</h2>
        <div className="roma-form-grid">
          <label className="roma-field">
            <span className="label-s">First name</span>
            <input
              className="roma-input body-m"
              value={draft.firstName}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  firstName: event.target.value,
                }))
              }
              disabled={saving}
            />
          </label>
          <label className="roma-field">
            <span className="label-s">Last name</span>
            <input
              className="roma-input body-m"
              value={draft.lastName}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  lastName: event.target.value,
                }))
              }
              disabled={saving}
            />
          </label>
          <label className="roma-field">
            <span className="label-s">Primary Language</span>
            <input
              className="roma-input body-m"
              value={draft.primaryLanguage}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  primaryLanguage: event.target.value,
                }))
              }
              disabled={saving}
            />
          </label>
          <label className="roma-field">
            <span className="label-s">Country</span>
            <select
              className="roma-input body-m"
              value={draft.country}
              onChange={(event) => {
                const nextCountry = event.target.value;
                setDraft((current) => ({
                  ...current,
                  country: nextCountry,
                  timezone: nextCountry ? (resolveUserSettingsTimezone(nextCountry, current.timezone, null) ?? '') : '',
                }));
              }}
              disabled={saving}
            >
              <option value="">Select country</option>
              {USER_SETTINGS_COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="roma-field">
            <span className="label-s">Timezone</span>
            {requiresTimezoneChoice ? (
              <select
                className="roma-input body-m"
                value={draft.timezone}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }))
                }
                disabled={saving || !draft.country}
              >
                {timezoneOptions.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {formatTimezoneLabel(timezone)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="roma-input body-m"
                value={derivedTimezone ? formatTimezoneLabel(derivedTimezone) : ''}
                placeholder={draft.country ? '' : 'Select a country first'}
                disabled
                readOnly
              />
            )}
          </label>
        </div>
        {draft.country && !requiresTimezoneChoice ? (
          <p className="body-s" style={{ marginTop: '8px' }}>
            Timezone is set automatically from the selected country.
          </p>
        ) : null}
        <div className="roma-inline-stack" style={{ justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
          <button className="diet-btn-txt" data-size="md" data-variant="solid" type="button" onClick={() => void saveProfile()} disabled={saving}>
            <span className="diet-btn-txt__label body-m">{saving ? 'Saving...' : 'Save settings'}</span>
          </button>
        </div>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Email</h2>
        <p className="body-s">Primary email: {profile.primaryEmail}</p>
      </section>

      {saveError ? (
        <section className="rd-canvas-module" role="alert">
          <p className="body-m">{saveError}</p>
        </section>
      ) : null}

      {saveNotice ? (
        <section className="rd-canvas-module" role="status">
          <p className="body-m">{saveNotice}</p>
        </section>
      ) : null}

    </>
  );
}
