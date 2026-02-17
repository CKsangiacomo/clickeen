const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

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
