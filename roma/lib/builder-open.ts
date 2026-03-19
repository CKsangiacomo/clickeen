import { loadTokyoPreferredAccountInstance } from './account-instance-direct';

export type BuilderOpenEnvelope = {
  accountId: string;
  publicId: string;
  displayName: string;
  ownerAccountId: string;
  widgetType: string;
  status: 'published' | 'unpublished';
  config: Record<string, unknown>;
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
    },
  };
}
