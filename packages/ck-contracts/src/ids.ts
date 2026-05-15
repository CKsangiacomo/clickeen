export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(raw: unknown): boolean {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return Boolean(value && UUID_RE.test(value));
}
