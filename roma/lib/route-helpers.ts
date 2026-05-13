import type { NextRequest } from 'next/server';
import { normalizeInstanceId } from '@clickeen/ck-contracts';

export type RouteFailure = {
  ok: false;
  status: number;
  error: {
    kind: 'VALIDATION';
    reasonKey: string;
    detail?: string;
  };
};

type InstanceIdRouteContext = {
  params: Promise<{ instanceId?: string }>;
};

export async function requireInstanceIdParam(
  context: InstanceIdRouteContext,
  options: {
    mode?: 'trimmed' | 'normalized';
    reasonKey?: string;
  } = {},
): Promise<string | RouteFailure> {
  const { instanceId: instanceIdRaw } = await context.params;
  const mode = options.mode ?? 'trimmed';
  const instanceId = mode === 'normalized' ? normalizeInstanceId(instanceIdRaw) : String(instanceIdRaw || '').trim();
  if (instanceId) return instanceId;
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey:
        options.reasonKey ??
        (mode === 'normalized'
          ? 'coreui.errors.instanceId.invalid'
          : 'coreui.errors.instance.instanceIdRequired'),
    },
  };
}

export async function readJsonPayloadOrValidation<T = unknown>(
  request: NextRequest,
): Promise<{ ok: true; payload: T } | RouteFailure> {
  try {
    return { ok: true, payload: (await request.json()) as T };
  } catch {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalidJson',
      },
    };
  }
}
