import type { PolicyProfile } from '@clickeen/ck-policy';
import { runAccountSaveAftermath } from './account-save-aftermath';
import { loadAccountWidgetCatalog } from './michael';

function formatWarning(prefix: string, detail?: string | null): string {
  const normalized = typeof detail === 'string' ? detail.trim() : '';
  return normalized ? `${prefix}:${normalized}` : prefix;
}

export async function runAccountLocalesAftermath(args: {
  accountId: string;
  accessToken: string;
  policyProfile: PolicyProfile;
  accountCapsule?: string | null;
}): Promise<string[]> {
  const catalog = await loadAccountWidgetCatalog({
    accountId: args.accountId,
    berlinAccessToken: args.accessToken,
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
      await runAccountSaveAftermath({
        accessToken: args.accessToken,
        accountId: args.accountId,
        publicId: instance.publicId,
        policyProfile: args.policyProfile,
        accountCapsule: args.accountCapsule,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      warnings.push(
        formatWarning(
          `account_locales_aftermath_failed:${instance.publicId}`,
          detail,
        ),
      );
    }
  }

  return warnings;
}
