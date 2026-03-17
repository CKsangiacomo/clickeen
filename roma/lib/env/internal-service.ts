export function resolveInternalServiceJwt(purpose: string): string {
  const value = typeof process !== 'undefined' ? (process.env.CK_INTERNAL_SERVICE_JWT ?? '').trim() : '';
  if (value) return value;
  throw new Error(`[Roma] Missing CK_INTERNAL_SERVICE_JWT (${purpose})`);
}
