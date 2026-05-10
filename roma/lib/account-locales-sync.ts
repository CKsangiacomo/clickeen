import { enqueueAccountInstanceSync, type AccountInstanceSyncIntent } from './account-instance-sync';
import {
  loadTokyoAccountInstanceIndex,
} from './account-instance-direct';

function formatWarning(prefix: string, detail?: string | null): string {
  const normalized = typeof detail === 'string' ? detail.trim() : '';
  return normalized ? `${prefix}:${normalized}` : prefix;
}

type AccountLocaleSyncTarget = {
  instanceId: string;
  live: boolean;
};

async function loadAccountLocaleSyncTargets(args: {
  accountId: string;
  accountCapsule?: string | null;
}): Promise<
  | { ok: true; targets: AccountLocaleSyncTarget[]; warnings: string[] }
  | { ok: false; warning: string }
> {
  const index = await loadTokyoAccountInstanceIndex({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
  });
  if (!index.ok) {
    return {
      ok: false,
      warning: formatWarning(
        'account_locales_instance_index_unavailable',
        index.error.detail ?? index.error.reasonKey,
      ),
    };
  }

  const targets = index.value.accountInstances.map((instance) => ({
    instanceId: instance.instanceId,
    live: instance.publishStatus === 'published',
  }));

  return {
    ok: true,
    targets,
    warnings: [],
  };
}

export async function runAccountLocalesSync(args: {
  accountId: string;
  accountCapsule?: string | null;
  l10nIntent: AccountInstanceSyncIntent;
}): Promise<void> {
  const targets = await loadAccountLocaleSyncTargets({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
  });
  if (!targets.ok) {
    throw new Error(targets.warning);
  }

  const syncTargets = Array.from(
    new Map(
      targets.targets.map((instance) => [instance.instanceId, instance]),
    ).values(),
  );

  if (targets.warnings.length) {
    throw new Error(targets.warnings.join(';'));
  }

  for (const instance of syncTargets) {
    await enqueueAccountInstanceSync({
      accountId: args.accountId,
      instanceId: instance.instanceId,
      accountCapsule: args.accountCapsule,
      live: instance.live,
      l10nIntent: args.l10nIntent,
    });
  }
}
