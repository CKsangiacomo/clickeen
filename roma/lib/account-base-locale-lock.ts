import { listAccountWidgetInstanceIds } from './account-instance-direct';

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
    const instances = await listAccountWidgetInstanceIds({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!instances.ok) {
      return {
        ok: false,
        status: instances.status,
        reasonKey: instances.error.reasonKey,
        detail: instances.error.detail,
      };
    }

    return { ok: true, locked: instances.value.instanceIds.length > 0 };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'roma.errors.proxy.tokyo_unavailable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
