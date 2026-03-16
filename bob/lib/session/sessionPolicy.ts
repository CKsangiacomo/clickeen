import type { Policy } from '@clickeen/ck-policy';
import {
  assertPolicyEntitlementsSnapshot,
  resolvePolicy as resolveCkPolicy,
  resolvePolicyFromEntitlementsSnapshot,
} from '@clickeen/ck-policy';
import type { BootMode, SubjectMode } from './sessionTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function assertPolicy(value: unknown): Policy {
  if (!isRecord(value)) throw new Error('[useWidgetSession] policy must be an object');
  if (value.v !== 1) throw new Error('[useWidgetSession] policy.v must be 1');
  if (typeof value.profile !== 'string' || !value.profile) throw new Error('[useWidgetSession] policy.profile must be a string');
  if (typeof value.role !== 'string' || !value.role) throw new Error('[useWidgetSession] policy.role must be a string');
  if (!isRecord(value.flags)) throw new Error('[useWidgetSession] policy.flags must be an object');
  if (!isRecord(value.caps)) throw new Error('[useWidgetSession] policy.caps must be an object');
  if (!isRecord(value.budgets)) throw new Error('[useWidgetSession] policy.budgets must be an object');
  return value as Policy;
}

function normalizePolicyRole(value: unknown): Policy['role'] | null {
  switch (value) {
    case 'viewer':
    case 'editor':
    case 'admin':
    case 'owner':
      return value;
    default:
      return null;
  }
}

function normalizePolicyProfile(value: unknown): Policy['profile'] | null {
  switch (value) {
    case 'minibob':
    case 'free':
    case 'tier1':
    case 'tier2':
    case 'tier3':
      return value;
    default:
      return null;
  }
}

export function extractErrorReasonKey(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!isRecord(value)) return fallback;
  const error = isRecord(value.error) ? value.error : null;
  if (typeof error?.reasonKey === 'string' && error.reasonKey.trim()) return error.reasonKey.trim();
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  if (typeof value.reasonKey === 'string' && value.reasonKey.trim()) return value.reasonKey.trim();
  return fallback;
}

export function resolveAccountCapsuleFromBootstrapPayload(payload: unknown, accountId: string): string | null {
  if (!isRecord(payload)) return null;
  const authz = isRecord(payload.authz) ? payload.authz : null;
  if (!authz) return null;

  const bootstrapAccountId = typeof authz.accountId === 'string' ? authz.accountId.trim() : '';
  if (!bootstrapAccountId || bootstrapAccountId !== accountId) return null;

  const accountCapsule = typeof authz.accountCapsule === 'string' ? authz.accountCapsule.trim() : '';
  return accountCapsule || null;
}

export function resolveAccountPolicyFromBootstrapPayload(payload: unknown, accountId: string): Policy {
  if (!isRecord(payload)) {
    throw new Error('[useWidgetSession] bootstrap payload must be an object');
  }

  const authz = isRecord(payload.authz) ? payload.authz : null;
  if (!authz) {
    throw new Error(extractErrorReasonKey(payload, 'coreui.errors.auth.required'));
  }

  const bootstrapAccountId = typeof authz.accountId === 'string' ? authz.accountId.trim() : '';
  if (!bootstrapAccountId || bootstrapAccountId !== accountId) {
    throw new Error('coreui.errors.auth.forbidden');
  }

  const role = normalizePolicyRole(authz.role);
  const profile = normalizePolicyProfile(authz.profile);
  if (!role || !profile) {
    throw new Error('coreui.errors.auth.required');
  }
  if (!Object.prototype.hasOwnProperty.call(authz, 'entitlements')) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }

  const entitlements = assertPolicyEntitlementsSnapshot(authz.entitlements);
  if (!entitlements) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }

  return resolvePolicyFromEntitlementsSnapshot({
    profile,
    role,
    entitlements,
  });
}

export function resolveSubjectModeFromUrl(): SubjectMode {
  if (typeof window === 'undefined') return 'account';
  const params = new URLSearchParams(window.location.search);
  const subject = (params.get('subject') || '').trim().toLowerCase();
  if (subject === 'account') return 'account';
  if (subject === 'minibob') return 'minibob';
  return 'account';
}

export function resolveBootModeFromUrl(): BootMode {
  if (typeof window === 'undefined') return 'message';
  const params = new URLSearchParams(window.location.search);
  const boot = (params.get('boot') || '').trim().toLowerCase();
  return boot === 'url' ? 'url' : 'message';
}

export function resolveSurfaceFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('surface') || '').trim().toLowerCase();
}

export function resolvePolicySubject(policy: Policy): 'minibob' | 'account' {
  if (policy.profile === 'minibob') return 'minibob';
  return 'account';
}

export function resolveReadOnlyFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const readonlyFlag = (params.get('readonly') || params.get('readOnly') || '').trim().toLowerCase();
  if (readonlyFlag === '1' || readonlyFlag === 'true' || readonlyFlag === 'yes') return true;
  const role = (params.get('role') || params.get('mode') || '').trim().toLowerCase();
  return role === 'viewer' || role === 'readonly' || role === 'read-only';
}

export function resolveMinibobUrlPolicy(): Policy {
  const role: Policy['role'] = resolveReadOnlyFromUrl() ? 'viewer' : 'editor';
  return resolveCkPolicy({ profile: 'minibob', role });
}
