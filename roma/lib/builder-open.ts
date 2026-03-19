import { loadTokyoAccountInstanceDocument } from './account-instance-direct';

export type BuilderOpenEnvelope = {
  publicId: string;
  displayName: string;
  widgetType: string;
  config: Record<string, unknown>;
};

export async function loadBuilderOpenEnvelope(args: {
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
  const instance = await loadTokyoAccountInstanceDocument({
    accountId: args.accountId,
    publicId: args.publicId,
    tokyoAccessToken: args.accessToken,
    accountCapsule: args.accountCapsule,
  });
  if (!instance.ok) {
    return instance;
  }

  return {
    ok: true,
    value: {
      publicId: instance.value.row.publicId,
      displayName: instance.value.row.displayName || 'Untitled widget',
      widgetType: instance.value.row.widgetType,
      config: instance.value.config,
    },
  };
}
