import type { Env } from '../../types';
import {
  PUBLIC_INDEX_FILE,
  PUBLIC_RUNTIME_FILE,
  PUBLIC_STYLES_FILE,
} from './package-file-names';
import { publicPackageContentType } from '../public-package-serve-metadata';

export { isPublicPackageFile } from './package-file-names';

type R2TextObject = {
  text(): Promise<string>;
  httpMetadata?: { contentType?: string | null } | null;
};

type PublicPackageFile = typeof PUBLIC_INDEX_FILE | typeof PUBLIC_STYLES_FILE | typeof PUBLIC_RUNTIME_FILE;

type PublicPackageFilePayload = {
  name: PublicPackageFile;
  body: string;
  contentType: string;
};

export type SubmittedInstancePublicPackage = {
  v: 1;
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

export type WriteInstancePublicPackageResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reasonKey: string;
      detail: string;
    };

export type InstancePublicPackageReadinessResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reasonKey: string;
      detail: string;
    };

export type StoredInstancePublicPackageSnapshot =
  | {
      kind: 'complete';
      publicPackage: SubmittedInstancePublicPackage;
    }
  | {
      kind: 'missing';
    };

function instanceRoot(accountId: string, instanceId: string): string {
  return `accounts/${accountId}/instances/${instanceId}`;
}

function textContentType(name: string): string {
  if (name.endsWith('.css')) return 'text/css; charset=utf-8';
  if (name.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'text/html; charset=utf-8';
}

function filesFromSubmittedPackage(pkg: SubmittedInstancePublicPackage): PublicPackageFilePayload[] {
  return [
    { name: PUBLIC_INDEX_FILE, body: pkg.indexHtml, contentType: textContentType(PUBLIC_INDEX_FILE) },
    { name: PUBLIC_STYLES_FILE, body: pkg.stylesCss, contentType: textContentType(PUBLIC_STYLES_FILE) },
    { name: PUBLIC_RUNTIME_FILE, body: pkg.runtimeJs, contentType: textContentType(PUBLIC_RUNTIME_FILE) },
  ];
}

function normalizeSubmittedPackage(value: unknown): SubmittedInstancePublicPackage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1) return null;
  if (typeof raw.indexHtml !== 'string' || typeof raw.stylesCss !== 'string' || typeof raw.runtimeJs !== 'string') return null;
  return {
    v: 1,
    indexHtml: raw.indexHtml,
    stylesCss: raw.stylesCss,
    runtimeJs: raw.runtimeJs,
  };
}

export function readSubmittedInstancePublicPackage(value: unknown): SubmittedInstancePublicPackage | null {
  return normalizeSubmittedPackage(value);
}

export async function readInstancePublicPackage(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<SubmittedInstancePublicPackage | null> {
  const root = instanceRoot(args.accountId, args.instanceId);
  const [indexObject, stylesObject, runtimeObject] = await Promise.all([
    args.env.TOKYO_R2.get(`${root}/${PUBLIC_INDEX_FILE}`) as Promise<R2TextObject | null>,
    args.env.TOKYO_R2.get(`${root}/${PUBLIC_STYLES_FILE}`) as Promise<R2TextObject | null>,
    args.env.TOKYO_R2.get(`${root}/${PUBLIC_RUNTIME_FILE}`) as Promise<R2TextObject | null>,
  ]);
  if (!indexObject || !stylesObject || !runtimeObject) return null;
  for (const object of [indexObject, stylesObject, runtimeObject]) {
    if (!publicPackageContentType(object)) throw new Error('artifact.package.metadata_invalid');
  }
  return {
    v: 1 as const,
    indexHtml: await indexObject.text(),
    stylesCss: await stylesObject.text(),
    runtimeJs: await runtimeObject.text(),
  };
}

export async function readStoredInstancePublicPackageSnapshot(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<StoredInstancePublicPackageSnapshot> {
  const root = instanceRoot(args.accountId, args.instanceId);
  const entries = await Promise.all([
    args.env.TOKYO_R2.get(`${root}/${PUBLIC_INDEX_FILE}`) as Promise<R2TextObject | null>,
    args.env.TOKYO_R2.get(`${root}/${PUBLIC_STYLES_FILE}`) as Promise<R2TextObject | null>,
    args.env.TOKYO_R2.get(`${root}/${PUBLIC_RUNTIME_FILE}`) as Promise<R2TextObject | null>,
  ]);
  const presentCount = entries.filter(Boolean).length;
  if (presentCount === 0) return { kind: 'missing' };
  if (presentCount !== entries.length) throw new Error('artifact.package.snapshot_incomplete');
  const [indexObject, stylesObject, runtimeObject] = entries as [R2TextObject, R2TextObject, R2TextObject];
  for (const object of entries) {
    if (!object || !publicPackageContentType(object)) throw new Error('artifact.package.snapshot_metadata_invalid');
  }
  return {
    kind: 'complete',
    publicPackage: {
      v: 1 as const,
      indexHtml: await indexObject.text(),
      stylesCss: await stylesObject.text(),
      runtimeJs: await runtimeObject.text(),
    },
  };
}

async function putInstancePublicPackageFiles(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  publicPackage: SubmittedInstancePublicPackage;
}): Promise<void> {
  const root = instanceRoot(args.accountId, args.instanceId);
  for (const file of filesFromSubmittedPackage(args.publicPackage)) {
    await args.env.TOKYO_R2.put(`${root}/${file.name}`, file.body, {
      httpMetadata: { contentType: file.contentType },
    });
  }
}

async function deleteInstancePublicPackageFiles(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<void> {
  const root = instanceRoot(args.accountId, args.instanceId);
  await args.env.TOKYO_R2.delete([
    `${root}/${PUBLIC_INDEX_FILE}`,
    `${root}/${PUBLIC_STYLES_FILE}`,
    `${root}/${PUBLIC_RUNTIME_FILE}`,
  ]);
}

export async function restoreInstancePublicPackageSnapshot(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  snapshot: StoredInstancePublicPackageSnapshot;
}): Promise<void> {
  if (args.snapshot.kind === 'missing') {
    await deleteInstancePublicPackageFiles(args);
    return;
  }
  await putInstancePublicPackageFiles({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    publicPackage: args.snapshot.publicPackage,
  });
}

export async function writeInstancePublicPackage(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  publicPackage: SubmittedInstancePublicPackage;
}): Promise<WriteInstancePublicPackageResult> {
  let snapshot: StoredInstancePublicPackageSnapshot;
  try {
    snapshot = await readStoredInstancePublicPackageSnapshot(args);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reasonKey: detail.startsWith('artifact.') ? detail : 'artifact.package_snapshot_failed',
      detail,
    };
  }

  try {
    await putInstancePublicPackageFiles(args);
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    try {
      await restoreInstancePublicPackageSnapshot({ ...args, snapshot });
    } catch (restoreError) {
      return {
        ok: false,
        reasonKey: 'artifact.package_rollback_failed',
        detail: `${detail}; rollback:${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
      };
    }
    return {
      ok: false,
      reasonKey: detail.startsWith('artifact.') ? detail : 'artifact.package_write_failed',
      detail,
    };
  }
}

async function requireStoredPackageFile(args: {
  env: Env;
  key: string;
  reasonKey: string;
}): Promise<InstancePublicPackageReadinessResult> {
  const object = await args.env.TOKYO_R2.get(args.key) as R2TextObject | null;
  if (!object) return { ok: false, reasonKey: args.reasonKey, detail: args.key };
  if (!publicPackageContentType(object)) {
    return { ok: false, reasonKey: 'artifact.package.metadata_invalid', detail: args.key };
  }
  return { ok: true };
}

export async function verifyInstancePublicPackageReady(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<InstancePublicPackageReadinessResult> {
  const root = instanceRoot(args.accountId, args.instanceId);
  for (const file of [
    [PUBLIC_INDEX_FILE, 'artifact.package.index_missing'],
    [PUBLIC_STYLES_FILE, 'artifact.package.styles_missing'],
    [PUBLIC_RUNTIME_FILE, 'artifact.package.runtime_missing'],
  ] as const) {
    const result = await requireStoredPackageFile({ env: args.env, key: `${root}/${file[0]}`, reasonKey: file[1] });
    if (!result.ok) return result;
  }
  return { ok: true };
}
