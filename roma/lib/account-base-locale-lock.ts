import { loadAccountInstanceFactsFromTokyo } from './account-instance-direct';

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
    const facts = await loadAccountInstanceFactsFromTokyo({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!facts.ok) {
      return {
        ok: false,
        status: facts.status,
        reasonKey: facts.error.reasonKey,
        detail: facts.error.detail,
      };
    }

    return { ok: true, locked: facts.value.hasInstances };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'roma.errors.proxy.tokyo_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
