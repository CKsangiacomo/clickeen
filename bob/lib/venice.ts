export function getVeniceBase(): string {
  const env = process.env.NEXT_PUBLIC_VENICE_URL;
  const base = env && env.trim().length > 0 ? env : 'http://localhost:3002';
  return base.replace(/\/$/, '');
}

