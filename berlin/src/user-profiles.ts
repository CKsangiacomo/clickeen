import { json, validationError } from './helpers';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env } from './types';

export type UserProfilePatch = {
  display_name?: string;
  given_name?: string | null;
  family_name?: string | null;
  preferred_language?: string | null;
  country_code?: string | null;
  timezone?: string | null;
};

type ParseUserProfilePatchResult =
  | { ok: true; patch: UserProfilePatch }
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

function normalizePreferredLanguage(value: unknown): string | null | undefined {
  const normalized = normalizeNullableField(value, 32);
  if (normalized == null || normalized === undefined) return normalized;
  return normalized.toLowerCase();
}

function normalizeCountryCode(value: unknown): string | null | undefined {
  const normalized = normalizeNullableField(value, 2);
  if (normalized == null || normalized === undefined) return normalized;
  const upper = normalized.toUpperCase();
  return /^[A-Z]{2}$/.test(upper) ? upper : undefined;
}

export function parseUserProfilePatchPayload(value: unknown): ParseUserProfilePatchResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, response: validationError('coreui.errors.payload.invalid') };
  }

  const record = value as Record<string, unknown>;

  const displayName = normalizeNullableField(record.displayName, 120);
  const givenName = normalizeNullableField(record.givenName, 120);
  const familyName = normalizeNullableField(record.familyName, 120);
  const preferredLanguage = normalizePreferredLanguage(record.preferredLanguage);
  const countryCode = normalizeCountryCode(record.countryCode);
  const timezone = normalizeNullableField(record.timezone, 120);

  if ([displayName, givenName, familyName, preferredLanguage, countryCode, timezone].every((entry) => entry === undefined)) {
    return {
      ok: false,
      response: validationError('coreui.errors.payload.invalid', 'at least one profile field must be provided'),
    };
  }

  if (Object.prototype.hasOwnProperty.call(record, 'displayName') && (displayName == null || displayName === undefined)) {
    return {
      ok: false,
      response: validationError('coreui.errors.payload.invalid', 'displayName must be a non-empty string up to 120 chars'),
    };
  }

  if (
    (Object.prototype.hasOwnProperty.call(record, 'givenName') && givenName === undefined) ||
    (Object.prototype.hasOwnProperty.call(record, 'familyName') && familyName === undefined) ||
    (Object.prototype.hasOwnProperty.call(record, 'preferredLanguage') && preferredLanguage === undefined) ||
    (Object.prototype.hasOwnProperty.call(record, 'countryCode') && countryCode === undefined) ||
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
      ...(displayName !== undefined ? { display_name: displayName ?? undefined } : {}),
      ...(givenName !== undefined ? { given_name: givenName } : {}),
      ...(familyName !== undefined ? { family_name: familyName } : {}),
      ...(preferredLanguage !== undefined ? { preferred_language: preferredLanguage } : {}),
      ...(countryCode !== undefined ? { country_code: countryCode } : {}),
      ...(timezone !== undefined ? { timezone } : {}),
    },
  };
}

export async function patchUserProfile(args: {
  env: Env;
  userId: string;
  patch: UserProfilePatch;
}): Promise<Response | null> {
  const params = new URLSearchParams({
    user_id: `eq.${args.userId}`,
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/user_profiles?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(args.patch),
  });
  const payload = await readSupabaseAdminJson<Array<{ user_id?: unknown }> | Record<string, unknown>>(response);
  if (!response.ok) {
    return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload);
  }
  const rows = Array.isArray(payload) ? payload : [];
  if (!rows[0]?.user_id) {
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.auth.contextUnavailable',
          detail: 'user profile missing',
        },
      },
      { status: 500 },
    );
  }
  return null;
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
