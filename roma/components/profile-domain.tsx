'use client';

import {
  isUserSettingsTimezoneSupported,
  listUserSettingsCountries,
  listUserSettingsTimezones,
  resolveUserSettingsTimezone,
  userSettingsCountryRequiresTimezoneChoice,
} from '@clickeen/ck-contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRomaMe } from './use-roma-me';

type UserContactChannel = 'phone' | 'whatsapp';

type UserContactMethodState = {
  value: string | null;
  verified: boolean;
  pendingValue: string | null;
  challengeExpiresAt: string | null;
};

type ContactDrafts = Record<UserContactChannel, string>;

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
  emailVerified: boolean;
  contactMethods?: {
    phone: UserContactMethodState;
    whatsapp: UserContactMethodState;
  };
};

type VerificationModalState = {
  channel: UserContactChannel;
  previewCode: string | null;
  pendingValue: string;
};

const EMPTY_CONTACT_METHOD: UserContactMethodState = {
  value: null,
  verified: false,
  pendingValue: null,
  challengeExpiresAt: null,
};

const CONTACT_LABELS: Record<UserContactChannel, string> = {
  phone: 'Phone',
  whatsapp: 'WhatsApp',
};

const USER_SETTINGS_REASON_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again to manage your settings.',
  'coreui.errors.auth.contextUnavailable': 'User settings are unavailable right now. Please try again.',
  'coreui.errors.db.readFailed': 'Failed to load your settings. Please try again.',
  'coreui.errors.db.writeFailed': 'Saving your settings failed. Please try again.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
  'coreui.errors.payload.invalid': 'The settings request was invalid. Please try again.',
  'coreui.errors.user.email.invalid': 'Enter a valid email address to continue.',
  'coreui.errors.user.email.sameAsCurrent': 'Enter a different email address to change your sign-in email.',
  'coreui.errors.user.email.conflict': 'That email address is already in use.',
  'coreui.errors.user.email.changeFailed': 'Changing your email failed. Please try again.',
  'coreui.errors.user.contact.invalid': 'Enter a valid contact number including country code.',
  'coreui.errors.user.contact.unavailable': 'Verification is unavailable right now.',
  'coreui.errors.user.contact.challengeMissing': 'Request a new verification code to continue.',
  'coreui.errors.user.contact.codeInvalid': 'Enter the 6-digit verification code exactly as delivered.',
  'coreui.errors.user.contact.codeExpired': 'That verification code expired. Request a new one.',
};

function resolveUserSettingsErrorCopy(reason: string, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = USER_SETTINGS_REASON_COPY[normalized];
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

function resolveContactMethodState(
  profile: UserSettingsProfile | null | undefined,
  channel: UserContactChannel,
): UserContactMethodState {
  return profile?.contactMethods?.[channel] ?? EMPTY_CONTACT_METHOD;
}

function toContactDrafts(profile: UserSettingsProfile | null | undefined): ContactDrafts {
  return {
    phone: resolveContactMethodState(profile, 'phone').pendingValue || resolveContactMethodState(profile, 'phone').value || '',
    whatsapp:
      resolveContactMethodState(profile, 'whatsapp').pendingValue || resolveContactMethodState(profile, 'whatsapp').value || '',
  };
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

function formatChallengeExpiry(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(parsed));
}

const USER_SETTINGS_COUNTRY_OPTIONS = listUserSettingsCountries()
  .map((country) => ({ value: country, label: resolveCountryLabel(country) }))
  .sort((left, right) => left.label.localeCompare(right.label));

export function ProfileDomain() {
  const me = useRomaMe();
  const profile = (me.data?.profile ?? null) as UserSettingsProfile | null;

  const [draft, setDraft] = useState<ProfileDraft>(toDraft(profile));
  const [contactDrafts, setContactDrafts] = useState<ContactDrafts>(toContactDrafts(profile));
  const [nextEmail, setNextEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [contactSavingChannel, setContactSavingChannel] = useState<UserContactChannel | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactNotice, setContactNotice] = useState<string | null>(null);
  const [verificationModal, setVerificationModal] = useState<VerificationModalState | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationSaving, setVerificationSaving] = useState(false);

  const timezoneOptions = listUserSettingsTimezones(draft.country);
  const requiresTimezoneChoice = userSettingsCountryRequiresTimezoneChoice(draft.country);
  const derivedTimezone = draft.country ? resolveUserSettingsTimezone(draft.country, draft.timezone, null) ?? '' : '';

  useEffect(() => {
    setDraft(toDraft(profile));
    setContactDrafts(toContactDrafts(profile));
  }, [profile]);

  const contactStates = useMemo(
    () => ({
      phone: resolveContactMethodState(profile, 'phone'),
      whatsapp: resolveContactMethodState(profile, 'whatsapp'),
    }),
    [profile],
  );

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
      const payload = (await response.json().catch(() => null)) as
        | {
            profile?: UserSettingsProfile | null;
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
      setSaveNotice('User settings saved.');
      await me.reload();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setSaveError(resolveUserSettingsErrorCopy(reason, 'Saving your settings failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  }, [draft, me, profile]);

  const requestEmailChange = useCallback(async () => {
    if (!profile) return;
    setEmailSaving(true);
    setEmailError(null);
    setEmailNotice(null);

    try {
      const response = await fetch('/api/me/email-change', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: nextEmail }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            currentEmail?: string;
            requestedEmail?: string;
            status?: string;
            error?: unknown;
          }
        | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }

      const requestedEmail = String(payload?.requestedEmail || '').trim();
      setNextEmail('');
      setEmailNotice(
        requestedEmail
          ? `Confirmation sent. Check ${profile.primaryEmail} and ${requestedEmail} to finish the email change.`
          : 'Confirmation sent. Check your email to finish the email change.',
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setEmailError(resolveUserSettingsErrorCopy(reason, 'Changing your email failed. Please try again.'));
    } finally {
      setEmailSaving(false);
    }
  }, [nextEmail, profile]);

  const startContactVerification = useCallback(
    async (channel: UserContactChannel) => {
      const draftValue = contactDrafts[channel].trim();
      if (!draftValue) {
        setContactError(resolveUserSettingsErrorCopy('coreui.errors.user.contact.invalid', 'Enter a valid contact number.'));
        setContactNotice(null);
        return;
      }

      setContactSavingChannel(channel);
      setContactError(null);
      setContactNotice(null);
      try {
        const response = await fetch(`/api/me/contact-methods/${channel}/start`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ value: draftValue }),
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              contactMethods?: UserSettingsProfile['contactMethods'];
              delivery?: {
                mode?: string;
                previewCode?: string | null;
              } | null;
              error?: unknown;
            }
          | null;
        if (!response.ok) {
          throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
        }

        const previewCode = typeof payload?.delivery?.previewCode === 'string' ? payload.delivery.previewCode.trim() : '';
        setVerificationCode('');
        setVerificationModal({
          channel,
          previewCode: previewCode || null,
          pendingValue: draftValue,
        });
        setContactNotice(`${CONTACT_LABELS[channel]} verification code sent.`);
        await me.reload();
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        setContactError(resolveUserSettingsErrorCopy(reason, 'Verification is unavailable right now.'));
      } finally {
        setContactSavingChannel(null);
      }
    },
    [contactDrafts, me],
  );

  const verifyContactMethod = useCallback(async () => {
    if (!verificationModal) return;

    setVerificationSaving(true);
    setContactError(null);
    setContactNotice(null);
    try {
      const response = await fetch(`/api/me/contact-methods/${verificationModal.channel}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            contactMethods?: UserSettingsProfile['contactMethods'];
            error?: unknown;
          }
        | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }

      setVerificationModal(null);
      setVerificationCode('');
      setContactNotice(`${CONTACT_LABELS[verificationModal.channel]} verified.`);
      await me.reload();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setContactError(resolveUserSettingsErrorCopy(reason, 'Verification failed. Please try again.'));
    } finally {
      setVerificationSaving(false);
    }
  }, [me, verificationCode, verificationModal]);

  if (me.loading) return <section className="rd-canvas-module body-m">Loading user settings...</section>;
  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module body-m">
        {resolveUserSettingsErrorCopy(me.error ?? 'coreui.errors.auth.contextUnavailable', 'User settings are unavailable right now.')}
      </section>
    );
  }
  if (!profile) {
    return <section className="rd-canvas-module body-m">User settings are unavailable right now.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">User settings are person-scoped. Changes here apply across every workspace you belong to.</p>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Personal details</h2>
        <div className="roma-form-grid">
          <label className="roma-field">
            <span className="label-s">First name</span>
            <input
              className="roma-input body-m"
              value={draft.firstName}
              onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))}
              disabled={saving}
            />
          </label>
          <label className="roma-field">
            <span className="label-s">Last name</span>
            <input
              className="roma-input body-m"
              value={draft.lastName}
              onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))}
              disabled={saving}
            />
          </label>
          <label className="roma-field">
            <span className="label-s">Primary Language</span>
            <input
              className="roma-input body-m"
              value={draft.primaryLanguage}
              onChange={(event) => setDraft((current) => ({ ...current, primaryLanguage: event.target.value }))}
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
                  timezone: nextCountry ? resolveUserSettingsTimezone(nextCountry, current.timezone, null) ?? '' : '',
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
                onChange={(event) => setDraft((current) => ({ ...current, timezone: event.target.value }))}
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
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="solid"
            type="button"
            onClick={() => void saveProfile()}
            disabled={saving}
          >
            <span className="diet-btn-txt__label body-m">{saving ? 'Saving...' : 'Save settings'}</span>
          </button>
        </div>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Email</h2>
        <p className="body-s">Primary email: {profile.primaryEmail}</p>
        <p className="body-s">Email verified: {profile.emailVerified ? 'yes' : 'no'}</p>
        <p className="body-s" style={{ marginTop: '8px' }}>
          Changing your email is an account-security flow. The new email does not become primary until confirmation is completed.
        </p>
        <div className="roma-form-grid" style={{ marginTop: '12px' }}>
          <label className="roma-field">
            <span className="label-s">New email</span>
            <input
              className="roma-input body-m"
              type="email"
              inputMode="email"
              value={nextEmail}
              onChange={(event) => setNextEmail(event.target.value)}
              disabled={emailSaving}
            />
          </label>
        </div>
        <div className="roma-inline-stack" style={{ justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="solid"
            type="button"
            onClick={() => void requestEmailChange()}
            disabled={emailSaving || !nextEmail.trim()}
          >
            <span className="diet-btn-txt__label body-m">{emailSaving ? 'Sending...' : 'Change email'}</span>
          </button>
        </div>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Contact methods</h2>
        <div className="roma-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {(['phone', 'whatsapp'] as UserContactChannel[]).map((channel) => {
            const state = contactStates[channel];
            const pendingExpiry = formatChallengeExpiry(state.challengeExpiresAt);
            const hasVerifiedValue = Boolean(state.value && state.verified);
            return (
              <article className="roma-card" key={channel}>
                <h2 className="heading-6">{CONTACT_LABELS[channel]}</h2>
                <p className="body-s">{hasVerifiedValue ? `Verified: ${state.value}` : 'No verified contact method yet.'}</p>
                {state.pendingValue ? <p className="body-s">Pending verification: {state.pendingValue}</p> : null}
                {pendingExpiry ? <p className="body-s">Current code expires: {pendingExpiry}</p> : null}
                <label className="roma-field" style={{ marginTop: '12px' }}>
                  <span className="label-s">{hasVerifiedValue ? `Change ${CONTACT_LABELS[channel]}` : CONTACT_LABELS[channel]}</span>
                  <input
                    className="roma-input body-m"
                    value={contactDrafts[channel]}
                    onChange={(event) =>
                      setContactDrafts((current) => ({
                        ...current,
                        [channel]: event.target.value,
                      }))
                    }
                    disabled={contactSavingChannel === channel}
                    placeholder="+1234567890"
                  />
                </label>
                <div className="roma-inline-stack" style={{ justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                  {state.pendingValue ? (
                    <button
                      className="diet-btn-txt"
                      data-size="md"
                      data-variant="line2"
                      type="button"
                      onClick={() =>
                        setVerificationModal({
                          channel,
                          previewCode: null,
                          pendingValue: state.pendingValue || contactDrafts[channel],
                        })
                      }
                    >
                      <span className="diet-btn-txt__label body-m">Enter code</span>
                    </button>
                  ) : null}
                  <button
                    className="diet-btn-txt"
                    data-size="md"
                    data-variant="solid"
                    type="button"
                    onClick={() => void startContactVerification(channel)}
                    disabled={contactSavingChannel === channel || !contactDrafts[channel].trim()}
                  >
                    <span className="diet-btn-txt__label body-m">
                      {contactSavingChannel === channel ? 'Sending...' : state.pendingValue ? 'Resend code' : hasVerifiedValue ? 'Change' : 'Add'}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <p className="body-s" style={{ marginTop: '12px' }}>
          Phone and WhatsApp become active only after Berlin verifies the code you enter here.
        </p>
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

      {emailError ? (
        <section className="rd-canvas-module">
          <p className="body-m">{emailError}</p>
        </section>
      ) : null}

      {emailNotice ? (
        <section className="rd-canvas-module">
          <p className="body-m">{emailNotice}</p>
        </section>
      ) : null}

      {contactError ? (
        <section className="rd-canvas-module">
          <p className="body-m">{contactError}</p>
        </section>
      ) : null}

      {contactNotice ? (
        <section className="rd-canvas-module">
          <p className="body-m">{contactNotice}</p>
        </section>
      ) : null}

      {verificationModal ? (
        <div className="roma-modal-backdrop" role="presentation">
          <div className="roma-modal" role="dialog" aria-modal="true" aria-labelledby="roma-contact-verification-title">
            <h2 id="roma-contact-verification-title">Verify {CONTACT_LABELS[verificationModal.channel]}</h2>
            <p className="body-m">Enter the 6-digit verification code for {verificationModal.pendingValue}.</p>
            {verificationModal.previewCode ? (
              <p className="body-s">Local preview code: {verificationModal.previewCode}</p>
            ) : null}
            <label className="roma-field" style={{ marginTop: '12px' }}>
              <span className="label-s">Verification code</span>
              <input
                className="roma-input body-m"
                inputMode="numeric"
                maxLength={6}
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={verificationSaving}
              />
            </label>
            <div className="roma-modal__actions">
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="line2"
                type="button"
                onClick={() => {
                  if (verificationSaving) return;
                  setVerificationModal(null);
                  setVerificationCode('');
                }}
                disabled={verificationSaving}
              >
                <span className="diet-btn-txt__label body-m">Cancel</span>
              </button>
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="solid"
                type="button"
                onClick={() => void verifyContactMethod()}
                disabled={verificationSaving || verificationCode.trim().length !== 6}
              >
                <span className="diet-btn-txt__label body-m">{verificationSaving ? 'Verifying...' : 'Verify'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
