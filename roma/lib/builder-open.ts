import { loadAccountLocalizationSnapshot } from './account-l10n';
import { loadTokyoPreferredAccountInstance } from './account-instance-direct';

export type BuilderOpenEnvelope = {
  accountId: string;
  publicId: string;
  displayName: string;
  ownerAccountId: string;
  widgetType: string;
  status: 'published' | 'unpublished';
  config: Record<string, unknown>;
  localization: unknown;
};

export async function loadBuilderOpenEnvelope(args: {
  berlinBaseUrl: string;
  tokyoBaseUrl: string;
  accessToken: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
}): Promise<
  | { ok: true; value: BuilderOpenEnvelope }
  | {
      ok: false;
      status: number;
      error: {
        kind: 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE' | 'VALIDATION';
        reasonKey: string;
        detail?: string;
      };
    }
> {
  const instance = await loadTokyoPreferredAccountInstance({
    accountId: args.accountId,
    publicId: args.publicId,
    tokyoBaseUrl: args.tokyoBaseUrl,
    tokyoAccessToken: args.accessToken,
    accountCapsule: args.accountCapsule,
  });
  if (!instance.ok) {
    return instance;
  }

  try {
    const localization = await loadAccountLocalizationSnapshot({
      berlinBaseUrl: args.berlinBaseUrl,
      tokyoBaseUrl: args.tokyoBaseUrl,
      accessToken: args.accessToken,
      accountId: args.accountId,
      publicId: args.publicId,
      accountCapsule: args.accountCapsule,
    });

    return {
      ok: true,
      value: {
        accountId: args.accountId,
        publicId: instance.value.row.publicId,
        displayName: instance.value.row.displayName || 'Untitled widget',
        ownerAccountId: instance.value.row.accountId,
        widgetType: instance.value.row.widgetType,
        status: instance.value.row.status,
        config: instance.value.config,
        localization: localization.snapshot,
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.readFailed',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
