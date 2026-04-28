import type { Env } from '../../types';
import type { TokyoMirrorQueueJob } from './types';

export function isTokyoMirrorJob(value: unknown): value is TokyoMirrorQueueJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const job = value as Record<string, unknown>;
  if (job.v !== 1) return false;
  if (typeof job.kind !== 'string') return false;
  if (!job.kind) return false;
  if (typeof job.publicId !== 'string') return false;
  if (typeof job.accountId !== 'string') return false;
  return (
    job.kind === 'write-config-pack' ||
    job.kind === 'write-text-pack' ||
    job.kind === 'write-meta-pack' ||
    job.kind === 'sync-live-surface' ||
    job.kind === 'enforce-live-surface' ||
    job.kind === 'delete-instance-mirror' ||
    job.kind === 'sync-instance-overlays'
  );
}

export async function enqueueTokyoMirrorJob(
  env: Env,
  job: TokyoMirrorQueueJob,
): Promise<void> {
  if (!env.RENDER_SNAPSHOT_QUEUE) {
    throw new Error('[tokyo] render snapshot queue missing');
  }
  await env.RENDER_SNAPSHOT_QUEUE.send(job);
}
