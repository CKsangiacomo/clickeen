export function isLocalHostname(hostname: string | null | undefined): boolean {
  const normalized = String(hostname || '').trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1';
}
