import { runAccountInstanceSync } from './account-instance-sync';
import { loadAccountWidgetCatalog } from './michael';

function formatWarning(prefix: string, detail?: string | null): string {
  const normalized = typeof detail === 'string' ? detail.trim() : '';
  return normalized ? `${prefix}:${normalized}` : prefix;
}

export async function runAccountLocalesSync(args: {
  accountId: string;
  accessToken: string;
  accountCapsule?: string | null;
}): Promise<string[]> {
  const catalog = await loadAccountWidgetCatalog({
    accountId: args.accountId,
    berlinAccessToken: args.accessToken,
    tokyoAccessToken: args.accessToken,
    accountCapsule: args.accountCapsule,
  });
  if (!catalog.ok) {
    return [
      formatWarning(
        'account_locales_catalog_unavailable',
        catalog.detail ?? catalog.reasonKey,
      ),
    ];
  }

  const publishedInstances = Array.from(
    new Map(
      [...catalog.accountInstances, ...catalog.curatedInstances]
        .filter((instance) => instance.status === 'published')
        .map((instance) => [instance.publicId, instance]),
    ).values(),
  );

  const warnings: string[] = [];
  for (const instance of publishedInstances) {
    try {
      await runAccountInstanceSync({
        accessToken: args.accessToken,
        accountId: args.accountId,
        publicId: instance.publicId,
        accountCapsule: args.accountCapsule,
        live: true,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      warnings.push(
        formatWarning(
          `account_locales_sync_failed:${instance.publicId}`,
          detail,
        ),
      );
    }
  }

  return warnings;
}
