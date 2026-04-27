import { isUuid } from '@clickeen/ck-contracts';
import {
  classifyAccountAssetType,
  guessContentTypeFromExt,
  sha256Hex,
} from '../asset-utils';
import {
  INTERNAL_SERVICE_HEADER,
  requireDevAuth,
  TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL,
} from '../auth';
import { json } from '../http';
import { respondMethodNotAllowed, type TokyoRouteArgs } from '../route-helpers';

const ROUTE = '/renders/ops/reconcile-account-assets';
const LIST_LIMIT = 1000;

type RepairCandidate =
  | {
      kind: 'account-version';
      assetId: string;
      key: string;
      filename: string;
      sha256: string;
    }
  | {
      kind: 'legacy-version';
      assetId: string;
      key: string;
      filename: string;
    };

type RepairResult = {
  kind: RepairCandidate['kind'];
  assetId: string;
  sourceKey: string;
  targetKey: string;
  manifestKey: string;
  action: 'would_write' | 'written' | 'exists' | 'skipped';
  reason?: string;
};

function normalizeAccountId(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  return isUuid(value) ? value : '';
}

function normalizeDryRun(raw: unknown): boolean {
  if (raw == null) return true;
  return raw !== false;
}

function manifestKey(accountId: string, assetId: string): string {
  return `accounts/${accountId}/assets/meta/${assetId}.json`;
}

function extFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.trim().toLowerCase() || '';
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

function parseAccountVersionCandidate(accountId: string, key: string): RepairCandidate | null {
  const escaped = accountId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = key.match(
    new RegExp(`^accounts/${escaped}/assets/versions/([0-9a-f-]{36})/([a-f0-9]{64})/([^/]+)$`, 'i'),
  );
  if (!match) return null;
  const assetId = String(match[1] || '').toLowerCase();
  const sha256 = String(match[2] || '').toLowerCase();
  const filename = String(match[3] || '').trim();
  if (!isUuid(assetId) || !filename) return null;
  return { kind: 'account-version', assetId, key, filename, sha256 };
}

function parseLegacyVersionCandidate(accountId: string, key: string): RepairCandidate | null {
  const escaped = accountId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = key.match(
    new RegExp(`^assets/versions/${escaped}/([0-9a-f-]{36})/(?:[^/]+/)?([^/]+)$`, 'i'),
  );
  if (!match) return null;
  const assetId = String(match[1] || '').toLowerCase();
  const filename = String(match[2] || '').trim();
  if (!isUuid(assetId) || !filename) return null;
  return { kind: 'legacy-version', assetId, key, filename };
}

async function listKeys(env: TokyoRouteArgs['env'], prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.TOKYO_R2.list({ prefix, cursor, limit: LIST_LIMIT });
    listed.objects.forEach((object: { key?: string }) => {
      const key = String(object.key || '').trim();
      if (key) keys.push(key);
    });
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return keys;
}

async function repairCandidate(args: {
  env: TokyoRouteArgs['env'];
  accountId: string;
  dryRun: boolean;
  includeOther: boolean;
  candidate: RepairCandidate;
}): Promise<RepairResult> {
  const { env, accountId, dryRun, includeOther, candidate } = args;
  const metaKey = manifestKey(accountId, candidate.assetId);
  const existingManifest = await env.TOKYO_R2.head(metaKey);
  if (existingManifest) {
    const targetKey =
      candidate.kind === 'account-version'
        ? candidate.key
        : `accounts/${accountId}/assets/versions/${candidate.assetId}/existing/${candidate.filename}`;
    return {
      kind: candidate.kind,
      assetId: candidate.assetId,
      sourceKey: candidate.key,
      targetKey,
      manifestKey: metaKey,
      action: 'exists',
    };
  }

  const sourceObject = await env.TOKYO_R2.get(candidate.key);
  if (!sourceObject) {
    return {
      kind: candidate.kind,
      assetId: candidate.assetId,
      sourceKey: candidate.key,
      targetKey: candidate.key,
      manifestKey: metaKey,
      action: 'skipped',
      reason: 'source_missing',
    };
  }

  const contentType =
    sourceObject.httpMetadata?.contentType ||
    guessContentTypeFromExt(extFromFilename(candidate.filename));
  const assetType = classifyAccountAssetType(contentType, extFromFilename(candidate.filename));
  if (!includeOther && assetType === 'other') {
    return {
      kind: candidate.kind,
      assetId: candidate.assetId,
      sourceKey: candidate.key,
      targetKey: candidate.key,
      manifestKey: metaKey,
      action: 'skipped',
      reason: 'unsupported_type',
    };
  }
  let targetKey = candidate.key;
  let sha256 = candidate.kind === 'account-version' ? candidate.sha256 : '';
  let body: ArrayBuffer | null = null;

  if (candidate.kind === 'legacy-version') {
    body = await sourceObject.arrayBuffer();
    sha256 = await sha256Hex(body);
    targetKey = `accounts/${accountId}/assets/versions/${candidate.assetId}/${sha256}/${candidate.filename}`;
  }

  const manifest = {
    assetId: candidate.assetId,
    accountId,
    source: 'devstudio',
    originalFilename: candidate.filename,
    normalizedFilename: candidate.filename,
    contentType,
    assetType,
    sizeBytes:
      typeof sourceObject.size === 'number' && Number.isFinite(sourceObject.size)
        ? Math.max(0, Math.floor(sourceObject.size))
        : body?.byteLength ?? 0,
    sha256,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    key: targetKey,
  };

  if (!dryRun) {
    if (candidate.kind === 'legacy-version') {
      await env.TOKYO_R2.put(targetKey, body ?? (await sourceObject.arrayBuffer()), {
        httpMetadata: { contentType },
      });
    }
    await env.TOKYO_R2.put(metaKey, JSON.stringify(manifest), {
      httpMetadata: { contentType: 'application/json' },
    });
  }

  return {
    kind: candidate.kind,
    assetId: candidate.assetId,
    sourceKey: candidate.key,
    targetKey,
    manifestKey: metaKey,
    action: dryRun ? 'would_write' : 'written',
  };
}

export async function tryHandleAccountAssetRepairRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;
  if (pathname !== ROUTE) return null;
  if (req.method !== 'POST') return respondMethodNotAllowed(respond);

  const internalServiceId = String(req.headers.get(INTERNAL_SERVICE_HEADER) || '')
    .trim()
    .toLowerCase();
  if (internalServiceId !== TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL) {
    return respond(json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID' } }, { status: 403 }));
  }
  const authErr = requireDevAuth(req, env, {
    allowTrustedInternalServices: [TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL],
  });
  if (authErr) return respond(authErr);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const accountId = normalizeAccountId(body?.accountId);
  if (!accountId) {
    return respond(
      json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
    );
  }
  const dryRun = normalizeDryRun(body?.dryRun);
  const includeOther = body?.includeOther === true;

  const [accountVersionKeys, legacyVersionKeys, manifestKeys] = await Promise.all([
    listKeys(env, `accounts/${accountId}/assets/versions/`),
    listKeys(env, `assets/versions/${accountId}/`),
    listKeys(env, `accounts/${accountId}/assets/meta/`),
  ]);

  const byAssetId = new Map<string, RepairCandidate>();
  for (const key of accountVersionKeys) {
    const candidate = parseAccountVersionCandidate(accountId, key);
    if (candidate && !byAssetId.has(candidate.assetId)) byAssetId.set(candidate.assetId, candidate);
  }
  for (const key of legacyVersionKeys) {
    const candidate = parseLegacyVersionCandidate(accountId, key);
    if (candidate && !byAssetId.has(candidate.assetId)) byAssetId.set(candidate.assetId, candidate);
  }

  const results = await Promise.all(
    Array.from(byAssetId.values()).map((candidate) =>
      repairCandidate({ env, accountId, dryRun, includeOther, candidate }),
    ),
  );

  return respond(
    json({
      ok: true,
      accountId,
      dryRun,
      includeOther,
      counts: {
        accountVersionKeys: accountVersionKeys.length,
        legacyVersionKeys: legacyVersionKeys.length,
        manifestKeys: manifestKeys.length,
        candidates: byAssetId.size,
        wouldWrite: results.filter((result) => result.action === 'would_write').length,
        written: results.filter((result) => result.action === 'written').length,
        existing: results.filter((result) => result.action === 'exists').length,
        skipped: results.filter((result) => result.action === 'skipped').length,
      },
      results,
    }),
  );
}
