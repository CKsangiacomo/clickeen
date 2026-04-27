import { loadTokyoAccountInstanceDocument } from './account-instance-direct';
import { listAccountInstancePublicIds } from './michael-instance-rows';
import { michaelUnavailableResult } from './michael-shared';

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
    const publicIds = await listAccountInstancePublicIds(args.accountId, args.berlinAccessToken);
    if (!publicIds.ok) return publicIds;

    for (const publicId of publicIds.publicIds) {
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
