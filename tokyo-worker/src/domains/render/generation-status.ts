import type { Env } from '../../types';
import { accountInstanceDocumentKey } from './keys';
import { resolveAccountInstanceLocation } from './instance-index';
import { normalizeAccountInstanceDocument } from './normalize';
import { loadJson, putJson } from './storage';
import type {
  AccountInstanceDocument,
  InstanceGenerationLane,
  InstanceGenerationStatus,
} from './types';
import { normalizeStorageId } from './utils';

export type GenerationLaneName = 'translations' | 'embed';

const ALLOWED_TRANSITIONS: Record<InstanceGenerationStatus, ReadonlySet<InstanceGenerationStatus>> = {
  not_generated: new Set(['queued', 'building', 'unavailable']),
  queued: new Set(['building', 'failed', 'queued', 'unavailable']),
  building: new Set(['ready', 'failed', 'building', 'unavailable']),
  ready: new Set(['building', 'stale', 'queued', 'unavailable']),
  stale: new Set(['building', 'queued', 'unavailable']),
  failed: new Set(['building', 'queued', 'unavailable']),
  unavailable: new Set(['queued', 'unavailable']),
};

function assertAllowedTransition(current: InstanceGenerationStatus, next: InstanceGenerationStatus): void {
  if (!ALLOWED_TRANSITIONS[current]?.has(next)) {
    throw new Error(`tokyo.generation.invalid_transition:${current}->${next}`);
  }
}

function normalizeGenerationStatus(value: unknown): InstanceGenerationStatus | null {
  return value === 'not_generated' ||
    value === 'queued' ||
    value === 'building' ||
    value === 'ready' ||
    value === 'stale' ||
    value === 'failed' ||
    value === 'unavailable'
    ? value
    : null;
}

function buildLane(args: {
  current: InstanceGenerationLane;
  status: InstanceGenerationStatus;
  sourceVersion: number;
  now: string;
  error?: string | null;
}): InstanceGenerationLane {
  return {
    ...args.current,
    status: args.status,
    sourceVersion: args.sourceVersion,
    updatedAt: args.now,
    ...(args.status === 'queued' ? { requestedAt: args.now } : {}),
    ...(args.error ? { error: args.error } : {}),
  };
}

export async function updateInstanceGenerationStatus(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  sourceVersion: number;
  lane: GenerationLaneName;
  status: InstanceGenerationStatus;
  widgetType?: string | null;
  error?: string | null;
}): Promise<
  | { ok: true; stale: false; instance: AccountInstanceDocument }
  | { ok: true; stale: true; currentSourceVersion: number }
> {
  const accountId = normalizeStorageId(args.accountId);
  const instanceId = normalizeStorageId(args.instanceId);
  const status = normalizeGenerationStatus(args.status);
  if (!accountId || !instanceId || !status || !Number.isInteger(args.sourceVersion) || args.sourceVersion < 1) {
    throw new Error('tokyo.generation.invalid');
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) throw new Error('tokyo.generation.instance_not_found');

  const key = accountInstanceDocumentKey(location.accountId, location.widgetCode, location.instanceId);
  const instance = normalizeAccountInstanceDocument(await loadJson(args.env, key));
  if (!instance) throw new Error('tokyo.generation.instance_invalid');
  if (instance.sourceVersion !== args.sourceVersion) {
    return { ok: true, stale: true, currentSourceVersion: instance.sourceVersion };
  }

  const currentLane = instance.generation[args.lane];
  assertAllowedTransition(currentLane.status, status);
  const now = new Date().toISOString();
  const next = {
    ...instance,
    generation: {
      ...instance.generation,
      [args.lane]: buildLane({
        current: currentLane,
        status,
        sourceVersion: args.sourceVersion,
        now,
        error: args.error,
      }),
    },
    updatedAt: now,
  } satisfies AccountInstanceDocument;
  await putJson(args.env, key, next);
  return { ok: true, stale: false, instance: next };
}
