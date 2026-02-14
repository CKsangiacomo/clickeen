import { ckError } from './errors';

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function assertWorkspaceId(value: unknown) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || !isUuid(trimmed)) {
    return { ok: false as const, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' }, 422) };
  }
  return { ok: true as const, value: trimmed };
}

export function assertConfig(config: unknown) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { ok: false as const, issues: [{ path: 'config', message: 'config must be an object' }] };
  }
  return { ok: true as const, value: config as Record<string, unknown> };
}

export function assertMeta(meta: unknown) {
  if (meta === null) {
    return { ok: true as const, value: null };
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { ok: false as const, issues: [{ path: 'meta', message: 'meta must be an object' }] };
  }
  return { ok: true as const, value: meta as Record<string, unknown> };
}

function containsNonPersistableUrl(value: string): boolean {
  return /(?:^|[\s("'=,])(?:data|blob):/i.test(value);
}

function containsLegacyAssetUrl(value: string): boolean {
  const legacyPathPattern = /^\/(?:workspace-assets|curated-assets|assets\/accounts)\//i;

  const tryPath = (candidate: string): boolean => {
    const trimmed = String(candidate || '').trim();
    if (!trimmed) return false;
    if (legacyPathPattern.test(trimmed)) return true;
    if (!/^https?:\/\//i.test(trimmed)) return false;
    try {
      return legacyPathPattern.test(new URL(trimmed).pathname);
    } catch {
      return false;
    }
  };

  if (tryPath(value)) return true;

  const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let match: RegExpExecArray | null = urlPattern.exec(value);
  while (match) {
    if (tryPath(match[2] || '')) return true;
    match = urlPattern.exec(value);
  }

  return false;
}

export function configNonPersistableUrlIssues(config: unknown): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];

  const visit = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (containsNonPersistableUrl(node)) {
        issues.push({
          path,
          message: 'non-persistable URL scheme found (data:/blob:). Persist stable URLs/keys only.',
        });
      } else if (containsLegacyAssetUrl(node)) {
        issues.push({
          path,
          message: 'legacy Tokyo asset URL found. Use canonical /arsenale/o/{accountId}/{assetId}/... URLs only.',
        });
      }
      return;
    }

    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], `${path}[${i}]`);
      }
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
      visit(value, nextPath);
    }
  };

  visit(config, 'config');
  return issues;
}

export function assertStatus(status: unknown) {
  if (status === undefined) return { ok: true as const, value: undefined };
  if (status !== 'published' && status !== 'unpublished') {
    return { ok: false as const, issues: [{ path: 'status', message: 'invalid status' }] };
  }
  return { ok: true as const, value: status as 'published' | 'unpublished' };
}
