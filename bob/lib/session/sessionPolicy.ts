import type { Policy } from '@clickeen/ck-policy';
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

export function extractErrorReasonKey(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!isRecord(value)) return fallback;
  const error = isRecord(value.error) ? value.error : null;
  if (typeof error?.reasonKey === 'string' && error.reasonKey.trim()) return error.reasonKey.trim();
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  if (typeof value.reasonKey === 'string' && value.reasonKey.trim()) return value.reasonKey.trim();
  return fallback;
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

export function resolvePolicySubject(policy: Policy): 'minibob' | 'account' {
  if (policy.profile === 'minibob') return 'minibob';
  return 'account';
}
