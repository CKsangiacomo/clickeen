import type { Env } from './types';
import { readJson } from './http';
import { supabaseFetch } from './supabase';
import { isUuid } from './validation';

type AccountAssetRef = {
  accountId: string;
  assetId: string;
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
  const value = String(raw || '').trim();
  if (!value) return null;

  let pathname = '';
  if (/^https?:\/\//i.test(value)) {
    try {
      pathname = new URL(value).pathname;
    } catch {
      return null;
    }
  } else if (value.startsWith('/')) {
    pathname = value;
  } else {
    return null;
  }

  const match = pathname.match(/^\/arsenale\/o\/([^/]+)\/([^/]+)\/(?:[^/]+\/)?[^/]+$/);
  if (!match) return null;
  const accountId = decodeURIComponent(match[1] || '').trim();
  const assetId = decodeURIComponent(match[2] || '').trim();
  if (!isUuid(accountId) || !isUuid(assetId)) return null;
  return { accountId, assetId };
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

export async function syncAccountAssetUsageForInstance(args: {
  env: Env;
  accountId: string;
  publicId: string;
  config: Record<string, unknown>;
}): Promise<{ count: number }> {
  const accountId = String(args.accountId || '').trim();
  const publicId = String(args.publicId || '').trim();
  if (!isUuid(accountId)) {
    throw new AssetUsageValidationError(`Invalid accountId: ${accountId || '<empty>'}`);
  }
  if (!publicId) {
    throw new AssetUsageValidationError('Invalid publicId: <empty>');
  }

  const refs = extractAccountAssetUsageRefs(args.config, publicId);
  const crossAccount = refs.find((row) => row.accountId !== accountId);
  if (crossAccount) {
    throw new AssetUsageValidationError(
      `Cross-account asset reference at ${crossAccount.configPath}: asset account=${crossAccount.accountId}, instance account=${accountId}`,
    );
  }

  if (refs.length > 0) {
    const uniqueAssetIds = Array.from(new Set(refs.map((row) => row.assetId))).filter(Boolean);
    const existingParams = new URLSearchParams({
      select: 'asset_id',
      account_id: `eq.${accountId}`,
      asset_id: `in.(${uniqueAssetIds.join(',')})`,
      limit: String(Math.max(uniqueAssetIds.length, 1)),
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
    const existingRows = (await existingRes.json().catch(() => null)) as Array<{ asset_id?: string }> | null;
    const existingAssetIds = new Set(
      Array.isArray(existingRows)
        ? existingRows
            .map((row) => (typeof row?.asset_id === 'string' ? row.asset_id.trim() : ''))
            .filter((value): value is string => Boolean(value))
        : [],
    );
    const missingRef = refs.find((row) => !existingAssetIds.has(row.assetId));
    if (missingRef) {
      throw new AssetUsageValidationError(
        `Missing account asset reference at ${missingRef.configPath}: asset_id=${missingRef.assetId}`,
      );
    }
  }

  const deleteParams = new URLSearchParams({
    account_id: `eq.${accountId}`,
    public_id: `eq.${publicId}`,
  });
  const deleteRes = await supabaseFetch(
    args.env,
    `/rest/v1/account_asset_usage?${deleteParams.toString()}`,
    { method: 'DELETE' },
  );
  if (!deleteRes.ok) {
    const details = await readJson(deleteRes);
    throw new Error(
      `[ParisWorker] Failed to delete existing asset usage (${deleteRes.status}): ${JSON.stringify(details)}`,
    );
  }

  if (refs.length === 0) return { count: 0 };

  const insertRows = refs.map((row) => ({
    account_id: row.accountId,
    asset_id: row.assetId,
    public_id: row.publicId,
    config_path: row.configPath,
  }));
  const insertRes = await supabaseFetch(
    args.env,
    '/rest/v1/account_asset_usage?on_conflict=account_id,asset_id,public_id,config_path',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(insertRows),
    },
  );
  if (!insertRes.ok) {
    const details = await readJson(insertRes);
    throw new Error(
      `[ParisWorker] Failed to upsert asset usage (${insertRes.status}): ${JSON.stringify(details)}`,
    );
  }

  return { count: refs.length };
}
