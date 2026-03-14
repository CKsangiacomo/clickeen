import { assertCap, verifyGrant } from './grants';
import { HttpError, json, noStore, readJson, isRecord } from './http';
import { assertInternalAuth, asTrimmedString } from './internalAuth';
import {
  executeL10nJob,
  isL10nJob,
  resolveL10nPlanningSnapshot,
  type L10nJob,
} from './agents/l10nInstance';
import { executePragueStringsTranslate, isPragueStringsJob } from './agents/l10nPragueStrings';
import { withInflightLimit } from './concurrency';
import type { AIGrant, Env } from './types';

export async function handleL10nDispatch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const environment = asTrimmedString(env.ENVIRONMENT);
  if (environment !== 'local') {
    throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
  }

  assertInternalAuth(request, env);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
  }

  let jobs: unknown[] = [];
  if (Array.isArray(payload)) {
    jobs = payload;
  } else if (isRecord(payload)) {
    if (Array.isArray(payload.jobs)) jobs = payload.jobs;
    else if (payload.job) jobs = [payload.job];
    else jobs = [payload];
  }

  if (!jobs.length) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'No jobs provided' });
  }

  const invalid = jobs
    .map((job, index) => ({ job, index }))
    .filter(({ job }) => !isL10nJob(job))
    .map(({ index }) => ({ path: `jobs[${index}]`, message: 'invalid l10n job' }));
  if (invalid.length) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid l10n jobs', issues: invalid });
  }

  const verified: Array<{ job: L10nJob; grant: AIGrant }> = [];
  for (const job of jobs as L10nJob[]) {
    const grant = await verifyGrant(job.grant, env.AI_GRANT_HMAC_SECRET);
    assertCap(grant, `agent:${job.agentId}`);
    verified.push({ job, grant });
  }

  for (const { job, grant } of verified) {
    ctx.waitUntil(
      executeL10nJob(job, env, grant).catch((err: unknown) => {
        console.error('[sanfrancisco] l10n dispatch failed', err);
      }),
    );
  }

  return noStore(json({ ok: true, queued: jobs.length }));
}

export async function handleL10nPlan(request: Request, env: Env): Promise<Response> {
  assertInternalAuth(request, env);

  const body = await readJson(request);
  if (!isRecord(body)) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'body must be an object' });
  }

  const widgetType = asTrimmedString((body as any).widgetType);
  const config = isRecord((body as any).config) ? ((body as any).config as Record<string, unknown>) : null;
  const baseUpdatedAt = asTrimmedString((body as any).baseUpdatedAt) ?? null;
  const publicId = asTrimmedString((body as any).publicId);
  const accountId = asTrimmedString((body as any).accountId);

  if (!widgetType) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Missing required field: widgetType',
    });
  }
  if (!config && (!publicId || !accountId)) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Missing required fields: config OR (publicId + accountId)',
    });
  }

  const plan = await resolveL10nPlanningSnapshot({
    env,
    widgetType,
    config,
    baseUpdatedAt,
    publicId,
    accountId,
  });
  return noStore(json(plan));
}

export async function handlePragueStringsTranslate(request: Request, env: Env): Promise<Response> {
  return await withInflightLimit(async () => {
    const environment = asTrimmedString(env.ENVIRONMENT);
    if (environment !== 'local' && environment !== 'dev') {
      throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
    }

    assertInternalAuth(request, env);

    const body = await readJson(request);
    const payload = isRecord(body) && isRecord((body as any).job) ? (body as any).job : body;
    if (!isPragueStringsJob(payload)) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid l10n translate job' });
    }

    const result = await executePragueStringsTranslate(payload, env);
    return noStore(json(result));
  });
}
