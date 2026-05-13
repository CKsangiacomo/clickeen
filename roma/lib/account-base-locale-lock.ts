import { loadTokyoAccountInstanceIndex } from './account-instance-direct';

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
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<AccountBaseLocaleLockResult> {
  try {
    const index = await loadTokyoAccountInstanceIndex({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!index.ok) {
      return {
        ok: false,
        status: index.status,
        reasonKey: index.error.reasonKey,
        detail: index.error.detail,
      };
    }

    return { ok: true, locked: index.value.accountInstances.length > 0 };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'roma.errors.proxy.tokyo_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
