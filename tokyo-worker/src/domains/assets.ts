import { parseAccountAssetKey } from '@clickeen/ck-contracts';
import {
  classifyAccountAssetType,
  type AccountAssetType,
} from '../asset-utils';
import type { Env } from '../types';

export type MemberRole = 'viewer' | 'editor' | 'admin' | 'owner';

export function roleRank(role: MemberRole): number {
  switch (role) {
    case 'owner':
      return 4;
    case 'admin':
      return 3;
    case 'editor':
      return 2;
    case 'viewer':
      return 1;
    default:
      return 0;
  }
}

export type AccountAssetSource = 'bob.publish' | 'bob.export' | 'devstudio' | 'promotion' | 'api';

export function isAccountAssetSource(raw: unknown): raw is AccountAssetSource {
  return raw === 'bob.publish' || raw === 'bob.export' || raw === 'devstudio' || raw === 'promotion' || raw === 'api';
}

export type AccountAssetFile = {
  accountId: string;
  assetRef: string;
  source: AccountAssetSource;
  originalFilename: string;
  normalizedFilename: string;
  contentType: string;
  assetType: AccountAssetType;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  key: string;
};

export function sumAccountAssetFileSizeBytes(files: AccountAssetFile[]): number {
  return files.reduce((total, file) => total + file.sizeBytes, 0);
}

function isStoredAssetMetadataString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function accountAssetKey(accountId: string, assetRef: string): string {
  return `accounts/${accountId}/assets/${assetRef}`;
}

function accountAssetPrefix(accountId: string): string {
  return `accounts/${accountId}/assets/`;
}

function listedAccountAssetRefFromKey(accountId: string, key: string): string | null {
  const parsed = parseAccountAssetKey(key);
  if (!parsed || parsed.accountId !== accountId) return null;

  const segments = parsed.assetRef.split('/');
  const filename = segments[segments.length - 1]?.toLowerCase() || '';

  if (filename === 'manifest.json') return null;
  if (segments.includes('blob')) return null;

  // Current PRD 100 product surface writes accepted account assets as direct
  // account-owned files. Folder UX can evolve later as an explicit contract.
  if (segments.length !== 1) return null;

  return parsed.assetRef;
}

function fileFromObject(args: {
  accountId: string;
  assetRef: string;
  size: number;
  uploaded?: Date | string;
  httpMetadata?: { contentType?: string | null } | null;
  customMetadata?: Record<string, string> | null;
}): AccountAssetFile {
  const custom = args.customMetadata ?? {};
  const normalizedFilename = custom.filename;
  const contentType = args.httpMetadata?.contentType;
  const createdAt = custom.createdAt;
  const source = custom.source;
  const updatedAt = args.uploaded instanceof Date ? args.uploaded.toISOString() : args.uploaded;
  const sizeBytes = args.size;
  if (
    !isStoredAssetMetadataString(normalizedFilename) ||
    !isStoredAssetMetadataString(contentType) ||
    !isStoredAssetMetadataString(createdAt) ||
    !isAccountAssetSource(source) ||
    !isStoredAssetMetadataString(updatedAt) ||
    !Number.isInteger(sizeBytes) ||
    sizeBytes < 0
  ) {
    throw new Error('tokyo.errors.assets.metadataInvalid');
  }
  const assetType = classifyAccountAssetType(contentType, normalizedFilename.split('.').pop() || '');
  return {
    accountId: args.accountId,
    assetRef: args.assetRef,
    source,
    originalFilename: normalizedFilename,
    normalizedFilename,
    contentType,
    assetType,
    sizeBytes,
    createdAt,
    updatedAt,
    key: accountAssetKey(args.accountId, args.assetRef),
  };
}

export async function loadAccountAssetByRef(
  env: Env,
  accountId: string,
  assetRef: string,
): Promise<AccountAssetFile | null> {
  const key = accountAssetKey(accountId, assetRef);
  const obj = await env.TOKYO_R2.head(key);
  if (!obj) return null;
  return fileFromObject({
    accountId,
    assetRef,
    size: obj.size,
    uploaded: obj.uploaded,
    httpMetadata: obj.httpMetadata,
    customMetadata: obj.customMetadata,
  });
}

export async function listAccountAssetFilesByAccount(
  env: Env,
  accountId: string,
): Promise<AccountAssetFile[]> {
  const prefix = accountAssetPrefix(accountId);
  const files: AccountAssetFile[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.TOKYO_R2.list({
      prefix,
      cursor,
      limit: 1000,
      include: ['httpMetadata', 'customMetadata'],
    } as R2ListOptions & { include: ('httpMetadata' | 'customMetadata')[] });
    for (const object of listed.objects) {
      const key = typeof object.key === 'string' ? object.key : '';
      const assetRef = key ? listedAccountAssetRefFromKey(accountId, key) : null;
      if (!assetRef) throw new Error('tokyo.errors.assets.keyInvalid');
      files.push(fileFromObject({
        accountId,
        assetRef,
        size: object.size,
        uploaded: object.uploaded,
        httpMetadata: object.httpMetadata,
        customMetadata: object.customMetadata,
      }));
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return files;
}

export async function loadAccountStoredBytesUsage(env: Env, accountId: string): Promise<number> {
  return sumAccountAssetFileSizeBytes(await listAccountAssetFilesByAccount(env, accountId));
}

export async function deleteAccountAssetByRef(env: Env, accountId: string, assetRef: string): Promise<void> {
  await env.TOKYO_R2.delete(accountAssetKey(accountId, assetRef));
}
