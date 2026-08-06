import type { Env } from '../../types';
import {
  PUBLIC_INDEX_FILE,
  PUBLIC_RUNTIME_FILE,
  PUBLIC_STYLES_FILE,
  type PublicPackageFile,
} from './package-file-names';
import { publicPackageContentType } from '../public-package-serve-metadata';

export { isPublicPackageFile } from './package-file-names';

type R2TextObject = {
  body: ReadableStream | null;
  text(): Promise<string>;
  httpMetadata?: { contentType?: string | null } | null;
};

type PublicPackageFilePayload = {
  name: PublicPackageFile;
  body: string;
  contentType: string;
};

export type SubmittedInstancePublicPackage = {
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
  if (typeof raw.indexHtml !== 'string' || typeof raw.stylesCss !== 'string' || typeof raw.runtimeJs !== 'string') return null;
  return {
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
    indexHtml: await indexObject.text(),
    stylesCss: await stylesObject.text(),
    runtimeJs: await runtimeObject.text(),
  };
}

async function putInstancePublicPackageFiles(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  publicPackage: SubmittedInstancePublicPackage;
}): Promise<void> {
  const root = instanceRoot(args.accountId, args.instanceId);
  const writes = await Promise.allSettled(
    filesFromSubmittedPackage(args.publicPackage).map((file) =>
      args.env.TOKYO_R2.put(`${root}/${file.name}`, file.body, {
        httpMetadata: { contentType: file.contentType },
      }),
    ),
  );
  const failed = writes.find((write): write is PromiseRejectedResult => write.status === 'rejected');
  if (failed) throw failed.reason;
}

export async function writeInstancePublicPackage(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  publicPackage: SubmittedInstancePublicPackage;
}): Promise<WriteInstancePublicPackageResult> {
  try {
    await putInstancePublicPackageFiles(args);
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
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
    const result = await requireStoredPackageFile({
      env: args.env,
      key: `${root}/${file[0]}`,
      reasonKey: file[1],
    });
    if (!result.ok) return result;
  }
  return { ok: true };
}
