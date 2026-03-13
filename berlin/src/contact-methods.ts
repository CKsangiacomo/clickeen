import { enc, json, validationError } from './helpers';
import { readSupabaseAdminJson, supabaseAdminErrorResponse, supabaseAdminFetch } from './supabase-admin';
import { type Env } from './types';

export type UserContactChannel = 'phone' | 'whatsapp';

export type BerlinContactMethodPayload = {
  value: string | null;
  verified: boolean;
  pendingValue: string | null;
  challengeExpiresAt: string | null;
};

export type BerlinContactMethodsPayload = {
  phone: BerlinContactMethodPayload;
  whatsapp: BerlinContactMethodPayload;
};

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

type ContactMethodRow = {
  channel?: unknown;
  value?: unknown;
  verified_at?: unknown;
};

type ContactVerificationRow = {
  id?: unknown;
  channel?: unknown;
  pending_value?: unknown;
  code_hash?: unknown;
  expires_at?: unknown;
  attempts_remaining?: unknown;
  consumed_at?: unknown;
  created_at?: unknown;
};

const CHALLENGE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeChannel(value: string): UserContactChannel | null {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (normalized === 'phone' || normalized === 'whatsapp') return normalized;
  return null;
}

function normalizeContactValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/[^\d+]/g, '');
  if (!compact) return null;
  const normalized = compact.startsWith('+') ? compact : `+${compact}`;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function normalizeTimestamp(value: unknown): string | null {
  const normalized = asTrimmedString(value);
  if (!normalized) return null;
  return Number.isFinite(Date.parse(normalized)) ? normalized : null;
}

function normalizeAttempts(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
  }
  return 0;
}

function emptyContactMethod(): BerlinContactMethodPayload {
  return {
    value: null,
    verified: false,
    pendingValue: null,
    challengeExpiresAt: null,
  };
}

function createEmptyContactMethods(): BerlinContactMethodsPayload {
  return {
    phone: emptyContactMethod(),
    whatsapp: emptyContactMethod(),
  };
}

function resolveStage(env: Env): string {
  const stage = asTrimmedString(env.ENV_STAGE);
  return stage ? stage.toLowerCase() : 'local';
}

function isLocalStage(env: Env): boolean {
  return resolveStage(env) === 'local';
}

function generateVerificationCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, '0');
}

async function hashVerificationCode(challengeId: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${challengeId}:${code}`));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function listVerifiedContactMethodRows(env: Env, userId: string): Promise<Result<ContactMethodRow[]>> {
  const params = new URLSearchParams({
    select: 'channel,value,verified_at',
    user_id: `eq.${userId}`,
    limit: '10',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/user_contact_methods?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<ContactMethodRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  return { ok: true, value: Array.isArray(payload) ? payload : [] };
}

async function listPendingVerificationRows(env: Env, userId: string): Promise<Result<ContactVerificationRow[]>> {
  const params = new URLSearchParams({
    select: 'id,channel,pending_value,expires_at,attempts_remaining,consumed_at,created_at',
    user_id: `eq.${userId}`,
    consumed_at: 'is.null',
    order: 'created_at.desc',
    limit: '10',
  });
  const response = await supabaseAdminFetch(env, `/rest/v1/user_contact_verifications?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<ContactVerificationRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  return { ok: true, value: Array.isArray(payload) ? payload : [] };
}

export async function loadUserContactMethods(
  env: Env,
  userId: string,
): Promise<Result<BerlinContactMethodsPayload>> {
  const [verifiedRows, verificationRows] = await Promise.all([
    listVerifiedContactMethodRows(env, userId),
    listPendingVerificationRows(env, userId),
  ]);
  if (!verifiedRows.ok) return verifiedRows;
  if (!verificationRows.ok) return verificationRows;

  const out = createEmptyContactMethods();
  for (const row of verifiedRows.value) {
    const channel = normalizeChannel(String(row.channel || ''));
    const value = normalizeContactValue(row.value);
    if (!channel || !value || !normalizeTimestamp(row.verified_at)) continue;
    out[channel] = {
      ...out[channel],
      value,
      verified: true,
    };
  }

  const nowMs = Date.now();
  for (const row of verificationRows.value) {
    const channel = normalizeChannel(String(row.channel || ''));
    if (!channel) continue;
    if (out[channel].pendingValue) continue;
    const pendingValue = normalizeContactValue(row.pending_value);
    const expiresAt = normalizeTimestamp(row.expires_at);
    const attemptsRemaining = normalizeAttempts(row.attempts_remaining);
    if (!pendingValue || !expiresAt || attemptsRemaining <= 0) continue;
    if (Date.parse(expiresAt) <= nowMs) continue;
    out[channel] = {
      ...out[channel],
      pendingValue,
      challengeExpiresAt: expiresAt,
    };
  }

  return { ok: true, value: out };
}

async function replacePendingChallenges(args: {
  env: Env;
  userId: string;
  channel: UserContactChannel;
}): Promise<Response | null> {
  const response = await supabaseAdminFetch(
    args.env,
    `/rest/v1/user_contact_verifications?user_id=eq.${encodeURIComponent(args.userId)}&channel=eq.${args.channel}&consumed_at=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ consumed_at: new Date().toISOString() }),
    },
  );
  if (response.ok) return null;
  const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
  return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload);
}

export async function startUserContactVerification(args: {
  env: Env;
  userId: string;
  channel: UserContactChannel;
  value: unknown;
}): Promise<Response> {
  const normalizedValue = normalizeContactValue(args.value);
  if (!normalizedValue) {
    return validationError('coreui.errors.user.contact.invalid', 'contact value must be E.164-like');
  }

  if (!isLocalStage(args.env)) {
    return json(
      {
        error: {
          kind: 'UNAVAILABLE',
          reasonKey: 'coreui.errors.user.contact.unavailable',
          detail: 'contact_verification_delivery_unavailable',
        },
      },
      { status: 503 },
    );
  }

  const replaced = await replacePendingChallenges(args);
  if (replaced) return replaced;

  const challengeId = crypto.randomUUID();
  const code = generateVerificationCode();
  const codeHash = await hashVerificationCode(challengeId, code);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

  const response = await supabaseAdminFetch(args.env, '/rest/v1/user_contact_verifications', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: challengeId,
      user_id: args.userId,
      channel: args.channel,
      pending_value: normalizedValue,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts_remaining: MAX_ATTEMPTS,
    }),
  });
  if (!response.ok) {
    const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
    return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload);
  }

  const contactMethods = await loadUserContactMethods(args.env, args.userId);
  if (!contactMethods.ok) return contactMethods.response;

  return json(
    {
      ok: true,
      channel: args.channel,
      contactMethods: contactMethods.value,
      delivery: {
        mode: 'local_capture',
        previewCode: code,
      },
    },
    { status: 202 },
  );
}

async function loadLatestPendingChallenge(args: {
  env: Env;
  userId: string;
  channel: UserContactChannel;
}): Promise<Result<ContactVerificationRow | null>> {
  const params = new URLSearchParams({
    select: 'id,channel,pending_value,expires_at,attempts_remaining,consumed_at,created_at',
    user_id: `eq.${args.userId}`,
    channel: `eq.${args.channel}`,
    consumed_at: 'is.null',
    order: 'created_at.desc',
    limit: '1',
  });
  const response = await supabaseAdminFetch(args.env, `/rest/v1/user_contact_verifications?${params.toString()}`, {
    method: 'GET',
  });
  const payload = await readSupabaseAdminJson<ContactVerificationRow[] | Record<string, unknown>>(response);
  if (!response.ok) {
    return {
      ok: false,
      response: supabaseAdminErrorResponse('coreui.errors.db.readFailed', response.status, payload),
    };
  }
  return { ok: true, value: Array.isArray(payload) ? payload[0] || null : null };
}

async function patchVerificationRow(args: {
  env: Env;
  challengeId: string;
  body: Record<string, unknown>;
}): Promise<Response | null> {
  const response = await supabaseAdminFetch(
    args.env,
    `/rest/v1/user_contact_verifications?id=eq.${encodeURIComponent(args.challengeId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(args.body),
    },
  );
  if (response.ok) return null;
  const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
  return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload);
}

async function upsertVerifiedContactMethod(args: {
  env: Env;
  userId: string;
  channel: UserContactChannel;
  value: string;
}): Promise<Response | null> {
  const response = await supabaseAdminFetch(
    args.env,
    `/rest/v1/user_contact_methods?on_conflict=${encodeURIComponent('user_id,channel')}`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: args.userId,
        channel: args.channel,
        value: args.value,
        verified_at: new Date().toISOString(),
      }),
    },
  );
  if (response.ok) return null;
  const payload = await readSupabaseAdminJson<Record<string, unknown>>(response);
  return supabaseAdminErrorResponse('coreui.errors.db.writeFailed', response.status, payload);
}

export async function verifyUserContactMethod(args: {
  env: Env;
  userId: string;
  channel: UserContactChannel;
  code: unknown;
}): Promise<Response> {
  const normalizedCode = typeof args.code === 'string' ? args.code.trim() : '';
  if (!/^\d{6}$/.test(normalizedCode)) {
    return validationError('coreui.errors.user.contact.codeInvalid', 'verification code must be 6 digits');
  }

  const latest = await loadLatestPendingChallenge(args);
  if (!latest.ok) return latest.response;

  const row = latest.value;
  const challengeId = asTrimmedString(row?.id);
  const pendingValue = normalizeContactValue(row?.pending_value);
  const expiresAt = normalizeTimestamp(row?.expires_at);
  const attemptsRemaining = normalizeAttempts(row?.attempts_remaining);
  if (!challengeId || !pendingValue || !expiresAt || attemptsRemaining <= 0) {
    return validationError('coreui.errors.user.contact.challengeMissing');
  }
  if (Date.parse(expiresAt) <= Date.now()) {
    const expired = await patchVerificationRow({
      env: args.env,
      challengeId,
      body: { consumed_at: new Date().toISOString() },
    });
    if (expired) return expired;
    return validationError('coreui.errors.user.contact.codeExpired');
  }

  const providedHash = await hashVerificationCode(challengeId, normalizedCode);
  const storedHash = asTrimmedString((row as ContactVerificationRow).code_hash);
  if (!storedHash || providedHash !== storedHash) {
    const nextAttempts = Math.max(0, attemptsRemaining - 1);
    const updateError = await patchVerificationRow({
      env: args.env,
      challengeId,
      body: {
        attempts_remaining: nextAttempts,
        ...(nextAttempts === 0 ? { consumed_at: new Date().toISOString() } : {}),
      },
    });
    if (updateError) return updateError;
    return validationError('coreui.errors.user.contact.codeInvalid');
  }

  const writeError = await upsertVerifiedContactMethod({
    env: args.env,
    userId: args.userId,
    channel: args.channel,
    value: pendingValue,
  });
  if (writeError) return writeError;

  const consumeError = await replacePendingChallenges({
    env: args.env,
    userId: args.userId,
    channel: args.channel,
  });
  if (consumeError) return consumeError;

  const contactMethods = await loadUserContactMethods(args.env, args.userId);
  if (!contactMethods.ok) return contactMethods.response;

  return json({
    ok: true,
    channel: args.channel,
    contactMethods: contactMethods.value,
  });
}
