import { isUserSettingsTimezoneSupported, normalizeUserSettingsCountry } from '@clickeen/ck-contracts';
import type { BerlinUserProfilePayload } from './account-state.types';

export type UserProfileRow = {
  user_id?: unknown;
  primary_email?: unknown;
  email_verified?: unknown;
  display_name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  primary_language?: unknown;
  country?: unknown;
  timezone?: unknown;
  active_account_id?: unknown;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return false;
}

export function normalizeProfileLocation(rawCountry: unknown, rawTimezone: unknown): {
  country: string | null;
  timezone: string | null;
} {
  const country = normalizeUserSettingsCountry(rawCountry);
  if (!country) return { country: null, timezone: null };

  const timezone = asTrimmedString(rawTimezone);
  return {
    country,
    timezone: timezone && isUserSettingsTimezoneSupported(country, timezone) ? timezone : null,
  };
}

export function normalizeUserProfilePayload(
  userId: string,
  row: UserProfileRow | null,
): BerlinUserProfilePayload | null {
  const primaryEmail = asTrimmedString(row?.primary_email);
  if (!primaryEmail) return null;
  const location = normalizeProfileLocation(row?.country, row?.timezone);
  return {
    userId,
    primaryEmail,
    emailVerified: normalizeBoolean(row?.email_verified),
    givenName: asTrimmedString(row?.given_name),
    familyName: asTrimmedString(row?.family_name),
    primaryLanguage: asTrimmedString(row?.primary_language),
    country: location.country,
    timezone: location.timezone,
  };
}
