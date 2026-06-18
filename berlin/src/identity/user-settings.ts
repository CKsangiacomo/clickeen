import {
  isUserSettingsTimezoneSupported,
  normalizeUserSettingsCountry,
  resolveUserSettingsTimezone,
} from '@clickeen/ck-contracts';
import type { BerlinUserProfilePayload } from '../bootstrap/types';
import { json, validationError } from '../http';
import { normalizeUserSettingsPayload } from './user-row-normalization';
import type { UserRow as BerlinUserRow } from './user-row-normalization';
import {
  readSupabaseAdminJson,
  supabaseAdminArrayPayload,
  supabaseAdminErrorResponse,
  supabaseAdminFetch,
} from '../supabase-admin';
import { type Env } from '../types';

export type UserSettingsPatch = {
  first_name?: string | null;
  last_name?: string | null;
  primary_language?: string | null;
  country?: string | null;
  timezone?: string | null;
};

type ParseUserSettingsPatchResult =
  | { ok: true; patch: UserSettingsPatch }
  | { ok: false; response: Response };

type PatchUserSettingsResult =
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

export function parseUserSettingsPatchPayload(value: unknown): ParseUserSettingsPatchResult {
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
      response: validationError('coreui.errors.payload.invalid', 'at least one user settings field must be provided'),
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
      response: validationError('coreui.errors.payload.invalid', 'one or more user settings fields are invalid'),
    };
  }

  return {
    ok: true,
    patch: {
      ...(givenName !== undefined ? { first_name: givenName } : {}),
      ...(familyName !== undefined ? { last_name: familyName } : {}),
      ...(primaryLanguage !== undefined ? { primary_language: primaryLanguage } : {}),
      ...(country !== undefined ? { country } : {}),
      ...(timezone !== undefined ? { timezone } : {}),
    },
  };
}

async function loadCurrentUserSettingsRow(args: {
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
  const response = await supabaseAdminFetch(args.env, `/rest/v1/users?${params.toString()}`, {
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
  const rows = supabaseAdminArrayPayload<{ country?: unknown; timezone?: unknown }>(
    payload,
    'coreui.errors.db.readFailed',
  );
  if (!rows.ok) return rows;
  return { ok: true, row: rows.value[0] || null };
}

export async function patchUserSettings(args: {
  env: Env;
  userId: string;
  patch: UserSettingsPatch;
}): Promise<PatchUserSettingsResult> {
  const nextPatch: UserSettingsPatch = { ...args.patch };

  if (args.patch.country !== undefined || args.patch.timezone !== undefined) {
    const current = await loadCurrentUserSettingsRow(args);
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
  const response = await supabaseAdminFetch(args.env, `/rest/v1/users?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(nextPatch),
  });
  const payload = await readSupabaseAdminJson<BerlinUserRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload),
    };
  }
  const rows = supabaseAdminArrayPayload<BerlinUserRow>(payload, 'coreui.errors.db.writeFailed');
  if (!rows.ok) return rows;
  const profile = normalizeUserSettingsPayload(args.userId, rows.value[0] ?? null);
  if (!profile) {
    return {
      ok: false,
      response: json(
        {
          error: {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail: 'user row missing',
          },
        },
        { status: 500 },
      ),
    };
  }
  return { ok: true, profile };
}
