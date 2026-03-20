import { consumeAuthTicket, storeAuthTicket, type TicketConsumeResult } from './auth-ticket-store';
import { claimAsNumber, claimAsString, enc, toBase64Url } from './helpers';
import { type Env, type OAuthFinishTransaction, type OAuthTransaction } from './types';
import { normalizeIntent, normalizeNextPath, normalizeProvider } from './auth-config';

export function createOauthStateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return toBase64Url(bytes);
}

export function createFinishId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return toBase64Url(bytes);
}

export function isValidOauthStateId(value: string | null): value is string {
  if (!value) return false;
  return /^[A-Za-z0-9_-]{16,120}$/.test(value);
}

export function isValidFinishId(value: string | null): value is string {
  if (!value) return false;
  return /^[A-Za-z0-9_-]{16,120}$/.test(value);
}

function toOauthTransaction(value: unknown): OAuthTransaction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const version = claimAsNumber(record.v);
  const flow = claimAsString(record.flow);
  const provider = normalizeProvider(record.provider);
  const codeVerifier = claimAsString(record.codeVerifier);
  const createdAt = claimAsNumber(record.createdAt);
  const expiresAt = claimAsNumber(record.expiresAt);
  const sid = claimAsString(record.sid) || undefined;
  const userId = claimAsString(record.userId) || undefined;
  const intent = normalizeIntent(record.intent) || undefined;
  const next = normalizeNextPath(record.next) || undefined;

  if (version !== 1) return null;
  if ((flow !== 'login' && flow !== 'link') || !provider || !codeVerifier) return null;
  if (!createdAt || !expiresAt || expiresAt <= createdAt) return null;
  if (flow === 'link' && (!sid || !userId)) return null;
  if (record.intent !== undefined && !intent) return null;
  if (record.next !== undefined && !next) return null;

  return {
    v: 1,
    flow,
    provider,
    codeVerifier,
    createdAt,
    expiresAt,
    ...(sid ? { sid } : {}),
    ...(userId ? { userId } : {}),
    ...(intent ? { intent } : {}),
    ...(next ? { next } : {}),
  };
}

function toOauthFinishTransaction(value: unknown): OAuthFinishTransaction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const version = claimAsNumber(record.v);
  const provider = normalizeProvider(record.provider);
  const userId = claimAsString(record.userId);
  const sessionId = claimAsString(record.sessionId);
  const accessToken = claimAsString(record.accessToken);
  const refreshToken = claimAsString(record.refreshToken);
  const accessTokenMaxAge = claimAsNumber(record.accessTokenMaxAge);
  const refreshTokenMaxAge = claimAsNumber(record.refreshTokenMaxAge);
  const expiresAt = claimAsString(record.expiresAt);
  const intent = normalizeIntent(record.intent);
  const next = normalizeNextPath(record.next);
  const createdAt = claimAsNumber(record.createdAt);
  const finishExpiresAt = claimAsNumber(record.finishExpiresAt);

  if (version !== 1) return null;
  if (!provider || !userId || !sessionId) return null;
  if (!accessToken || !refreshToken || !expiresAt) return null;
  if (!accessTokenMaxAge || accessTokenMaxAge <= 0) return null;
  if (!refreshTokenMaxAge || refreshTokenMaxAge <= 0) return null;
  if (!intent || !next) return null;
  if (!createdAt || !finishExpiresAt || finishExpiresAt <= createdAt) return null;

  return {
    v: 1,
    provider,
    userId,
    sessionId,
    accessToken,
    refreshToken,
    accessTokenMaxAge,
    refreshTokenMaxAge,
    expiresAt,
    intent,
    next,
    createdAt,
    finishExpiresAt,
  };
}

export async function saveOauthTransaction(env: Env, stateId: string, txn: OAuthTransaction): Promise<boolean> {
  return storeAuthTicket(env, 'state', stateId, txn, txn.expiresAt);
}

export async function consumeOauthTransaction(env: Env, stateId: string): Promise<TicketConsumeResult<OAuthTransaction>> {
  return consumeAuthTicket(env, 'state', stateId, toOauthTransaction);
}

export async function saveOauthFinishTransaction(env: Env, finishId: string, txn: OAuthFinishTransaction): Promise<boolean> {
  return storeAuthTicket(env, 'finish', finishId, txn, txn.finishExpiresAt);
}

export async function consumeOauthFinishTransaction(
  env: Env,
  finishId: string,
): Promise<TicketConsumeResult<OAuthFinishTransaction>> {
  return consumeAuthTicket(env, 'finish', finishId, toOauthFinishTransaction);
}

export function createPkceCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

export async function createPkceCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(codeVerifier));
  return toBase64Url(new Uint8Array(digest));
}
