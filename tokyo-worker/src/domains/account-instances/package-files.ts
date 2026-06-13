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

export type SubmittedInstancePublicPackage = {
  v: 1;
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
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
