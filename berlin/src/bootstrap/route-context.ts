import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import { claimAsString } from '../utils/claims';
import { normalizeUuid } from '../utils/primitives';
import { json, validationError } from '../http';
import { findAccountContext, loadPrincipalAccountState } from './state';
import { resolvePrincipalSession } from '../session/auth-session';
import { type Env } from '../types';

export { normalizeUuid };

export function normalizeAccountPublicId(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return isCompactAccountPublicId(normalized) ? normalized : null;
}

export function denyResponse(): Response {
  return json(
    {
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
      },
    },
    { status: 403 },
  );
}

export async function resolvePrincipalState(request: Request, env: Env) {
  const principal = await resolvePrincipalSession(request, env);
  if (!principal.ok) return { ok: false as const, response: principal.response };

  const state = await loadPrincipalAccountState({
    env,
    userId: principal.userId,
    sessionRole: claimAsString(principal.claims.role),
  });
  if (!state.ok) return { ok: false as const, response: state.response };

  return { ok: true as const, principal, state: state.value };
}

export async function resolveAccountRouteContext(request: Request, env: Env, accountIdRaw: string) {
  const accountId = normalizeAccountPublicId(accountIdRaw);
  if (!accountId) return { ok: false as const, response: validationError('coreui.errors.accountId.invalid') };

  const resolved = await resolvePrincipalState(request, env);
  if (!resolved.ok) return resolved;

  const account = findAccountContext(resolved.state, accountId);
  if (!account) return { ok: false as const, response: denyResponse() };

  return {
    ok: true as const,
    account,
    accountId,
    principal: resolved.principal,
    state: resolved.state,
  };
}
