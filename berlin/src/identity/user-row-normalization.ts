import { isUserSettingsTimezoneSupported, normalizeUserSettingsCountry } from '@clickeen/ck-contracts';
import type { BerlinUserProfilePayload } from '../bootstrap/types';
import { asTrimmedString } from '../utils/primitives';

export type UserRow = {
  user_id?: unknown;
  account_id?: unknown;
  primary_email?: unknown;
  email_verified?: unknown;
  display_name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  primary_language?: unknown;
  country?: unknown;
  timezone?: unknown;
};

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return false;
}

export function normalizeUserLocation(rawCountry: unknown, rawTimezone: unknown): {
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

export function normalizeUserSettingsPayload(
  userId: string,
  row: UserRow | null,
): BerlinUserProfilePayload | null {
  const primaryEmail = asTrimmedString(row?.primary_email);
  if (!primaryEmail) return null;
  const location = normalizeUserLocation(row?.country, row?.timezone);
  return {
    userId,
    primaryEmail,
    emailVerified: normalizeBoolean(row?.email_verified),
    givenName: asTrimmedString(row?.first_name),
    familyName: asTrimmedString(row?.last_name),
    primaryLanguage: asTrimmedString(row?.primary_language),
    country: location.country,
    timezone: location.timezone,
  };
}
