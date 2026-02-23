import type { Env } from '../../shared/types';
import { readJson } from '../../shared/http';
import { asTrimmedString, isRecord } from '../../shared/validation';
import { callSanfranciscoJson } from '../../shared/sanfrancisco';

export type L10nPlanningSnapshot = {
  widgetType: string;
  baseFingerprint: string;
  baseUpdatedAt: string | null;
  snapshot: Record<string, string>;
};

export async function resolveL10nPlanningSnapshot(args: {
  env: Env;
  widgetType: string;
  config: Record<string, unknown>;
  baseUpdatedAt?: string | null;
}): Promise<
  | { ok: true; plan: L10nPlanningSnapshot }
  | { ok: false; error: string }
> {
  const upstream = await callSanfranciscoJson({
    env: args.env,
    path: '/v1/l10n/plan',
    method: 'POST',
    body: {
      widgetType: args.widgetType,
      config: args.config,
      baseUpdatedAt: args.baseUpdatedAt ?? null,
    },
  });
  if (!upstream.ok) {
    const details = await readJson(upstream.response).catch(() => null);
    const detail = details ? JSON.stringify(details) : `status ${upstream.response.status}`;
    return { ok: false, error: `L10N planning failed: ${detail}` };
  }

  const payload = upstream.payload;
  if (!isRecord(payload)) return { ok: false, error: 'L10N planning returned non-object payload' };
  const widgetType = asTrimmedString((payload as any).widgetType);
  const baseFingerprint = asTrimmedString((payload as any).baseFingerprint);
  const baseUpdatedAtRaw = (payload as any).baseUpdatedAt;
  const snapshotRaw = (payload as any).snapshot;
  if (!widgetType || !baseFingerprint || !isRecord(snapshotRaw)) {
    return { ok: false, error: 'L10N planning returned invalid payload fields' };
  }

  const snapshot: Record<string, string> = {};
  for (const [path, value] of Object.entries(snapshotRaw)) {
    if (!path || typeof value !== 'string') continue;
    snapshot[path] = value;
  }

  const baseUpdatedAt =
    typeof baseUpdatedAtRaw === 'string' && baseUpdatedAtRaw.trim()
      ? baseUpdatedAtRaw.trim()
      : null;
  return {
    ok: true,
    plan: {
      widgetType,
      baseFingerprint,
      baseUpdatedAt,
      snapshot,
    },
  };
}
