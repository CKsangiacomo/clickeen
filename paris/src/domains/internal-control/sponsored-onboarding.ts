import { isTrustedInternalServiceRequest } from '../../shared/auth';
import { ckError, errorDetail } from '../../shared/errors';
import { readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import type { AccountTier, Env } from '../../shared/types';
import { asTrimmedString, isRecord } from '../../shared/validation';
import { type InternalControlActor, writeInternalControlEvent } from './audit';

const SPONSORED_TIER: AccountTier = 'tier3';
const SPONSORED_MODE = 'complimentary';

type SponsoredOnboardingPayload = {
  accountName: string;
  ownerEmail: string;
  reason: string;
  expiresAt: string | null;
};

function localToolActor(): InternalControlActor {
  return {
    mode: 'local-tool',
    subject: 'owner',
    serviceId: 'devstudio.local',
  };
}

function denyResponse(detail: string): Response {
  return ckError(
    {
      kind: 'DENY',
      reasonKey: 'coreui.errors.internalControl.forbidden',
      detail,
    },
    403,
  );
}

function validationResponse(detail: string): Response {
  return ckError(
    {
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.payload.invalid',
      detail,
    },
    422,
  );
}

function internalResponse(reasonKey: string, detail?: string): Response {
  return ckError(
    {
      kind: 'INTERNAL',
      reasonKey,
      ...(detail ? { detail } : {}),
    },
    500,
  );
}

function conflictResponse(reasonKey: string, detail?: string): Response {
  return ckError(
    {
      kind: 'DENY',
      reasonKey,
      ...(detail ? { detail } : {}),
    },
    409,
  );
}

function normalizeEmail(value: unknown): string | null {
  const email = asTrimmedString(value)?.toLowerCase() ?? null;
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function parseIsoTimestamp(value: unknown): string | null {
  if (value == null || value === '') return null;
  const raw = asTrimmedString(value);
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function parseSponsoredOnboardingPayload(value: unknown):
  | { ok: true; value: SponsoredOnboardingPayload }
  | { ok: false; response: Response } {
  if (!isRecord(value)) {
    return { ok: false, response: validationResponse('payload must be an object') };
  }

  const accountName = asTrimmedString(value.accountName);
  if (!accountName || accountName.length > 80) {
    return { ok: false, response: validationResponse('accountName must be a non-empty string up to 80 chars') };
  }

  const ownerEmail = normalizeEmail(value.ownerEmail);
  if (!ownerEmail) {
    return { ok: false, response: validationResponse('ownerEmail must be a valid email address') };
  }

  const reason = asTrimmedString(value.reason);
  if (!reason || reason.length > 280) {
    return { ok: false, response: validationResponse('reason must be a non-empty string up to 280 chars') };
  }

  const expiresAt = parseIsoTimestamp(value.expiresAt);
  if (value.expiresAt != null && !expiresAt) {
    return { ok: false, response: validationResponse('expiresAt must be an ISO timestamp or null') };
  }

  return {
    ok: true,
    value: {
      accountName,
      ownerEmail,
      reason,
      expiresAt,
    },
  };
}

function resolveAccountSlug(accountId: string): string {
  return `acct-${accountId.replace(/-/g, '')}`;
}

function resolveSupabaseAuthBaseUrl(env: Env): string {
  const baseUrl = asTrimmedString(env.SUPABASE_URL)?.replace(/\/+$/, '') ?? '';
  if (!baseUrl) {
    throw new Error('Missing SUPABASE_URL for internal control route');
  }
  return `${baseUrl}/auth/v1`;
}

function resolveSupabaseServiceRoleKey(env: Env): string {
  const key = asTrimmedString(env.SUPABASE_SERVICE_ROLE_KEY) ?? '';
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for internal control route');
  }
  return key;
}

async function inviteOwnerUser(env: Env, ownerEmail: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: Response }
> {
  try {
    const key = resolveSupabaseServiceRoleKey(env);
    const response = await fetch(`${resolveSupabaseAuthBaseUrl(env)}/invite`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        email: ownerEmail,
        data: {
          source: 'internal_control.sponsored_onboarding',
        },
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      const detail =
        isRecord(payload) && typeof payload.msg === 'string'
          ? payload.msg
          : isRecord(payload) && typeof payload.message === 'string'
            ? payload.message
            : JSON.stringify(payload);
      const status = response.status === 409 ? 409 : 500;
      return {
        ok: false,
        response:
          status === 409
            ? conflictResponse('coreui.errors.internalControl.sponsoredOwnerConflict', detail)
            : internalResponse('coreui.errors.internalControl.sponsoredOwnerInviteFailed', detail),
      };
    }

    const userRecord = isRecord(payload) && isRecord(payload.user) ? payload.user : isRecord(payload) ? payload : null;
    const userId = userRecord && typeof userRecord.id === 'string' ? userRecord.id.trim() : '';
    if (!userId) {
      return {
        ok: false,
        response: internalResponse(
          'coreui.errors.internalControl.sponsoredOwnerInviteFailed',
          'invite_response_missing_user_id',
        ),
      };
    }

    return { ok: true, userId };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.sponsoredOwnerInviteFailed', errorDetail(error)),
    };
  }
}

async function createSponsoredAccount(env: Env, accountId: string, accountName: string): Promise<
  | { ok: true; account: { accountId: string; name: string; slug: string; tier: AccountTier } }
  | { ok: false; response: Response }
> {
  try {
    const slug = resolveAccountSlug(accountId);
    const response = await supabaseFetch(env, '/rest/v1/accounts', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: accountId,
        status: 'active',
        is_platform: false,
        tier: SPONSORED_TIER,
        name: accountName,
        slug,
        website_url: null,
        l10n_locales: [],
        l10n_policy: {
          v: 1,
          baseLocale: 'en',
          ip: { enabled: false, countryToLocale: {} },
          switcher: { enabled: true },
        },
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        response: internalResponse('coreui.errors.internalControl.accountCreateFailed', JSON.stringify(payload)),
      };
    }

    return {
      ok: true,
      account: {
        accountId,
        name: accountName,
        slug,
        tier: SPONSORED_TIER,
      },
    };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.accountCreateFailed', errorDetail(error)),
    };
  }
}

async function createOwnerMembership(env: Env, accountId: string, userId: string): Promise<{ ok: true } | { ok: false; response: Response }> {
  try {
    const response = await supabaseFetch(
      env,
      `/rest/v1/account_members?on_conflict=${encodeURIComponent('account_id,user_id')}`,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          account_id: accountId,
          user_id: userId,
          role: 'owner',
        }),
      },
    );
    if (response.ok) return { ok: true };
    const payload = await readJson(response);
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.ownerMembershipFailed', JSON.stringify(payload)),
    };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.ownerMembershipFailed', errorDetail(error)),
    };
  }
}

async function upsertCommercialOverride(
  env: Env,
  accountId: string,
  reason: string,
  expiresAt: string | null,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  try {
    const response = await supabaseFetch(
      env,
      `/rest/v1/account_commercial_overrides?on_conflict=${encodeURIComponent('account_id')}`,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          account_id: accountId,
          mode: SPONSORED_MODE,
          reason,
          expires_at: expiresAt,
        }),
      },
    );
    if (response.ok) return { ok: true };
    const payload = await readJson(response);
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.commercialOverrideFailed', JSON.stringify(payload)),
    };
  } catch (error) {
    return {
      ok: false,
      response: internalResponse('coreui.errors.internalControl.commercialOverrideFailed', errorDetail(error)),
    };
  }
}

async function deleteAccountIfCreated(env: Env, accountId: string): Promise<void> {
  await supabaseFetch(env, `/rest/v1/accounts?id=eq.${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  }).catch(() => undefined);
}

export async function handleSponsoredAccountCreate(request: Request, env: Env): Promise<Response> {
  if (!isTrustedInternalServiceRequest(request, env)) {
    return denyResponse('internal_control_auth_required');
  }

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  const parsed = parseSponsoredOnboardingPayload(payload);
  if (!parsed.ok) return parsed.response;

  const actor = localToolActor();
  const accountId = crypto.randomUUID();

  const invitedOwner = await inviteOwnerUser(env, parsed.value.ownerEmail);
  if (!invitedOwner.ok) return invitedOwner.response;

  const accountCreate = await createSponsoredAccount(env, accountId, parsed.value.accountName);
  if (!accountCreate.ok) return accountCreate.response;

  const ownerMembership = await createOwnerMembership(env, accountId, invitedOwner.userId);
  if (!ownerMembership.ok) {
    await deleteAccountIfCreated(env, accountId);
    return ownerMembership.response;
  }

  const override = await upsertCommercialOverride(
    env,
    accountId,
    parsed.value.reason,
    parsed.value.expiresAt,
  );
  if (!override.ok) {
    await deleteAccountIfCreated(env, accountId);
    return override.response;
  }

  const audit = await writeInternalControlEvent({
    env,
    kind: 'sponsored_account_onboarded',
    actor,
    targetType: 'account',
    targetId: accountId,
    accountId,
    reason: parsed.value.reason,
    payload: {
      accountName: parsed.value.accountName,
      ownerEmail: parsed.value.ownerEmail,
      tier: SPONSORED_TIER,
      commercialMode: SPONSORED_MODE,
      expiresAt: parsed.value.expiresAt,
    },
    result: {
      invitedOwnerUserId: invitedOwner.userId,
      onboardingMethod: 'supabase-auth-invite',
    },
  });
  if (!audit.ok) {
    await deleteAccountIfCreated(env, accountId);
    return audit.response;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      auditEventId: audit.eventId,
      account: {
        accountId,
        name: accountCreate.account.name,
        slug: accountCreate.account.slug,
        tier: accountCreate.account.tier,
        commercialMode: SPONSORED_MODE,
        commercialReason: parsed.value.reason,
        commercialExpiresAt: parsed.value.expiresAt,
      },
      owner: {
        email: parsed.value.ownerEmail,
        userId: invitedOwner.userId,
        onboardingMethod: 'supabase-auth-invite',
      },
    }),
    {
      status: 201,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}
