import type { Env } from '../../types';
import { isCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import {
  accountInstanceConfigKey,
  accountInstanceContentKey,
  accountInstancesRoot,
} from './keys';
import { loadJson, loadJsonObject, putJson } from '../storage';
import type {
  AccountInstanceConfigDocument,
  AccountInstanceContentDocument,
  AccountInstanceDocument,
  InstanceServeState,
  AccountInstanceSourceReadFailure,
  AccountInstanceSourceReadResult,
  AccountInstanceSourcePointer,
} from './types';
import {
  createInstanceServeState,
  readInstanceServeStateRecord,
  type InstanceServeStateRecord,
} from './serve-state';

function nowIso(): string {
  return new Date().toISOString();
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
  serveState: InstanceServeStateRecord;
  updatedAt: string;
}): AccountInstanceSourcePointer {
  const { configDoc } = args;
  return {
    id: configDoc.id,
    accountId: configDoc.accountId,
    widgetCode: configDoc.widgetCode,
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
  widgetCode: string;
  instanceId: string;
}): Promise<AccountInstanceConfigDocument | null> {
  return loadJson<AccountInstanceConfigDocument>(
    args.env,
    accountInstanceConfigKey(args.accountId, args.widgetCode, args.instanceId),
  );
}

export async function readContentDocumentByLocation(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  configDoc?: AccountInstanceConfigDocument | null;
}): Promise<AccountInstanceContentDocument | null> {
  const configDoc = args.configDoc ?? null;
  const loaded = await loadJsonObject<AccountInstanceContentDocument>(
    args.env,
    accountInstanceContentKey(args.accountId, args.widgetCode, args.instanceId),
  );
  if (loaded) return loaded.value;
  if (configDoc) throw new Error('coreui.errors.instance.content.missing');
  return null;
}

export async function writeAccountInstanceSource(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetCode: string;
  widgetType: string;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
  displayName: string | null;
  baseLocale: string;
  existing?: {
    createdAt: string;
    serveState: InstanceServeStateRecord;
  };
}): Promise<{ pointer: AccountInstanceSourcePointer }> {
  const { instanceId, accountId, widgetCode, widgetType } = args;

  const now = nowIso();
  const configDoc: AccountInstanceConfigDocument = {
    id: instanceId,
    accountId,
    widgetCode,
    widgetType,
    displayName: args.displayName,
    config: args.config,
    baseLocale: args.baseLocale,
    createdAt: args.existing?.createdAt ?? now,
    updatedAt: now,
  };
  await putJson(
    args.env,
    accountInstanceContentKey(accountId, widgetCode, instanceId),
    args.content,
  );
  await putJson(args.env, accountInstanceConfigKey(accountId, widgetCode, instanceId), configDoc);
  if (!args.existing) {
    await createInstanceServeState({
      env: args.env,
      accountId,
      instanceId,
      widgetCode,
      now,
    });
  }
  return {
    pointer: toAccountInstanceSourcePointer({
      configDoc,
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
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: args.accountId,
    widgetCode: '',
    instanceId: args.instanceId,
  });
  if (!configDoc) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const serveState = await readInstanceServeStateRecord({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetCode: configDoc.widgetCode,
  });
  return {
    ok: true,
    value: toAccountInstanceSourcePointer({
      configDoc,
      serveState,
      updatedAt: configDoc.updatedAt,
    }),
  };
}

export async function readAccountInstanceDocument(args: {
  env: Env;
  instanceId: string;
  accountId: string;
}): Promise<{ ok: true; value: AccountInstanceDocument } | AccountInstanceSourceReadFailure> {
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: args.accountId,
    widgetCode: '',
    instanceId: args.instanceId,
  });
  if (!configDoc) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const serveState = await readInstanceServeStateRecord({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetCode: configDoc.widgetCode,
  });
  return {
    ok: true,
    value: {
      id: configDoc.id,
      accountId: configDoc.accountId,
      widgetCode: configDoc.widgetCode,
      widgetType: configDoc.widgetType,
      displayName: configDoc.displayName,
      config: configDoc.config,
      baseLocale: configDoc.baseLocale,
      publishStatus: serveState.status,
      publishedAt: serveState.publishedAt,
      createdAt: configDoc.createdAt,
      updatedAt: configDoc.updatedAt,
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
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: args.accountId,
    widgetCode: '',
    instanceId: args.instanceId,
  });
  if (!configDoc) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const contentDoc = await readContentDocumentByLocation({
    env: args.env,
    accountId: args.accountId,
    widgetCode: configDoc.widgetCode,
    instanceId: args.instanceId,
    configDoc,
  });
  return { ok: true, value: contentDoc! };
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
      const slashIndex = rest.indexOf('/');
      if (slashIndex <= 0) {
        throw new AccountInstanceCoordinateError(key || prefix);
      }
      const instanceId = rest.slice(0, slashIndex);
      if (!isCompactInstanceId(instanceId)) {
        throw new AccountInstanceCoordinateError(`${prefix}${instanceId}`);
      }
      instanceIds.add(instanceId);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return [...instanceIds].sort();
}

export async function renameAccountInstanceDisplay(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  displayName: string;
}): Promise<{ instanceId: string; displayName: string; updatedAt: string }> {
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: args.accountId,
    widgetCode: '',
    instanceId: args.instanceId,
  });
  if (!configDoc) throw new Error('coreui.errors.instance.notFound');
  const updatedAt = nowIso();
  await putJson(
    args.env,
    accountInstanceConfigKey(args.accountId, configDoc.widgetCode, args.instanceId),
    {
      ...configDoc,
      displayName: args.displayName,
      updatedAt,
    } satisfies AccountInstanceConfigDocument,
  );
  return { instanceId: args.instanceId, displayName: args.displayName, updatedAt };
}

export async function readAccountInstanceSource(args: {
  env: Env;
  instanceId: string;
  accountId: string;
}): Promise<AccountInstanceSourceReadResult> {
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: args.accountId,
    widgetCode: '',
    instanceId: args.instanceId,
  });
  if (!configDoc) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const serveState = await readInstanceServeStateRecord({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetCode: configDoc.widgetCode,
  });
  const pointer = toAccountInstanceSourcePointer({
    configDoc,
    serveState,
    updatedAt: configDoc.updatedAt,
  });
  const content = await readContentDocumentByLocation({
    env: args.env,
    accountId: pointer.accountId,
    widgetCode: pointer.widgetCode,
    instanceId: pointer.id,
    configDoc,
  });
  return {
    ok: true,
    value: { pointer, config: configDoc.config, content: content! },
  };
}
