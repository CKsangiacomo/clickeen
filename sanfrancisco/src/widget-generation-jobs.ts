import { isRecord } from './http';

export type WidgetGenerationJobType = 'widget.translation' | 'widget.embed';

export type WidgetGenerationJob = {
  v: 1;
  jobId: string;
  jobType: WidgetGenerationJobType;
  accountPublicId: string;
  instanceId: string;
  sourceVersion: number;
  attempt: number;
  queuedAt: string;
  traceId: string;
  agentId: string;
};

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isAccountPublicId(value: string): boolean {
  return /^[0-9A-Z]{8}$/.test(value);
}

function isInstanceId(value: string): boolean {
  return /^[0-9A-Z]{10}$/.test(value);
}

function normalizeJobType(value: unknown): WidgetGenerationJobType | null {
  return value === 'widget.translation' || value === 'widget.embed' ? value : null;
}

function normalizePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

function normalizeAttempt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

export function normalizeWidgetGenerationJob(raw: unknown): WidgetGenerationJob | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const jobId = asTrimmedString(raw.jobId);
  const jobType = normalizeJobType(raw.jobType);
  const accountPublicId = asTrimmedString(raw.accountPublicId);
  const instanceId = asTrimmedString(raw.instanceId);
  const sourceVersion = normalizePositiveInteger(raw.sourceVersion);
  const attempt = normalizeAttempt(raw.attempt);
  const queuedAt = asTrimmedString(raw.queuedAt);
  const traceId = asTrimmedString(raw.traceId);
  const agentId = asTrimmedString(raw.agentId);
  if (
    !jobId ||
    !jobType ||
    !accountPublicId ||
    !isAccountPublicId(accountPublicId) ||
    !instanceId ||
    !isInstanceId(instanceId) ||
    sourceVersion === null ||
    attempt === null ||
    !queuedAt ||
    !traceId ||
    !agentId
  ) {
    return null;
  }
  return {
    v: 1,
    jobId,
    jobType,
    accountPublicId,
    instanceId,
    sourceVersion,
    attempt,
    queuedAt,
    traceId,
    agentId,
  };
}

export function buildWidgetGenerationJobs(args: {
  accountPublicId: string;
  instanceId: string;
  sourceVersion: number;
  traceId: string;
  now?: string;
}): WidgetGenerationJob[] {
  const queuedAt = args.now ?? new Date().toISOString();
  const base = {
    v: 1 as const,
    accountPublicId: args.accountPublicId,
    instanceId: args.instanceId,
    sourceVersion: args.sourceVersion,
    attempt: 0,
    queuedAt,
    traceId: args.traceId,
  };
  return [
    {
      ...base,
      jobId: crypto.randomUUID(),
      jobType: 'widget.translation',
      agentId: 'widget.instance.translator',
    },
    {
      ...base,
      jobId: crypto.randomUUID(),
      jobType: 'widget.embed',
      agentId: 'widget.instance.embed',
    },
  ];
}
