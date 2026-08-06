const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

const ACCOUNT_ROLE_LABELS = {
  viewer: 'Viewer',
  editor: 'Editor',
  admin: 'Admin',
  owner: 'Owner',
} as const;

type AccountRole = keyof typeof ACCOUNT_ROLE_LABELS;

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('en-US');
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const rounded = size >= 10 || unitIndex === 0 ? Math.round(size) : Number(size.toFixed(1));
  return `${rounded.toLocaleString('en-US')} ${BYTE_UNITS[unitIndex]}`;
}

export function formatAccountTierLabel(value: unknown): string {
  switch (value) {
    case 'free':
      return 'Free';
    case 'tier1':
      return 'Tier 1';
    case 'tier2':
      return 'Tier 2';
    case 'tier3':
      return 'Tier 3';
    case 'tier4':
      return 'Tier 4';
    default:
      return 'Invalid plan';
  }
}

export function isAccountRoleValue(value: unknown): value is AccountRole {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACCOUNT_ROLE_LABELS, value);
}

export function formatAccountRoleLabel(value: unknown): string {
  return isAccountRoleValue(value) ? ACCOUNT_ROLE_LABELS[value] : 'Invalid role';
}
