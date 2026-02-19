import { ckError } from './errors';
import { isUuid as isContractUuid, parseCanonicalAssetRef } from '@clickeen/ck-contracts';

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export const isUuid = isContractUuid;

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

function extractPathnameFromUrlCandidate(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).pathname || '/';
    } catch {
      return null;
    }
  }

  if (/^\/\//.test(value)) {
    try {
      return new URL(`https:${value}`).pathname || '/';
    } catch {
      return null;
    }
  }

  if (value.startsWith('/')) return value;
  if (value.startsWith('./') || value.startsWith('../')) return value;
  return null;
}

function parseCanonicalAccountAssetPath(pathname: string): { accountId: string; assetId: string } | null {
  const parsed = parseCanonicalAssetRef(pathname);
  if (!parsed) return null;
  return { accountId: parsed.accountId, assetId: parsed.assetId };
}

function isStaticTokyoAssetPath(pathname: string): boolean {
  return pathname.startsWith('/widgets/') || pathname.startsWith('/themes/') || pathname.startsWith('/dieter/');
}

function isLikelyAssetFieldPath(path: string): boolean {
  return /(?:^|[\].])(?:src|poster|logoFill)$/.test(String(path || ''));
}

export function configAssetUrlContractIssues(
  config: unknown,
  expectedAccountId?: string | null,
): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  const expectedAccount = typeof expectedAccountId === 'string' ? expectedAccountId.trim() : '';
  const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

  const inspectCandidate = (candidateRaw: string, path: string) => {
    const candidate = String(candidateRaw || '').trim();
    if (!candidate) return;
    if (/^(?:data|blob):/i.test(candidate)) return;

    const pathname = extractPathnameFromUrlCandidate(candidate);
    if (!pathname) return;

    if (pathname.includes('/curated-assets/')) {
      issues.push({
        path,
        message: `Legacy asset URL path is not supported: ${candidate}`,
      });
      return;
    }

    if (pathname.startsWith('/arsenale/a/') || pathname.startsWith('/arsenale/o/')) {
      const parsed = parseCanonicalAccountAssetPath(pathname);
      if (!parsed) {
        issues.push({
          path,
          message: `Unsupported asset URL path: ${candidate}`,
        });
        return;
      }
      if (!isUuid(parsed.accountId) || !isUuid(parsed.assetId)) {
        issues.push({
          path,
          message: `Asset URL must include valid accountId/assetId UUIDs: ${candidate}`,
        });
        return;
      }
      if (expectedAccount && parsed.accountId !== expectedAccount) {
        issues.push({
          path,
          message: `Asset URL account mismatch at ${path}: expected ${expectedAccount}, got ${parsed.accountId}`,
        });
      }
      return;
    }

    if (pathname.startsWith('./') || pathname.startsWith('../')) {
      issues.push({
        path,
        message: `Relative asset URL path is not supported: ${candidate}`,
      });
      return;
    }

    if (isStaticTokyoAssetPath(pathname)) return;

    issues.push({
      path,
      message: `Unsupported asset URL path: ${candidate}`,
    });
  };

  const visit = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      let matchedCssUrl = false;
      let match: RegExpExecArray | null = urlPattern.exec(node);
      while (match) {
        matchedCssUrl = true;
        inspectCandidate(match[2] || '', path);
        match = urlPattern.exec(node);
      }
      urlPattern.lastIndex = 0;

      if (!matchedCssUrl && isLikelyAssetFieldPath(path)) {
        inspectCandidate(node, path);
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

export function configNonPersistableUrlIssues(config: unknown): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];

  const visit = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (containsNonPersistableUrl(node)) {
        issues.push({
          path,
          message: 'non-persistable URL scheme found (data:/blob:). Persist stable URLs/keys only.',
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

export function assertDisplayName(displayName: unknown) {
  if (displayName === undefined) return { ok: true as const, value: undefined };
  if (displayName === null) return { ok: true as const, value: null };
  if (typeof displayName !== 'string') {
    return { ok: false as const, issues: [{ path: 'displayName', message: 'displayName must be a string' }] };
  }
  const trimmed = displayName.trim();
  if (!trimmed) {
    return { ok: false as const, issues: [{ path: 'displayName', message: 'displayName cannot be empty' }] };
  }
  if (trimmed.length > 120) {
    return { ok: false as const, issues: [{ path: 'displayName', message: 'displayName must be <= 120 chars' }] };
  }
  return { ok: true as const, value: trimmed };
}
