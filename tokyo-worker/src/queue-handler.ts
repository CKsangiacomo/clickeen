import {
  deleteInstanceMirror,
  enforceLiveSurface,
  isTokyoMirrorJob,
  syncLiveSurface,
  writeConfigPack,
  writeMetaPack,
  writeTextPack,
} from './domains/render';
import type { Env } from './types';

function retryDelaySeconds(attempt: number, baseSeconds: number, capSeconds: number): number {
  return Math.min(capSeconds, baseSeconds * Math.max(1, attempt));
}

function shouldRetryMissingPrereqs(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('[tokyo] missing required');
}

export async function handleTokyoQueue(
  batch: MessageBatch<unknown>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    const body = msg.body;
    if (!isTokyoMirrorJob(body)) {
      msg.ack();
      continue;
    }

    try {
      switch (body.kind) {
        case 'write-config-pack':
          await writeConfigPack(env, body);
          break;
        case 'write-text-pack':
          await writeTextPack(env, body);
          break;
        case 'write-meta-pack':
          await writeMetaPack(env, body);
          break;
        case 'sync-live-surface':
          await syncLiveSurface(env, body);
          break;
        case 'enforce-live-surface':
          await enforceLiveSurface(env, body);
          break;
        case 'delete-instance-mirror':
          await deleteInstanceMirror(env, body.publicId);
          break;
      }
      msg.ack();
    } catch (error) {
      const attempt =
        typeof msg.attempts === 'number' && Number.isFinite(msg.attempts) ? msg.attempts : 0;
      const maxAttempts = 10;
      const publicId = body.publicId;
      const message = error instanceof Error ? error.message : String(error);

      if (attempt >= maxAttempts) {
        console.error('[tokyo] queue job failed permanently', body.kind, publicId, message);
        msg.ack();
        continue;
      }

      const delaySeconds = shouldRetryMissingPrereqs(error)
        ? retryDelaySeconds(attempt, 2, 30)
        : retryDelaySeconds(attempt, 5, 60);
      console.warn(
        '[tokyo] queue job failed, retrying',
        body.kind,
        publicId,
        `attempt=${attempt}`,
        message,
      );
      msg.retry({ delaySeconds });
    }
  }
}
