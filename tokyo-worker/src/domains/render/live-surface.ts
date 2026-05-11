import type { Env } from '../../types';
import {
  accountInstancePublishKey,
  publishedWidgetLookupKey,
} from './keys';
import { rebuildAccountInstanceIndexes, resolveAccountInstanceLocation } from './instance-index';
import { normalizeLocalePolicy, normalizePublishDocument } from './normalize';
import { deletePrefix, loadJson, putJson } from './storage';
import type {
  EnforceLiveSurfaceJob,
  LiveRenderPointer,
  PublishDocument,
  PublishedWidgetLookupDocument,
  SyncLiveSurfaceJob,
} from './types';
import { normalizeFingerprint, normalizeStorageId } from './utils';

async function restorePublishDocument(
  env: Env,
  publishKey: string,
  previous: PublishDocument | null,
  fallback: PublishDocument,
): Promise<void> {
  await putJson(env, publishKey, previous ?? fallback);
}

export async function syncLiveSurface(env: Env, job: SyncLiveSurfaceJob): Promise<void> {
  const instanceId = normalizeStorageId(job.instanceId);
  const accountId = normalizeStorageId(job.accountId);
  if (!instanceId) throw new Error('[tokyo] sync-live-surface missing instanceId');
  if (!accountId) throw new Error('[tokyo] sync-live-surface missing accountId');

  const location = await resolveAccountInstanceLocation({
    env,
    accountId,
    instanceId,
    widgetType: job.widgetType,
  });
  if (!location) throw new Error('[tokyo] sync-live-surface missing instance location');

  const publishKey = accountInstancePublishKey(location.accountId, location.widgetType, location.instanceId);
  const previousPublish = normalizePublishDocument(await loadJson(env, publishKey));
  if (!job.live) {
    const unpublished = {
      v: 1,
      id: location.instanceId,
      accountId: location.accountId,
      widgetType: location.widgetType,
      status: 'unpublished',
      configFp: null,
      updatedAt: new Date().toISOString(),
    } satisfies PublishDocument;
    await putJson(env, publishKey, unpublished);
    try {
      await env.TOKYO_R2.delete(publishedWidgetLookupKey(location.instanceId));
    } catch (error) {
      await restorePublishDocument(env, publishKey, previousPublish, unpublished);
      throw error;
    }
    await rebuildAccountInstanceIndexes(env, accountId);
    return;
  }

  const configFp = normalizeFingerprint(job.configFp);
  if (!configFp) throw new Error('[tokyo] sync-live-surface invalid configFp');
  const localePolicy = normalizeLocalePolicy(job.localePolicy);
  if (!localePolicy) throw new Error('[tokyo] sync-live-surface invalid localePolicy');
  const updatedAt = new Date().toISOString();
  const published = {
    v: 1,
    id: location.instanceId,
    accountId: location.accountId,
    widgetType: location.widgetType,
    status: 'published',
    configFp,
    localePolicy,
    seoGeo: job.seoGeo === true,
    updatedAt,
  } satisfies PublishDocument;
  await putJson(env, publishKey, published);
  try {
    await putJson(env, publishedWidgetLookupKey(location.instanceId), {
      v: 1,
      id: location.instanceId,
      accountId: location.accountId,
      widgetType: location.widgetType,
      status: 'published',
      updatedAt,
    } satisfies PublishedWidgetLookupDocument);
  } catch (error) {
    await restorePublishDocument(env, publishKey, previousPublish, {
      v: 1,
      id: location.instanceId,
      accountId: location.accountId,
      widgetType: location.widgetType,
      status: 'unpublished',
      configFp: null,
      updatedAt,
    });
    throw error;
  }
  await rebuildAccountInstanceIndexes(env, accountId);
}

export async function enforceLiveSurface(env: Env, job: EnforceLiveSurfaceJob): Promise<void> {
  const instanceId = normalizeStorageId(job.instanceId);
  const accountId = normalizeStorageId(job.accountId);
  if (!instanceId) throw new Error('[tokyo] enforce-live-surface missing instanceId');
  if (!accountId) throw new Error('[tokyo] enforce-live-surface missing accountId');
  const location = await resolveAccountInstanceLocation({ env, accountId, instanceId });
  if (!location) return;
  const existing = normalizePublishDocument(
    await loadJson(env, accountInstancePublishKey(location.accountId, location.widgetType, location.instanceId)),
  );
  if (!existing || existing.status !== 'published' || !existing.configFp || !existing.localePolicy) return;
  await syncLiveSurface(env, {
    v: 1,
    kind: 'sync-live-surface',
    instanceId,
    accountId,
    live: true,
    widgetType: location.widgetType,
    configFp: existing.configFp,
    localePolicy: job.localePolicy,
    seoGeo: job.seoGeo,
  });
}

export async function deleteInstanceMirror(env: Env, instanceId: string, accountId: string): Promise<void> {
  const normalized = normalizeStorageId(instanceId);
  const normalizedAccount = normalizeStorageId(accountId);
  if (!normalized) throw new Error('[tokyo] delete-instance-mirror missing instanceId');
  if (!normalizedAccount) throw new Error('[tokyo] delete-instance-mirror missing accountId');
  const location = await resolveAccountInstanceLocation({ env, accountId: normalizedAccount, instanceId: normalized });
  if (location) {
    await deletePrefix(env, `accounts/${location.accountId}/widgets/${location.widgetType}/${location.instanceId}/`);
  }
  await env.TOKYO_R2.delete(publishedWidgetLookupKey(normalized));
  await rebuildAccountInstanceIndexes(env, normalizedAccount);
}

export function buildLiveRenderPointer(args: {
  id: string;
  widgetType: string;
  publish: PublishDocument;
}): LiveRenderPointer | null {
  if (args.publish.status !== 'published' || !args.publish.configFp || !args.publish.localePolicy) return null;
  return {
    v: 1,
    id: args.id,
    widgetType: args.widgetType,
    configFp: args.publish.configFp,
    localePolicy: args.publish.localePolicy,
    ...(args.publish.seoGeo
      ? {
          seoGeo: {
            metaLiveBase: `seo/meta/live`,
            metaPacksBase: `seo/meta`,
          },
        }
      : {}),
  };
}
