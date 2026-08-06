import { parseAccountAssetKey, toAccountAssetPublicPath } from '@clickeen/ck-contracts';
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

export const CLICKEEN_ASSET_ACCOUNT_ID = 'CLICKEEN';

export type CatalogAssetCopyMapping = {
  sourceAssetRef: string;
  destinationAssetRef: string;
};

export class CatalogAssetCopyError extends Error {
  readonly reasonKey: string;
  readonly completedMappings: CatalogAssetCopyMapping[];

  constructor(args: {
    reasonKey: string;
    detail: string;
    completedMappings?: CatalogAssetCopyMapping[];
  }) {
    super(args.detail);
    this.name = 'CatalogAssetCopyError';
    this.reasonKey = args.reasonKey;
    this.completedMappings = args.completedMappings ?? [];
  }
}

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

export class AccountAssetMetadataError extends Error {
  readonly reasonKey = 'tokyo.errors.assets.metadataInvalid';
  readonly accountId: string;
  readonly assetRef: string;
  readonly key: string;

  constructor(args: { accountId: string; assetRef: string }) {
    super('tokyo.errors.assets.metadataInvalid');
    this.name = 'AccountAssetMetadataError';
    this.accountId = args.accountId;
    this.assetRef = args.assetRef;
    this.key = accountAssetKey(args.accountId, args.assetRef);
  }
}

export class AccountAssetKeyError extends Error {
  readonly reasonKey = 'tokyo.errors.assets.keyInvalid';
  readonly key: string;

  constructor(key: string) {
    super('tokyo.errors.assets.keyInvalid');
    this.name = 'AccountAssetKeyError';
    this.key = key;
  }
}

export function sumAccountAssetFileSizeBytes(files: AccountAssetFile[]): number {
  return files.reduce((total, file) => total + file.sizeBytes, 0);
}

function isStoredAssetMetadataString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function accountAssetKey(accountId: string, assetRef: string): string {
  return `accounts/${accountId}/assets/${assetRef}`;
}

function publicAccountAssetRef(accountId: string, assetRef: string): string {
  const path = toAccountAssetPublicPath(accountAssetKey(accountId, assetRef));
  if (!path) throw new AccountAssetKeyError(accountAssetKey(accountId, assetRef));
  return path;
}

function collisionSafeAssetRef(filename: string, unavailable: Set<string>): string {
  if (!unavailable.has(filename)) return filename;
  const dot = filename.lastIndexOf('.');
  const hasExtension = dot > 0 && dot < filename.length - 1;
  const stem = hasExtension ? filename.slice(0, dot) : filename;
  const extension = hasExtension ? filename.slice(dot) : '';
  for (let index = 2; index < 100_000; index += 1) {
    const suffix = `-${index}`;
    const candidate = `${stem.slice(0, 180 - extension.length - suffix.length)}${suffix}${extension}`;
    if (!unavailable.has(candidate)) return candidate;
  }
  throw new CatalogAssetCopyError({
    reasonKey: 'tokyo.errors.assets.copyFailed',
    detail: `destination_filename_unavailable:${filename}`,
  });
}

function accountAssetPrefix(accountId: string): string {
  return `accounts/${accountId}/assets/`;
}

export function directAccountAssetRefFromKey(accountId: string, key: string): string | null {
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
    throw new AccountAssetMetadataError({ accountId: args.accountId, assetRef: args.assetRef });
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
  if (directAccountAssetRefFromKey(accountId, key) !== assetRef) {
    throw new AccountAssetKeyError(key);
  }
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
      const assetRef = key ? directAccountAssetRefFromKey(accountId, key) : null;
      if (!assetRef) throw new AccountAssetKeyError(key);
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
  const key = accountAssetKey(accountId, assetRef);
  if (directAccountAssetRefFromKey(accountId, key) !== assetRef) {
    throw new AccountAssetKeyError(key);
  }
  await env.TOKYO_R2.delete(key);
}

export async function copyClickeenCatalogAssets(args: {
  env: Env;
  destinationAccountId: string;
  sourceAssetRefs: string[];
  uploadSizeLimit: number | null;
  storageLimit: number | null;
}): Promise<CatalogAssetCopyMapping[]> {
  const destinationFiles = await listAccountAssetFilesByAccount(args.env, args.destinationAccountId);
  const unavailable = new Set(destinationFiles.map((file) => file.assetRef));
  const prepared: Array<{
    source: AccountAssetFile;
    destinationAssetRef: string;
    bytes: ArrayBuffer;
  }> = [];

  for (const sourceAssetRef of args.sourceAssetRefs) {
    const source = await loadAccountAssetByRef(args.env, CLICKEEN_ASSET_ACCOUNT_ID, sourceAssetRef);
    if (!source) {
      throw new CatalogAssetCopyError({
        reasonKey: 'coreui.errors.asset.notFound',
        detail: publicAccountAssetRef(CLICKEEN_ASSET_ACCOUNT_ID, sourceAssetRef),
      });
    }
    const sourceObject = await args.env.TOKYO_R2.get(source.key);
    if (!sourceObject) {
      throw new CatalogAssetCopyError({
        reasonKey: 'coreui.errors.asset.notFound',
        detail: publicAccountAssetRef(CLICKEEN_ASSET_ACCOUNT_ID, sourceAssetRef),
      });
    }
    const bytes = await sourceObject.arrayBuffer();
    if (bytes.byteLength !== source.sizeBytes) {
      throw new CatalogAssetCopyError({
        reasonKey: 'tokyo.errors.assets.metadataInvalid',
        detail: source.key,
      });
    }
    if (args.uploadSizeLimit !== null && bytes.byteLength > args.uploadSizeLimit) {
      throw new CatalogAssetCopyError({
        reasonKey: 'coreui.upsell.reason.limitReached',
        detail: 'uploads.size.max',
      });
    }
    const destinationAssetRef = collisionSafeAssetRef(source.normalizedFilename, unavailable);
    unavailable.add(destinationAssetRef);
    prepared.push({ source, destinationAssetRef, bytes });
  }

  if (
    args.storageLimit !== null &&
    sumAccountAssetFileSizeBytes(destinationFiles) + prepared.reduce((total, item) => total + item.bytes.byteLength, 0) > args.storageLimit
  ) {
    throw new CatalogAssetCopyError({
      reasonKey: 'coreui.upsell.reason.limitReached',
      detail: 'storage.bytes.max',
    });
  }

  const completedMappings: CatalogAssetCopyMapping[] = [];
  for (const item of prepared) {
    const destinationKey = accountAssetKey(args.destinationAccountId, item.destinationAssetRef);
    try {
      const stored = await args.env.TOKYO_R2.put(destinationKey, item.bytes, {
        httpMetadata: { contentType: item.source.contentType },
        customMetadata: {
          filename: item.destinationAssetRef,
          originalFilename: item.source.originalFilename,
          source: 'promotion',
          createdAt: new Date().toISOString(),
          sizeBytes: String(item.bytes.byteLength),
        },
        onlyIf: { etagDoesNotMatch: '*' },
      });
      if (!stored) throw new Error(`destination_exists:${destinationKey}`);
    } catch (error) {
      throw new CatalogAssetCopyError({
        reasonKey: 'tokyo.errors.assets.copyFailed',
        detail: error instanceof Error ? error.message : String(error),
        completedMappings,
      });
    }
    completedMappings.push({
      sourceAssetRef: item.source.assetRef,
      destinationAssetRef: item.destinationAssetRef,
    });
  }
  return completedMappings;
}
