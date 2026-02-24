import type { Env, L10nJob } from '../../shared/types';
import { asTrimmedString } from '../../shared/validation';
import { callSanfranciscoJson } from '../../shared/sanfrancisco';

type DispatchResult =
  | { ok: true; transport: 'queue' | 'http' }
  | { ok: false; error: string };

function shouldUseHttpFallback(env: Env): boolean {
  if (env.L10N_GENERATE_QUEUE) return false;
  const stage = asTrimmedString(env.ENV_STAGE) ?? 'cloud-dev';
  if (stage !== 'local') return false;
  return Boolean(asTrimmedString(env.SANFRANCISCO_BASE_URL));
}

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

  if (shouldUseHttpFallback(env)) {
    const dispatched = await callSanfranciscoJson({
      env,
      path: '/v1/l10n',
      method: 'POST',
      body: { jobs },
    });
    if (!dispatched.ok) {
      const detail = await dispatched.response.text().catch(() => '');
      return {
        ok: false,
        error: detail || `SanFrancisco /v1/l10n dispatch failed (${dispatched.response.status})`,
      };
    }
    return { ok: true, transport: 'http' };
  }

  return { ok: false, error: 'L10N_GENERATE_QUEUE missing' };
}
