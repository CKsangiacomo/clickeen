const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

export function normalizeUuid(value: unknown): string | null {
  const normalized = asTrimmedString(value);
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
}

export function isUuid(value: unknown): value is string {
  return Boolean(normalizeUuid(value));
}

export async function readJsonPayload(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
