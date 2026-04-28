import {
  isUserSettingsTimezoneSupported,
  normalizeUserSettingsCountry,
  resolveUserSettingsTimezone,
} from '@clickeen/ck-contracts';
import type { BerlinUserProfilePayload } from './account-state.types';
import { json, validationError } from './http';
import { normalizeUserProfilePayload } from './profile-normalization';
import type { UserProfileRow as BerlinUserProfileRow } from './profile-normalization';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env } from './types';

export type UserProfilePatch = {
  given_name?: string | null;
  family_name?: string | null;
  primary_language?: string | null;
  country?: string | null;
  timezone?: string | null;
};

type ParseUserProfilePatchResult =
  | { ok: true; patch: UserProfilePatch }
  | { ok: false; response: Response };

type PatchUserProfileResult =
  | { ok: true; profile: BerlinUserProfilePayload }
  | { ok: false; response: Response };

function normalizeNullableField(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) return undefined;
  return normalized;
}

function normalizePrimaryLanguage(value: unknown): string | null | undefined {
  const normalized = normalizeNullableField(value, 32);
  if (normalized == null || normalized === undefined) return normalized;
  return normalized.toLowerCase();
}

function normalizeCountry(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = normalizeUserSettingsCountry(value);
  return normalized ?? undefined;
}

export function parseUserProfilePatchPayload(value: unknown): ParseUserProfilePatchResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, response: validationError('coreui.errors.payload.invalid') };
  }

  const record = value as Record<string, unknown>;

  const givenName = normalizeNullableField(record.givenName, 120);
  const familyName = normalizeNullableField(record.familyName, 120);
  const primaryLanguage = normalizePrimaryLanguage(record.primaryLanguage);
  const country = normalizeCountry(record.country);
  const timezone = normalizeNullableField(record.timezone, 120);

  if ([givenName, familyName, primaryLanguage, country, timezone].every((entry) => entry === undefined)) {
    return {
      ok: false,
      response: validationError('coreui.errors.payload.invalid', 'at least one profile field must be provided'),
    };
  }

  if (
    (Object.prototype.hasOwnProperty.call(record, 'givenName') && givenName === undefined) ||
    (Object.prototype.hasOwnProperty.call(record, 'familyName') && familyName === undefined) ||
    (Object.prototype.hasOwnProperty.call(record, 'primaryLanguage') && primaryLanguage === undefined) ||
    (Object.prototype.hasOwnProperty.call(record, 'country') && country === undefined) ||
    (Object.prototype.hasOwnProperty.call(record, 'timezone') && timezone === undefined)
  ) {
    return {
      ok: false,
      response: validationError('coreui.errors.payload.invalid', 'one or more profile fields are invalid'),
    };
  }

  return {
    ok: true,
    patch: {
      ...(givenName !== undefined ? { given_name: givenName } : {}),
      ...(familyName !== undefined ? { family_name: familyName } : {}),
      ...(primaryLanguage !== undefined ? { primary_language: primaryLanguage } : {}),
      ...(country !== undefined ? { country } : {}),
      ...(timezone !== undefined ? { timezone } : {}),
    },
  };
}

async function loadCurrentUserProfileRow(args: {
  env: Env;
  userId: string;
}): Promise<
  | {
      ok: true;
      row: {
        country?: unknown;
        timezone?: unknown;
      } | null;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  const params = new URLSearchParams({
    select: 'country,timezone',
    user_id: `eq.${args.userId}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/user_profiles?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<
    Array<{
      country?: unknown;
      timezone?: unknown;
    }> | Record<string, unknown>
  >(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  return { ok: true, row: Array.isArray(payload) ? payload[0] || null : null };
}

export async function patchUserProfile(args: {
  env: Env;
  userId: string;
  patch: UserProfilePatch;
}): Promise<PatchUserProfileResult> {
  const nextPatch: UserProfilePatch = { ...args.patch };

  if (args.patch.country !== undefined || args.patch.timezone !== undefined) {
    const current = await loadCurrentUserProfileRow(args);
    if (!current.ok) return { ok: false, response: current.response };

    const currentCountry = normalizeUserSettingsCountry(current.row?.country);
    const currentTimezone = normalizeNullableField(current.row?.timezone, 120) ?? null;
    const nextCountry = args.patch.country !== undefined ? args.patch.country : currentCountry;

    if (!nextCountry) {
      if (args.patch.timezone !== undefined && args.patch.timezone !== null) {
        return {
          ok: false,
          response: validationError('coreui.errors.payload.invalid', 'timezone requires country'),
        };
      }
      nextPatch.country = null;
      nextPatch.timezone = null;
    } else {
      const requestedTimezone = args.patch.timezone !== undefined ? args.patch.timezone : currentTimezone;
      if (
        requestedTimezone !== undefined &&
        requestedTimezone !== null &&
        !isUserSettingsTimezoneSupported(nextCountry, requestedTimezone)
      ) {
        return {
          ok: false,
          response: validationError('coreui.errors.payload.invalid', 'timezone must match country'),
        };
      }
      nextPatch.country = nextCountry;
      nextPatch.timezone = resolveUserSettingsTimezone(nextCountry, requestedTimezone, currentTimezone);
    }
  }

  const params = new URLSearchParams({
    user_id: `eq.${args.userId}`,
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/user_profiles?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(nextPatch),
  });
  const payload = await readSupabaseAdminJson<BerlinUserProfileRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
    };
  }
  const rows = Array.isArray(payload) ? payload : [];
  const profile = normalizeUserProfilePayload(args.userId, rows[0] ?? null);
  if (!profile) {
    return {
      ok: false,
      response: json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail: 'user profile missing',
          },
        },
        { status: 500 },
      ),
    };
  }
  return { ok: true, profile };
}

export async function userProfileExists(args: {
  env: Env;
  userId: string;
}): Promise<{ ok: true; exists: boolean } | { ok: false; response: Response }> {
  const params = new URLSearchParams({
    select: 'user_id',
    user_id: `eq.${args.userId}`,
    limit: '1',
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/user_profiles?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<Array<{ user_id?: unknown }> | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  const rows = Array.isArray(payload) ? payload : [];
  return { ok: true, exists: Boolean(rows[0]?.user_id) };
}
