function normalizeStage(raw: string | undefined): string {
  return String(raw || '').trim().toLowerCase();
}

export function isSnapshotBypassRequested(req: Request): boolean {
  return req.headers.get('x-ck-snapshot-bypass') === '1';
}

export function isSnapshotBypassAuthorized(req: Request): boolean {
  const stage = normalizeStage(process.env.ENV_STAGE);
  const nodeEnv = normalizeStage(process.env.NODE_ENV);
  if (stage === 'local' || nodeEnv !== 'production') return true;

  const expectedToken = String(process.env.VENICE_INTERNAL_BYPASS_TOKEN || '').trim();
  if (!expectedToken) return false;

  const provided = String(req.headers.get('x-ck-internal-bypass-token') || '').trim();
  if (!provided) return false;
  return provided === expectedToken;
}

export function resolveSnapshotBypass(req: Request): {
  requested: boolean;
  enabled: boolean;
} {
  const requested = isSnapshotBypassRequested(req);
  if (!requested) return { requested: false, enabled: false };
  return { requested: true, enabled: isSnapshotBypassAuthorized(req) };
}
