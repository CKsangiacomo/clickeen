import { loadTokyoAccountInstanceDocument } from './account-instance-direct';
import {
  createMichaelHeaders,
  encodeFilterValue,
  fetchMichaelListRows,
  michaelUnavailableResult,
  resolveMichaelAccessToken,
} from './michael-shared';

type AccountBaseLocaleLockResult =
  | {
      ok: true;
      locked: boolean;
    }
  | {
      ok: false;
      status: number;
      reasonKey: string;
      detail?: string;
    };

export async function loadAccountBaseLocaleLockState(args: {
  accountId: string;
  berlinAccessToken: string;
  tokyoAccessToken: string;
  accountCapsule?: string | null;
}): Promise<AccountBaseLocaleLockResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(args.berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = createMichaelHeaders(michaelAccess.accessToken);
    const rows = await fetchMichaelListRows<{ public_id?: unknown }>({
      headers,
      pathname: `/rest/v1/widget_instances?select=public_id&account_id=eq.${encodeFilterValue(args.accountId)}&order=created_at.desc,public_id.desc`,
      pageSize: 200,
    });
    if (!rows.ok) {
      return rows;
    }

    for (const row of rows.rows) {
      const publicId = typeof row.public_id === 'string' ? row.public_id.trim() : '';
      if (!publicId) continue;

      const saved = await loadTokyoAccountInstanceDocument({
        accountId: args.accountId,
        publicId,
        tokyoAccessToken: args.tokyoAccessToken,
        accountCapsule: args.accountCapsule,
      });
      if (!saved.ok) {
        return {
          ok: false,
          status: saved.status,
          reasonKey: saved.error.reasonKey,
          detail: saved.error.detail,
        };
      }
      if (saved.value) {
        return { ok: true, locked: true };
      }
    }

    return { ok: true, locked: false };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}
