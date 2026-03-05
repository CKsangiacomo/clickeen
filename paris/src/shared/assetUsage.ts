import type { Env } from './types';
import { isUuid } from './validation';
import { parseCanonicalAssetRef, toCanonicalAssetVersionPath } from '@clickeen/ck-contracts';

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
  const parsedDirect = parseCanonicalAssetRef(raw);
  const parsedFromVersionId =
    !parsedDirect || parsedDirect.kind !== 'version'
      ? (() => {
          const path = toCanonicalAssetVersionPath(raw);
          if (!path) return null;
          const parsed = parseCanonicalAssetRef(path);
          return parsed && parsed.kind === 'version' ? parsed : null;
        })()
      : null;
  const parsed = parsedDirect && parsedDirect.kind === 'version' ? parsedDirect : parsedFromVersionId;
  if (!parsed || parsed.kind !== 'version') return null;
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
  void args.env;
  return { count: refs.length };
}
