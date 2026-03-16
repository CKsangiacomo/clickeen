import { assertCap, verifyGrant } from './grants';
import { HttpError, json, noStore, readJson, isRecord } from './http';
import { assertInternalAuth, asTrimmedString } from './internalAuth';
import {
  executePersonalizationOnboarding,
  type PersonalizationOnboardingInput,
  type PersonalizationOnboardingResult,
} from './agents/personalizationOnboarding';
import { isOutcomeAttachRequest, persistOutcomeAttach } from './telemetry';
import type { AIGrant, Env, OutcomeAttachRequest, SanfranciscoCommandMessage, Usage } from './types';

const ONBOARDING_JOB_TTL_SEC = 60 * 30;

type OnboardingJobStatus = 'queued' | 'running' | 'completed' | 'failed';

type OnboardingJobRecord = {
  v: 1;
  jobId: string;
  status: OnboardingJobStatus;
  createdAtMs: number;
  updatedAtMs: number;
  input: PersonalizationOnboardingInput;
  result?: PersonalizationOnboardingResult;
  usage?: Usage;
  error?: { message: string };
};

function onboardingJobKey(jobId: string): string {
  return `personalization:onboarding:${jobId}`;
}

async function loadOnboardingJob(env: Env, jobId: string): Promise<OnboardingJobRecord | null> {
  const stored = await env.SF_KV.get(onboardingJobKey(jobId), 'json').catch(() => null);
  if (!stored || !isRecord(stored)) return null;
  if (stored.v !== 1) return null;
  return stored as OnboardingJobRecord;
}

async function saveOnboardingJob(env: Env, record: OnboardingJobRecord): Promise<void> {
  await env.SF_KV.put(onboardingJobKey(record.jobId), JSON.stringify(record), { expirationTtl: ONBOARDING_JOB_TTL_SEC });
}

export function isSanfranciscoCommandMessage(value: unknown): value is SanfranciscoCommandMessage {
  if (!isRecord(value)) return false;
  if ((value as any).v !== 1) return false;
  if ((value as any).kind !== 'sf.command') return false;
  const command = asTrimmedString((value as any).command);
  if (command !== 'personalization.onboarding.enqueue' && command !== 'ai.outcome.attach') {
    return false;
  }
  return isRecord((value as any).payload);
}

function unwrapCommandPayload(raw: unknown, expectedCommand: string): unknown {
  if (!isSanfranciscoCommandMessage(raw)) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Expected sf.command envelope payload',
    });
  }
  const command = raw.command;
  if (command !== expectedCommand) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: `Unsupported command "${command}" (expected "${expectedCommand}")`,
    });
  }
  return raw.payload;
}

async function runPersonalizationOnboardingJob(args: {
  env: Env;
  jobId: string;
  grant: AIGrant;
  input: PersonalizationOnboardingInput;
}): Promise<void> {
  const existing = await loadOnboardingJob(args.env, args.jobId);
  const baseRecord: OnboardingJobRecord =
    existing ?? ({
      v: 1,
      jobId: args.jobId,
      status: 'queued',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      input: args.input,
    } as OnboardingJobRecord);

  const runningRecord: OnboardingJobRecord = { ...baseRecord, status: 'running', updatedAtMs: Date.now() };
  await saveOnboardingJob(args.env, runningRecord);

  try {
    const { result, usage } = await executePersonalizationOnboarding({ env: args.env, grant: args.grant, input: args.input });

    const completed: OnboardingJobRecord = {
      ...runningRecord,
      status: 'completed',
      result,
      usage,
      updatedAtMs: Date.now(),
    };
    await saveOnboardingJob(args.env, completed);
  } catch (err) {
    const message = err instanceof HttpError ? err.error?.message ?? err.message : err instanceof Error ? err.message : 'Unknown error';
    const failed: OnboardingJobRecord = {
      ...runningRecord,
      status: 'failed',
      error: { message },
      updatedAtMs: Date.now(),
    };
    await saveOnboardingJob(args.env, failed);
  }
}

async function enqueuePersonalizationOnboarding(args: {
  env: Env;
  payload: Record<string, unknown>;
  dispatchMode: 'background' | 'inline';
  ctx?: ExecutionContext;
}): Promise<{ jobId: string }> {
  const { env, payload } = args;

  const grantRaw = asTrimmedString((payload as any).grant);
  if (!grantRaw) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing grant' });
  }

  const agentId = asTrimmedString((payload as any).agentId) ?? 'agent.personalization.onboarding.v1';
  if (agentId !== 'agent.personalization.onboarding.v1') {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Unsupported agentId' });
  }

  const accountId = asTrimmedString((payload as any).accountId);
  const url = asTrimmedString((payload as any).url);
  if (!accountId || !url) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing accountId or url' });
  }

  const grant = await verifyGrant(grantRaw, env.AI_GRANT_HMAC_SECRET);
  assertCap(grant, `agent:${agentId}`);

  const input: PersonalizationOnboardingInput = {
    accountId,
    url,
    ...(typeof (payload as any).locale === 'string' ? { locale: (payload as any).locale } : {}),
    ...(typeof (payload as any).websiteDepth === 'number' ? { websiteDepth: (payload as any).websiteDepth } : {}),
    ...(typeof (payload as any).gbpPlaceId === 'string' ? { gbpPlaceId: (payload as any).gbpPlaceId } : {}),
    ...(typeof (payload as any).facebookPageId === 'string' ? { facebookPageId: (payload as any).facebookPageId } : {}),
    ...(typeof (payload as any).instagramHandle === 'string' ? { instagramHandle: (payload as any).instagramHandle } : {}),
  };

  const requestedJobId = asTrimmedString((payload as any).jobId);
  const jobId = requestedJobId ?? crypto.randomUUID();
  const existing = await loadOnboardingJob(env, jobId);
  if (existing && existing.status !== 'failed') {
    return { jobId };
  }

  const now = Date.now();
  const record: OnboardingJobRecord = {
    v: 1,
    jobId,
    status: 'queued',
    createdAtMs: existing?.createdAtMs ?? now,
    updatedAtMs: now,
    input,
  };
  await saveOnboardingJob(env, existing ? { ...existing, ...record } : record);

  if (args.dispatchMode === 'background') {
    if (!args.ctx) {
      throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Missing execution context' });
    }
    args.ctx.waitUntil(runPersonalizationOnboardingJob({ env, jobId, grant, input }));
    return { jobId };
  }

  await runPersonalizationOnboardingJob({ env, jobId, grant, input });
  return { jobId };
}

export async function handlePersonalizationOnboardingCreate(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  assertInternalAuth(request, env);

  const payloadRaw = await readJson(request);
  const payload = unwrapCommandPayload(payloadRaw, 'personalization.onboarding.enqueue');
  if (!isRecord(payload)) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
  }

  const scheduled = await enqueuePersonalizationOnboarding({
    env,
    payload: payload as Record<string, unknown>,
    dispatchMode: 'background',
    ctx,
  });
  return noStore(json({ jobId: scheduled.jobId }));
}

export async function handlePersonalizationOnboardingStatus(request: Request, env: Env, jobId: string): Promise<Response> {
  assertInternalAuth(request, env);
  const record = await loadOnboardingJob(env, jobId);
  if (!record) {
    throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Job not found' });
  }

  return noStore(
    json({
      jobId: record.jobId,
      status: record.status,
      ...(record.result ? { result: record.result } : {}),
      ...(record.error ? { error: record.error } : {}),
      updatedAtMs: record.updatedAtMs,
    }),
  );
}

export async function handleQueuedSanfranciscoCommand(command: SanfranciscoCommandMessage, env: Env): Promise<void> {
  if (command.command === 'personalization.onboarding.enqueue') {
    await enqueuePersonalizationOnboarding({
      env,
      payload: command.payload,
      dispatchMode: 'inline',
    });
    return;
  }

  if (command.command === 'ai.outcome.attach') {
    if (!isOutcomeAttachRequest(command.payload)) {
      throw new HttpError(400, {
        code: 'BAD_REQUEST',
        message: 'Invalid ai.outcome.attach payload',
        issues: [{ path: 'payload', message: 'Expected { requestId, sessionId, event, occurredAtMs }' }],
      });
    }
    await persistOutcomeAttach(env, command.payload as OutcomeAttachRequest);
    return;
  }

  throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Unsupported command' });
}
