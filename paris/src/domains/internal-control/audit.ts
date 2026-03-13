import { supabaseFetch } from '../../shared/supabase';
import { readJson } from '../../shared/http';
import { ckError, errorDetail } from '../../shared/errors';
import type { Env } from '../../shared/types';

export type InternalControlActor = {
  mode: 'local-tool' | 'shared-runtime';
  subject: string;
  serviceId: string;
};

export async function writeInternalControlEvent(args: {
  env: Env;
  kind: string;
  actor: InternalControlActor;
  targetType: string;
  targetId: string;
  accountId?: string | null;
  reason: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
}): Promise<{ ok: true; eventId: string } | { ok: false; response: Response }> {
  try {
    const response = await supabaseFetch(args.env, '/rest/v1/internal_control_events', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        kind: args.kind,
        actor: args.actor,
        target_type: args.targetType,
        target_id: args.targetId,
        account_id: args.accountId ?? null,
        reason: args.reason,
        payload: args.payload,
        result: args.result,
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        response: ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.internalControl.auditWriteFailed',
            detail: JSON.stringify(payload),
          },
          500,
        ),
      };
    }

    const row = Array.isArray(payload) ? payload[0] : null;
    const eventId = row && typeof row.id === 'string' ? row.id.trim() : '';
    if (!eventId) {
      return {
        ok: false,
        response: ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.internalControl.auditWriteFailed',
            detail: 'internal_control_event_missing_row',
          },
          500,
        ),
      };
    }

    return { ok: true, eventId };
  } catch (error) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.internalControl.auditWriteFailed',
          detail: errorDetail(error),
        },
        500,
      ),
    };
  }
}
