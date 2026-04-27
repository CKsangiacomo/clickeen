import { enqueueAccountInstanceSync, type AccountInstanceSyncIntent } from './account-instance-sync';
import {
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstanceServeStates,
} from './account-instance-direct';
import { listAccountInstancePublicIds } from './michael';

function formatWarning(prefix: string, detail?: string | null): string {
  const normalized = typeof detail === 'string' ? detail.trim() : '';
  return normalized ? `${prefix}:${normalized}` : prefix;
}

type AccountLocaleSyncTarget = {
  publicId: string;
  live: boolean;
};

async function loadAccountLocaleSyncTargets(args: {
  accountId: string;
  accessToken: string;
  accountCapsule?: string | null;
}): Promise<
  | { ok: true; targets: AccountLocaleSyncTarget[]; warnings: string[] }
  | { ok: false; warning: string }
> {
  const publicIdsResult = await listAccountInstancePublicIds(
    args.accountId,
    args.accessToken,
  );
  if (!publicIdsResult.ok) {
    return {
      ok: false,
      warning: formatWarning(
        'account_locales_instance_ids_unavailable',
        publicIdsResult.detail ?? publicIdsResult.reasonKey,
      ),
    };
  }

  const serveStatesResult = await loadTokyoAccountInstanceServeStates({
    accountId: args.accountId,
    publicIds: publicIdsResult.publicIds,
    tokyoAccessToken: args.accessToken,
    accountCapsule: args.accountCapsule,
  });
  if (!serveStatesResult.ok) {
    return {
      ok: false,
      warning: formatWarning(
        'account_locales_serve_state_unavailable',
        serveStatesResult.error.detail ?? serveStatesResult.error.reasonKey,
      ),
    };
  }

  const savedResults = await Promise.all(
    publicIdsResult.publicIds.map(async (publicId) => ({
      publicId,
      saved: await loadTokyoAccountInstanceDocument({
        accountId: args.accountId,
        publicId,
        tokyoAccessToken: args.accessToken,
        accountCapsule: args.accountCapsule,
      }),
    })),
  );
  const warnings: string[] = [];
  const targets: AccountLocaleSyncTarget[] = [];

  for (const result of savedResults) {
    if (result.saved.ok) {
      targets.push({
        publicId: result.publicId,
        live:
          (serveStatesResult.value.serveStates[result.publicId] ?? 'unpublished') ===
          'published',
      });
      continue;
    }

    if (result.saved.status === 404) {
      continue;
    }

    warnings.push(
      formatWarning(
        `account_locales_saved_document_unavailable:${result.publicId}`,
        result.saved.error.detail ?? result.saved.error.reasonKey,
      ),
    );
  }

  return {
    ok: true,
    targets,
    warnings,
  };
}

export async function runAccountLocalesSync(args: {
  accountId: string;
  accessToken: string;
  accountCapsule?: string | null;
  l10nIntent: AccountInstanceSyncIntent;
}): Promise<void> {
  const targets = await loadAccountLocaleSyncTargets({
    accountId: args.accountId,
    accessToken: args.accessToken,
    accountCapsule: args.accountCapsule,
  });
  if (!targets.ok) {
    throw new Error(targets.warning);
  }

  const syncTargets = Array.from(
    new Map(
      targets.targets.map((instance) => [instance.publicId, instance]),
    ).values(),
  );

  if (targets.warnings.length) {
    throw new Error(targets.warnings.join(';'));
  }

  for (const instance of syncTargets) {
    await enqueueAccountInstanceSync({
      accessToken: args.accessToken,
      accountId: args.accountId,
      publicId: instance.publicId,
      accountCapsule: args.accountCapsule,
      live: instance.live,
      l10nIntent: args.l10nIntent,
    });
  }
}
