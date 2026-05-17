import { normalizeAccountAssetRef } from '@clickeen/ck-contracts';
import {
  classifyAccountAssetType,
  type AccountAssetType,
  guessContentTypeFromExt,
} from '../asset-utils';
import type { Env } from '../types';

function normalizeNonNegativeInt(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.floor(value));
}

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

export function normalizeAccountAssetSource(raw: string | null): AccountAssetSource | null {
  const value = String(raw || '').trim();
  if (!value) return 'api';
  if (value === 'bob.publish' || value === 'bob.export' || value === 'devstudio' || value === 'promotion' || value === 'api') {
    return value;
  }
  return null;
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
  return files.reduce((total, file) => total + normalizeNonNegativeInt(file.sizeBytes), 0);
}

function filenameFromAssetRef(assetRef: string): string {
  return assetRef.split('/').pop() || assetRef;
}

function accountAssetKey(accountId: string, assetRef: string): string {
  return `accounts/${accountId}/assets/${assetRef.replace(/^\/+/, '')}`;
}

function accountAssetPrefix(accountId: string): string {
  return `accounts/${accountId}/assets/`;
}

function assetRefFromKey(accountId: string, key: string): string | null {
  const prefix = accountAssetPrefix(accountId);
  return key.startsWith(prefix) ? key.slice(prefix.length) || null : null;
}

function listedAccountAssetRefFromKey(accountId: string, key: string): string | null {
  const assetRef = assetRefFromKey(accountId, key);
  const normalized = normalizeAccountAssetRef(assetRef);
  if (!normalized || normalized !== assetRef) return null;

  const segments = normalized.split('/');
  const filename = segments[segments.length - 1]?.toLowerCase() || '';

  if (filename === 'manifest.json') return null;
  if (segments.includes('blob')) return null;

  // Current PRD 100 product surface writes accepted account assets as direct
  // account-owned files. Folder UX can evolve later as an explicit contract.
  if (segments.length !== 1) return null;

  return normalized;
}

function normalizeCustomMetadata(value: unknown): Record<string, string> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, entry]) => typeof entry === 'string')
          .map(([key, entry]) => [key, String(entry)]),
      )
    : {};
}

function fileFromObject(args: {
  accountId: string;
  assetRef: string;
  size?: number;
  uploaded?: Date | string;
  httpMetadata?: { contentType?: string | null } | null;
  customMetadata?: Record<string, string> | null;
}): AccountAssetFile {
  const custom = normalizeCustomMetadata(args.customMetadata);
  const normalizedFilename = custom.filename || filenameFromAssetRef(args.assetRef);
  const contentType = args.httpMetadata?.contentType || guessContentTypeFromExt(normalizedFilename.split('.').pop() || '');
  const assetType = classifyAccountAssetType(contentType, normalizedFilename.split('.').pop() || '');
  const uploaded = args.uploaded instanceof Date
    ? args.uploaded.toISOString()
    : typeof args.uploaded === 'string' && args.uploaded
      ? args.uploaded
      : new Date().toISOString();
  return {
    accountId: args.accountId,
    assetRef: args.assetRef,
    source: normalizeAccountAssetSource(custom.source ?? null) ?? 'api',
    originalFilename: custom.originalFilename || normalizedFilename,
    normalizedFilename,
    contentType,
    assetType,
    sizeBytes: normalizeNonNegativeInt(Number(args.size ?? custom.sizeBytes ?? 0)),
    createdAt: custom.createdAt || uploaded,
    updatedAt: uploaded,
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
      const key = typeof object.key === 'string' ? object.key.trim() : '';
      const assetRef = key ? listedAccountAssetRefFromKey(accountId, key) : null;
      if (!assetRef) continue;
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
