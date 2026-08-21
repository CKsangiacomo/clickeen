import type { MemberRole, PolicyProfile } from '@clickeen/ck-policy';
import englishAccountCopy from '../l10n/account/en.json';
import ROMA_PLANS_UI_COPY from '../l10n/plans/en.json';

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

const ACCOUNT_ROLE_LABELS: Record<MemberRole, string> = {
  viewer: englishAccountCopy.roles.viewer,
  editor: englishAccountCopy.roles.editor,
  admin: englishAccountCopy.roles.admin,
  owner: englishAccountCopy.roles.owner,
} as const;

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const rounded = size >= 10 || unitIndex === 0 ? Math.round(size) : Number(size.toFixed(1));
  return `${rounded.toLocaleString('en-US')} ${BYTE_UNITS[unitIndex]}`;
}

export function formatAccountTierLabel(value: PolicyProfile): string {
  return ROMA_PLANS_UI_COPY.tiers[value];
}

export function formatAccountRoleLabel(value: MemberRole): string {
  return ACCOUNT_ROLE_LABELS[value];
}
