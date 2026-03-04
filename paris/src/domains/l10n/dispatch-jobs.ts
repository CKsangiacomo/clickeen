import type { Env, L10nJob } from '../../shared/types';
import { asTrimmedString } from '../../shared/validation';

type DispatchResult =
  | { ok: true; transport: 'queue' }
  | { ok: false; error: string };

export async function dispatchL10nGenerateJobs(
  env: Env,
  jobs: L10nJob[],
): Promise<DispatchResult> {
  if (env.L10N_GENERATE_QUEUE) {
    try {
      await env.L10N_GENERATE_QUEUE.sendBatch(jobs.map((job) => ({ body: job })));
      return { ok: true, transport: 'queue' };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  const stage = asTrimmedString(env.ENV_STAGE) ?? 'cloud-dev';
  if (stage === 'local') {
    return { ok: false, error: 'Instance l10n generation is cloud-dev only (L10N_GENERATE_QUEUE missing in local).' };
  }
  return { ok: false, error: 'L10N_GENERATE_QUEUE missing' };
}
