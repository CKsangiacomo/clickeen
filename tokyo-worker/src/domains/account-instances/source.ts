import type { Env } from '../../types';
import { isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import {
  accountInstanceSourceKey,
  accountInstancesRoot,
} from './keys';
import { loadJson, putJson } from '../storage';
import type {
  AccountInstanceConfigDocument,
  AccountInstanceContentDocument,
  AccountInstanceDocument,
  AccountInstanceSourceStorageDocument,
  InstanceServeState,
  AccountInstanceSourceReadFailure,
  AccountInstanceSourceReadResult,
  AccountInstanceSourcePointer,
} from './types';
import {
  createInstanceServeState,
  readInstanceServeStateRecord,
} from './serve-state';

type InstanceServeStateSummary = {
  status: InstanceServeState;
  publishedAt: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function nextAccountInstanceTimestamp(...priorCoordinates: Array<string | null>): string {
  const priorTimes = priorCoordinates
    .filter((coordinate): coordinate is string => coordinate !== null)
    .map((coordinate) => new Date(coordinate).getTime() + 1);
  return new Date(Math.max(Date.now(), ...priorTimes)).toISOString();
}

export class AccountInstanceCoordinateError extends Error {
  detail: string;

  constructor(detail: string) {
    super('tokyo.errors.instance.malformedCoordinate');
    this.detail = detail;
  }
}

function toAccountInstanceSourcePointer(args: {
  configDoc: AccountInstanceConfigDocument;
  serveState: InstanceServeStateSummary;
  updatedAt: string;
}): AccountInstanceSourcePointer {
  const { configDoc } = args;
  return {
    id: configDoc.id,
    accountId: configDoc.accountId,
    widgetType: configDoc.widgetType,
    displayName: configDoc.displayName,
    baseLocale: configDoc.baseLocale,
    publishStatus: args.serveState.status,
    publishedAt: args.serveState.publishedAt,
    createdAt: configDoc.createdAt,
    updatedAt: args.updatedAt,
  };
}

export async function readConfigDocumentByLocation(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<AccountInstanceConfigDocument | null> {
  const source = await loadJson<AccountInstanceSourceStorageDocument>(
    args.env,
    accountInstanceSourceKey(args.accountId, args.instanceId),
  );
  if (!source) return null;
  return {
    id: source.id,
    accountId: source.accountId,
    widgetType: source.widgetType,
    displayName: source.displayName,
    config: source.config,
    baseLocale: source.baseLocale,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

async function readSourceStorageDocument(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<AccountInstanceSourceStorageDocument | null> {
  return loadJson<AccountInstanceSourceStorageDocument>(
    args.env,
    accountInstanceSourceKey(args.accountId, args.instanceId),
  );
}

export async function writeAccountInstanceSource(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType: string;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
  displayName: string | null;
  baseLocale: string;
  existing?: {
    createdAt: string;
    updatedAt: string;
    serveState: InstanceServeStateSummary;
  };
}): Promise<{ pointer: AccountInstanceSourcePointer }> {
  const { instanceId, accountId, widgetType } = args;

  const now = args.existing
    ? nextAccountInstanceTimestamp(
        args.existing.updatedAt,
        args.existing.serveState.publishedAt,
      )
    : nowIso();
  const sourceDoc: AccountInstanceSourceStorageDocument = {
    id: instanceId,
    accountId,
    widgetType,
    displayName: args.displayName,
    config: args.config,
    baseLocale: args.baseLocale,
    createdAt: args.existing?.createdAt ?? now,
    updatedAt: now,
    content: args.content,
  };
  if (!args.existing) {
    await createInstanceServeState({
      env: args.env,
      accountId,
      instanceId,
      now,
    });
  }
  await putJson(
    args.env,
    accountInstanceSourceKey(accountId, instanceId),
    sourceDoc,
  );
  return {
    pointer: toAccountInstanceSourcePointer({
      configDoc: sourceDoc,
      serveState: args.existing?.serveState ?? { status: 'unpublished', publishedAt: null },
      updatedAt: now,
    }),
  };
}

export async function readAccountInstanceSourcePointer(args: {
  env: Env;
  instanceId: string;
  accountId: string;
}): Promise<{ ok: true; value: AccountInstanceSourcePointer } | AccountInstanceSourceReadFailure> {
  const sourceDoc = await readSourceStorageDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!sourceDoc) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const serveState = await readInstanceServeStateRecord({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  return {
    ok: true,
    value: toAccountInstanceSourcePointer({
      configDoc: sourceDoc,
      serveState,
      updatedAt: sourceDoc.updatedAt,
    }),
  };
}

export async function readAccountInstanceDocument(args: {
  env: Env;
  instanceId: string;
  accountId: string;
}): Promise<{ ok: true; value: AccountInstanceDocument } | AccountInstanceSourceReadFailure> {
  const sourceDoc = await readSourceStorageDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!sourceDoc) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const serveState = await readInstanceServeStateRecord({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  return {
    ok: true,
    value: {
      id: sourceDoc.id,
      accountId: sourceDoc.accountId,
      widgetType: sourceDoc.widgetType,
      displayName: sourceDoc.displayName,
      config: sourceDoc.config,
      baseLocale: sourceDoc.baseLocale,
      publishStatus: serveState.status,
      publishedAt: serveState.publishedAt,
      createdAt: sourceDoc.createdAt,
      updatedAt: sourceDoc.updatedAt,
    },
  };
}

export async function readAccountInstanceContentDocument(args: {
  env: Env;
  instanceId: string;
  accountId: string;
}): Promise<
  { ok: true; value: AccountInstanceContentDocument } | AccountInstanceSourceReadFailure
> {
  const sourceDoc = await readSourceStorageDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!sourceDoc) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  return { ok: true, value: sourceDoc.content };
}

export async function listAccountInstanceIds(args: {
  env: Env;
  accountId: string;
}): Promise<string[]> {
  const accountId = args.accountId;
  const prefix = `${accountInstancesRoot(accountId)}/`;
  const instanceIds = new Set<string>();
  let cursor: string | undefined = undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({ prefix, cursor });
    for (const object of listed.objects) {
      const key = object.key;
      const rest = key.startsWith(prefix) ? key.slice(prefix.length) : '';
      const match = rest.match(/^([^/]+)\/instance\.source\.json$/);
      if (!match) continue;
      const instanceId = match[1];
      if (!isCompactInstanceId(instanceId)) {
        throw new AccountInstanceCoordinateError(`${prefix}${instanceId}`);
      }
      instanceIds.add(instanceId);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return [...instanceIds].sort();
}

export async function readAccountInstanceSourcePointers(args: {
  env: Env;
  accountId: string;
  instanceIds: readonly string[];
}): Promise<
  { ok: true; value: AccountInstanceSourcePointer[] } | AccountInstanceSourceReadFailure
> {
  const results = await Promise.all(
    args.instanceIds.map((instanceId) =>
      readAccountInstanceSourcePointer({
        env: args.env,
        accountId: args.accountId,
        instanceId,
      }),
    ),
  );
  const pointers: AccountInstanceSourcePointer[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    pointers.push(result.value);
  }
  pointers.sort((left, right) => {
    const updatedAtOrder = right.updatedAt.localeCompare(left.updatedAt);
    return updatedAtOrder || left.id.localeCompare(right.id);
  });
  return { ok: true, value: pointers };
}

export async function renameAccountInstanceDisplay(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  displayName: string;
}): Promise<{ instanceId: string; displayName: string; updatedAt: string }> {
  const sourceDoc = await readSourceStorageDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!sourceDoc) throw new Error('coreui.errors.instance.notFound');
  const serveState = await readInstanceServeStateRecord({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  const updatedAt = nextAccountInstanceTimestamp(sourceDoc.updatedAt, serveState.publishedAt);
  await putJson(
    args.env,
    accountInstanceSourceKey(args.accountId, args.instanceId),
    {
      id: sourceDoc.id,
      accountId: sourceDoc.accountId,
      widgetType: sourceDoc.widgetType,
      displayName: args.displayName,
      config: sourceDoc.config,
      baseLocale: sourceDoc.baseLocale,
      createdAt: sourceDoc.createdAt,
      updatedAt,
      content: {
        id: sourceDoc.content.id,
        accountId: sourceDoc.content.accountId,
        fields: sourceDoc.content.fields,
        updatedAt: sourceDoc.content.updatedAt,
      },
    } satisfies AccountInstanceSourceStorageDocument,
  );
  return { instanceId: args.instanceId, displayName: args.displayName, updatedAt };
}

export async function readAccountInstanceSource(args: {
  env: Env;
  instanceId: string;
  accountId: string;
}): Promise<AccountInstanceSourceReadResult> {
  const sourceDoc = await readSourceStorageDocument({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!sourceDoc) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const serveState = await readInstanceServeStateRecord({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  const pointer = toAccountInstanceSourcePointer({
    configDoc: sourceDoc,
    serveState,
    updatedAt: sourceDoc.updatedAt,
  });
  return {
    ok: true,
    value: { pointer, config: sourceDoc.config, content: sourceDoc.content },
  };
}
