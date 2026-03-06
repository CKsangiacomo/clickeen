import type { MemberRole } from '@clickeen/ck-policy';
import type { AccountRow } from './types';

export function normalizeMemberRole(value: unknown): MemberRole | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  switch (normalized) {
    case 'viewer':
    case 'editor':
    case 'admin':
    case 'owner':
      return normalized;
    default:
      return null;
  }
}

export function roleRank(value: unknown): number {
  switch (normalizeMemberRole(value)) {
    case 'owner':
      return 4;
    case 'admin':
      return 3;
    case 'editor':
      return 2;
    case 'viewer':
      return 1;
    default:
      return 0;
  }
}

export function tierRank(value: unknown): number {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  switch (normalized as AccountRow['tier']) {
    case 'tier3':
      return 4;
    case 'tier2':
      return 3;
    case 'tier1':
      return 2;
    case 'free':
      return 1;
    default:
      return 0;
  }
}
