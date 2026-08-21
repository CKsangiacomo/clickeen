'use client';

import {
  listUserSettingsCountries,
  listUserSettingsTimezones,
  resolveUserSettingsTimezone,
  userSettingsCountryRequiresTimezoneChoice,
} from '@clickeen/ck-contracts';
import { useCallback, useEffect, useState } from 'react';
import profileCopy from '../l10n/profile/en.json';
import { useRomaAccountApi } from './account-api';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { DieterTextfield } from './dieter-textfield';
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
  usePrimaryLanguageForUi: boolean;
  country: string | null;
  timezone: string | null;
  primaryEmail: string;
};

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

function toDraft(profile: UserSettingsProfile): ProfileDraft {
  return {
    firstName: profile.givenName ?? '',
    lastName: profile.familyName ?? '',
    primaryLanguage: profile.primaryLanguage ?? '',
    country: profile.country ?? '',
    timezone: profile.timezone ?? '',
  };
}

const USER_SETTINGS_COUNTRY_OPTIONS = listUserSettingsCountries()
  .map((country) => ({ value: country, label: resolveCountryLabel(country) }))
  .sort((left, right) => left.label.localeCompare(right.label));

export function ProfileDomain() {
  const { data, reload } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const profile = data.profile as UserSettingsProfile;

  const [draft, setDraft] = useState<ProfileDraft>(toDraft(profile));
  const [saving, setSaving] = useState(false);

  const timezoneOptions = listUserSettingsTimezones(draft.country);
  const requiresTimezoneChoice = userSettingsCountryRequiresTimezoneChoice(draft.country);

  useEffect(() => {
    setDraft(toDraft(profile));
  }, [profile]);

  const saveProfile = useCallback(async () => {
    setSaving(true);
    try {
      const payload = await accountApi.fetchJson<{ profile: UserSettingsProfile }>('/api/me', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          givenName: draft.firstName || null,
          familyName: draft.lastName || null,
          primaryLanguage: draft.primaryLanguage || null,
          country: draft.country || null,
          timezone: draft.timezone || null,
        }),
      });
      setDraft(toDraft(payload.profile));
      await reload();
    } catch {
    } finally {
      setSaving(false);
    }
  }, [accountApi, draft, reload]);


  return (
    <>
      <section className="rd-canvas-module">
        <h2 className="heading-6">{profileCopy.personalDetails}</h2>
        <div className="roma-form-grid">
          <DieterTextfield
            className="roma-field"
            controlSize="lg"
            label={profileCopy.firstName}
            value={draft.firstName}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                firstName: event.target.value,
              }))
            }
            disabled={saving}
          />
          <DieterTextfield
            className="roma-field"
            controlSize="lg"
            label={profileCopy.lastName}
            value={draft.lastName}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                lastName: event.target.value,
              }))
            }
            disabled={saving}
          />
          <DieterTextfield
            className="roma-field"
            controlSize="lg"
            label={profileCopy.primaryLanguage}
            value={draft.primaryLanguage}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                primaryLanguage: event.target.value,
              }))
            }
            disabled={saving}
          />
          <DieterDropdownActions
            className="roma-field"
            size="lg"
            label={profileCopy.country}
            ariaLabel={profileCopy.chooseCountry}
            value={draft.country}
            options={[{ value: '', label: profileCopy.selectCountry }, ...USER_SETTINGS_COUNTRY_OPTIONS]}
            onChange={(nextCountry) => {
              setDraft((current) => ({
                ...current,
                country: nextCountry,
                timezone: nextCountry ? (resolveUserSettingsTimezone(nextCountry, current.timezone, null) ?? '') : '',
              }));
            }}
            disabled={saving}
          />
          {requiresTimezoneChoice ? (
            <DieterDropdownActions
              className="roma-field"
              size="lg"
              label={profileCopy.timezone}
              ariaLabel={profileCopy.chooseTimezone}
              value={draft.timezone}
              options={timezoneOptions.map((timezone) => ({ value: timezone, label: formatTimezoneLabel(timezone) }))}
              onChange={(timezone) =>
                setDraft((current) => ({
                  ...current,
                  timezone,
                }))
              }
              disabled={saving || !draft.country}
            />
          ) : (
            <DieterTextfield
              className="roma-field"
              controlSize="lg"
              label={profileCopy.timezone}
              value={draft.timezone ? formatTimezoneLabel(draft.timezone) : ''}
              disabled
              readOnly
            />
          )}
        </div>
        <div className="roma-inline-stack" style={{ justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            data-loading={saving || undefined}
            type="button"
            aria-busy={saving || undefined}
            onClick={() => void saveProfile()}
            disabled={saving}
          >
            {saving ? <span className="diet-spinner" aria-hidden="true" /> : null}
            <span className="diet-button__label">{saving ? profileCopy.saving : profileCopy.save}</span>
          </button>
        </div>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">{profileCopy.email}</h2>
        <p className="label-s">{profileCopy.primaryEmail}</p>
        <p className="body-s">{profile.primaryEmail}</p>
      </section>
    </>
  );
}
