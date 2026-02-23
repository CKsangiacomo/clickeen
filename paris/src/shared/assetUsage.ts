import type { Env } from './types';
import { readJson } from './http';
import { supabaseFetch } from './supabase';
import { isUuid } from './validation';
import { parseCanonicalAssetRef } from '@clickeen/ck-contracts';

type AccountAssetRef = {
  accountId: string;
  assetId: string;
};

type SyncAccountAssetUsageRpcRow = {
  count?: unknown;
  sync_account_asset_usage?: unknown;
};

export type AccountAssetUsageRef = {
  accountId: string;
  assetId: string;
  publicId: string;
  configPath: string;
};

export class AssetUsageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssetUsageValidationError';
  }
}

function parseAccountAssetRef(raw: string): AccountAssetRef | null {
  const parsed = parseCanonicalAssetRef(raw);
  if (!parsed || parsed.kind !== 'pointer') return null;
  if (!isUuid(parsed.accountId) || !isUuid(parsed.assetId)) return null;
  return {
    accountId: parsed.accountId,
    assetId: parsed.assetId,
  };
}

function findAccountAssetRefsInString(value: string): AccountAssetRef[] {
  const out: AccountAssetRef[] = [];
  const direct = parseAccountAssetRef(value);
  if (direct) out.push(direct);

  const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let match: RegExpExecArray | null = urlPattern.exec(value);
  while (match) {
    const ref = parseAccountAssetRef(match[2] || '');
    if (ref) out.push(ref);
    match = urlPattern.exec(value);
  }
  return out;
}

export function extractAccountAssetUsageRefs(config: unknown, publicId: string): AccountAssetUsageRef[] {
  const out = new Map<string, AccountAssetUsageRef>();

  const visit = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      const refs = findAccountAssetRefsInString(node);
      for (const ref of refs) {
        const usage: AccountAssetUsageRef = {
          accountId: ref.accountId,
          assetId: ref.assetId,
          publicId,
          configPath: path,
        };
        out.set(`${usage.accountId}|${usage.assetId}|${usage.publicId}|${usage.configPath}`, usage);
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
      const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
        ? `${path}.${key}`
        : `${path}[${JSON.stringify(key)}]`;
      visit(value, nextPath);
    }
  };

  visit(config, 'config');
  return Array.from(out.values());
}

async function resolveValidatedAccountAssetUsageRefs(args: {
  env: Env;
  accountId: string;
  publicId: string;
  config: Record<string, unknown>;
}): Promise<AccountAssetUsageRef[]> {
  const accountId = String(args.accountId || '').trim();
  const publicId = String(args.publicId || '').trim();
  if (!isUuid(accountId)) {
    throw new AssetUsageValidationError(`Invalid accountId: ${accountId || '<empty>'}`);
  }
  if (!publicId) {
    throw new AssetUsageValidationError('Invalid publicId: <empty>');
  }

  const refs = extractAccountAssetUsageRefs(args.config, publicId);
  const mismatchedRef = refs.find((ref) => ref.accountId !== accountId);
  if (mismatchedRef) {
    throw new AssetUsageValidationError(
      `Account asset reference mismatch at ${mismatchedRef.configPath}: expected account_id=${accountId}, got account_id=${mismatchedRef.accountId}`,
    );
  }

  if (refs.length > 0) {
    const assetIds = Array.from(new Set(refs.map((ref) => ref.assetId).filter(Boolean)));
    if (!assetIds.length) {
      throw new AssetUsageValidationError('Account asset references are missing asset ids');
    }

    const existingKeys = new Set<string>();
    const existingParams = new URLSearchParams({
      select: 'account_id,asset_id',
      account_id: `eq.${accountId}`,
      asset_id: `in.(${assetIds.join(',')})`,
      limit: String(Math.max(assetIds.length, 1)),
    });
    const existingRes = await supabaseFetch(
      args.env,
      `/rest/v1/account_assets?${existingParams.toString()}`,
      { method: 'GET' },
    );
    if (!existingRes.ok) {
      const details = await readJson(existingRes);
      throw new Error(
        `[ParisWorker] Failed to validate account assets (${existingRes.status}): ${JSON.stringify(details)}`,
      );
    }
    const existingRows = (await existingRes.json().catch(() => null)) as Array<{
      account_id?: string;
      asset_id?: string;
    }> | null;
    if (Array.isArray(existingRows)) {
      for (const row of existingRows) {
        const rowAccountId = typeof row?.account_id === 'string' ? row.account_id.trim() : '';
        const rowAssetId = typeof row?.asset_id === 'string' ? row.asset_id.trim() : '';
        if (!rowAccountId || !rowAssetId) continue;
        existingKeys.add(`${rowAccountId}|${rowAssetId}`);
      }
    }

    const missingRef = refs.find((row) => !existingKeys.has(`${row.accountId}|${row.assetId}`));
    if (missingRef) {
      throw new AssetUsageValidationError(
        `Missing or deleted account asset reference at ${missingRef.configPath}: account_id=${missingRef.accountId}, asset_id=${missingRef.assetId}`,
      );
    }
  }

  return refs;
}

export async function validateAccountAssetUsageForInstance(args: {
  env: Env;
  accountId: string;
  publicId: string;
  config: Record<string, unknown>;
}): Promise<{ count: number }> {
  const refs = await resolveValidatedAccountAssetUsageRefs(args);
  return { count: refs.length };
}

export async function syncAccountAssetUsageForInstance(args: {
  env: Env;
  accountId: string;
  publicId: string;
  config: Record<string, unknown>;
}): Promise<{ count: number }> {
  const refs = await resolveValidatedAccountAssetUsageRefs(args);
  const accountId = String(args.accountId || '').trim();
  const publicId = String(args.publicId || '').trim();

  const rpcRows = refs.map((ref) => ({
    asset_id: ref.assetId,
    config_path: ref.configPath,
  }));
  const syncRes = await supabaseFetch(args.env, '/rest/v1/rpc/sync_account_asset_usage', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      p_account_id: accountId,
      p_public_id: publicId,
      p_refs: rpcRows,
    }),
  });
  if (!syncRes.ok) {
    const details = await readJson(syncRes);
    throw new Error(
      `[ParisWorker] Failed to sync account asset usage atomically (${syncRes.status}): ${JSON.stringify(details)}`,
    );
  }

  const payload = (await readJson(syncRes)) as
    | SyncAccountAssetUsageRpcRow
    | SyncAccountAssetUsageRpcRow[]
    | number
    | null;
  const first =
    Array.isArray(payload) && payload.length > 0 && payload[0] && typeof payload[0] === 'object'
      ? payload[0]
      : null;
  const rawCount =
    (first?.count ?? first?.sync_account_asset_usage) ??
    (payload && typeof payload === 'object' && !Array.isArray(payload)
      ? ((payload as SyncAccountAssetUsageRpcRow).count ??
          (payload as SyncAccountAssetUsageRpcRow).sync_account_asset_usage)
      : null) ??
    (typeof payload === 'number' ? payload : null);
  if (typeof rawCount === 'number' && Number.isFinite(rawCount) && rawCount >= 0) {
    return { count: Math.trunc(rawCount) };
  }

  return { count: refs.length };
}
