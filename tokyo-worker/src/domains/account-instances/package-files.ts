import type { Env } from '../../types';
import {
  PUBLIC_INDEX_FILE,
  PUBLIC_RUNTIME_FILE,
  PUBLIC_STYLES_FILE,
  type PublicPackageFile,
} from './package-file-names';

export { isPublicPackageFile } from './package-file-names';

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
