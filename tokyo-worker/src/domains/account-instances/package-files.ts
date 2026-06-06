import type { Env } from '../../types';
import { isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import { loadJson, putJson } from '../storage';
import {
  PUBLIC_INDEX_FILE,
  PUBLIC_RUNTIME_FILE,
  PUBLIC_STYLES_FILE,
} from './package-file-names';

export { isPublicPackageFile } from './package-file-names';

type R2TextObject = {
  text(): Promise<string>;
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
  dependencies: {
    instanceIds: string[];
  };
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

const FORBIDDEN_VISITOR_PATTERNS = [
  /\/api\/account\//i,
  /\/__internal\//i,
  /fetch\([^)]*instance\.json/i,
  /fetch\([^)]*\/overlays\//i,
  /product\/widgets\//i,
  /src=["'][^"']*widget\.client\.js/i,
  /href=["'][^"']*widget\.css/i,
];

function instanceRoot(accountId: string, instanceId: string): string {
  return `accounts/${accountId}/instances/${instanceId}`;
}

function packageMetadataKey(accountId: string, instanceId: string): string {
  return `${instanceRoot(accountId, instanceId)}/package.json`;
}

function textContentType(name: string): string {
  if (name.endsWith('.css')) return 'text/css; charset=utf-8';
  if (name.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'text/html; charset=utf-8';
}

function assertVisitorSafe(files: PublicPackageFilePayload[]): void {
  for (const file of files) {
    const hit = FORBIDDEN_VISITOR_PATTERNS.find((pattern) => pattern.test(file.body));
    if (hit) throw new Error(`artifact.generated.forbidden:${file.name}:${hit}`);
  }
}

function assertNonEmptyPackageFile(file: PublicPackageFilePayload): void {
  if (!file.body.trim()) throw new Error(`artifact.package.empty:${file.name}`);
}

function assertIndexPackageShape(args: {
  html: string;
  instanceId: string;
}): void {
  if (!/<!doctype html>/i.test(args.html)) throw new Error('artifact.package.index.doctype_missing');
  if (!/<html\b/i.test(args.html) || !/<body\b/i.test(args.html)) throw new Error('artifact.package.index.invalid');
  if (!args.html.includes(`data-ck-instance-id="${args.instanceId}"`)) {
    throw new Error('artifact.package.index.instance_missing');
  }
  if (!/href=["']\.\/styles\.css["']/i.test(args.html)) throw new Error('artifact.package.index.styles_missing');
  if (!/src=["']\.\/runtime\.js["']/i.test(args.html)) throw new Error('artifact.package.index.runtime_missing');
}

function filesFromSubmittedPackage(pkg: SubmittedInstancePublicPackage): PublicPackageFilePayload[] {
  return [
    { name: PUBLIC_INDEX_FILE, body: pkg.indexHtml, contentType: textContentType(PUBLIC_INDEX_FILE) },
    { name: PUBLIC_STYLES_FILE, body: pkg.stylesCss, contentType: textContentType(PUBLIC_STYLES_FILE) },
    { name: PUBLIC_RUNTIME_FILE, body: pkg.runtimeJs, contentType: textContentType(PUBLIC_RUNTIME_FILE) },
  ];
}

function normalizeDependencyInstanceIds(value: unknown): string[] | null {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  const ids = new Set<string>();
  for (const entry of value) {
    const instanceId = typeof entry === 'string' ? entry.trim().toUpperCase() : '';
    if (!isCompactInstanceId(instanceId)) return null;
    ids.add(instanceId);
  }
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function normalizeSubmittedPackageDependencies(value: unknown): SubmittedInstancePublicPackage['dependencies'] | null {
  if (value == null) return { instanceIds: [] };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const instanceIds = normalizeDependencyInstanceIds(raw.instanceIds);
  if (!instanceIds) return null;
  return { instanceIds };
}

function normalizeSubmittedPackage(value: unknown): SubmittedInstancePublicPackage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1) return null;
  if (typeof raw.indexHtml !== 'string' || typeof raw.stylesCss !== 'string' || typeof raw.runtimeJs !== 'string') return null;
  const dependencies = normalizeSubmittedPackageDependencies(raw.dependencies);
  if (!dependencies) return null;
  return {
    v: 1,
    indexHtml: raw.indexHtml,
    stylesCss: raw.stylesCss,
    runtimeJs: raw.runtimeJs,
    dependencies,
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
  const metadata = await loadJson<{ dependencies?: unknown }>(args.env, packageMetadataKey(args.accountId, args.instanceId));
  const dependencies = normalizeSubmittedPackageDependencies(metadata?.dependencies);
  if (!dependencies) throw new Error('artifact.package.dependencies_invalid');
  const publicPackage: SubmittedInstancePublicPackage = {
    v: 1 as const,
    indexHtml: await indexObject.text(),
    stylesCss: await stylesObject.text(),
    runtimeJs: await runtimeObject.text(),
    dependencies,
  };
  const files = filesFromSubmittedPackage(publicPackage);
  files.forEach(assertNonEmptyPackageFile);
  assertIndexPackageShape({ html: publicPackage.indexHtml, instanceId: args.instanceId });
  assertVisitorSafe(files);
  return publicPackage;
}

export async function writeInstancePublicPackage(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  publicPackage: SubmittedInstancePublicPackage;
}): Promise<WriteInstancePublicPackageResult> {
  try {
    const files = filesFromSubmittedPackage(args.publicPackage);
    files.forEach(assertNonEmptyPackageFile);
    assertIndexPackageShape({ html: args.publicPackage.indexHtml, instanceId: args.instanceId });
    assertVisitorSafe(files);

    const root = instanceRoot(args.accountId, args.instanceId);
    for (const file of files) {
      await args.env.TOKYO_R2.put(`${root}/${file.name}`, file.body, {
        httpMetadata: { contentType: file.contentType },
      });
    }
    await putJson(args.env, packageMetadataKey(args.accountId, args.instanceId), {
      v: 1,
      dependencies: args.publicPackage.dependencies,
    });

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

async function readRequiredText(args: {
  env: Env;
  key: string;
  reasonKey: string;
}): Promise<string> {
  const object = await args.env.TOKYO_R2.get(args.key) as R2TextObject | null;
  if (!object) throw new Error(`${args.reasonKey}:${args.key}`);
  return object.text();
}

export async function verifyInstancePublicPackageReady(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<InstancePublicPackageReadinessResult> {
  try {
    const root = instanceRoot(args.accountId, args.instanceId);
    const [indexHtml, stylesCss, runtimeJs] = await Promise.all([
      readRequiredText({ env: args.env, key: `${root}/${PUBLIC_INDEX_FILE}`, reasonKey: 'artifact.package.index_missing' }),
      readRequiredText({ env: args.env, key: `${root}/${PUBLIC_STYLES_FILE}`, reasonKey: 'artifact.package.styles_missing' }),
      readRequiredText({ env: args.env, key: `${root}/${PUBLIC_RUNTIME_FILE}`, reasonKey: 'artifact.package.runtime_missing' }),
    ]);
    assertIndexPackageShape({ html: indexHtml, instanceId: args.instanceId });
    assertVisitorSafe([
      { name: PUBLIC_INDEX_FILE, body: indexHtml, contentType: textContentType(PUBLIC_INDEX_FILE) },
      { name: PUBLIC_STYLES_FILE, body: stylesCss, contentType: textContentType(PUBLIC_STYLES_FILE) },
      { name: PUBLIC_RUNTIME_FILE, body: runtimeJs, contentType: textContentType(PUBLIC_RUNTIME_FILE) },
    ]);
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reasonKey: detail.startsWith('artifact.') ? detail : 'artifact.package_not_ready',
      detail,
    };
  }
}
