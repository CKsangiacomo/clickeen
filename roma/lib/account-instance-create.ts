import { can, resolvePolicyFromEntitlementsSnapshot, type RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  createAccountInstanceRow,
  deleteAccountInstanceRow,
} from './michael';
import {
  validatePersistableConfig,
  writeSavedConfigToTokyo,
} from './account-instance-direct';
import { resolveTokyoBaseUrl } from './env/tokyo';
import { buildTokyoProductHeaders } from './tokyo-product-auth';

export type AccountInstanceCreateError = {
  kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE' | 'INTERNAL';
  reasonKey: string;
  detail?: string;
  paths?: string[];
};

export type AccountInstanceCreateResult =
  | {
      ok: true;
      value: {
        publicId: string;
        widgetType: string;
        status: 'unpublished';
        source: 'account';
      };
    }
  | {
      ok: false;
      status: number;
      error: AccountInstanceCreateError;
    };

async function rollbackCreate(args: {
  accountId: string;
  publicId: string;
  accessToken: string;
  accountCapsule?: string | null;
}) {
  const [michaelRollback, tokyoRollback] = await Promise.allSettled([
    deleteAccountInstanceRow({
      accountId: args.accountId,
      publicId: args.publicId,
      berlinAccessToken: args.accessToken,
    }),
    writeSavedConfigRollback({
      accountId: args.accountId,
      publicId: args.publicId,
      accessToken: args.accessToken,
      accountCapsule: args.accountCapsule,
    }),
  ]);

  if (michaelRollback.status === 'rejected' && process.env.NODE_ENV === 'development') {
    console.warn('[roma account-instance-create] failed to rollback Michael row', michaelRollback.reason);
  }
  if (tokyoRollback.status === 'rejected' && process.env.NODE_ENV === 'development') {
    console.warn('[roma account-instance-create] failed to rollback Tokyo saved config', tokyoRollback.reason);
  }
}

async function writeSavedConfigRollback(args: {
  accountId: string;
  publicId: string;
  accessToken: string;
  accountCapsule?: string | null;
}) {
  const tokyoBaseUrl = resolveTokyoBaseUrl();
  const response = await fetch(
    `${tokyoBaseUrl.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(
      args.publicId,
    )}/saved.json?accountId=${encodeURIComponent(args.accountId)}`,
    {
      method: 'DELETE',
      headers: buildTokyoProductHeaders({
        accountId: args.accountId,
        accountCapsule: args.accountCapsule,
      }),
      cache: 'no-store',
    },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`tokyo_saved_config_delete_http_${response.status}`);
  }
}

export async function createAccountInstance(args: {
  accountId: string;
  publicId: string;
  widgetType: string;
  config: unknown;
  accessToken: string;
  accountCapsule?: string | null;
  authz: RomaAccountAuthzCapsulePayload;
}): Promise<AccountInstanceCreateResult> {
  if (args.authz.accountId !== args.accountId) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: 'account_mismatch',
      },
    };
  }

  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: args.authz.profile,
    role: args.authz.role,
    entitlements: args.authz.entitlements ?? null,
  });
  const createGate = can(policy, 'instance.create');
  if (!createGate.allow) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: createGate.reasonKey,
        detail: createGate.detail,
      },
    };
  }

  const validatedConfig = validatePersistableConfig(args.config, args.accountId);
  if (!validatedConfig.ok) {
    return {
      ok: false,
      status: validatedConfig.status,
      error: validatedConfig.error,
    };
  }

  const createdRow = await createAccountInstanceRow({
    accountId: args.accountId,
    publicId: args.publicId,
    widgetType: args.widgetType,
    config: validatedConfig.value.config,
    berlinAccessToken: args.accessToken,
    status: 'unpublished',
  });
  if (!createdRow.ok) {
    return {
      ok: false,
      status: createdRow.status,
      error: {
        kind:
          createdRow.status === 401
            ? 'AUTH'
            : createdRow.status === 403
              ? 'DENY'
              : createdRow.status === 409 || createdRow.status === 422
                ? 'VALIDATION'
                : 'UPSTREAM_UNAVAILABLE',
        reasonKey: createdRow.reasonKey,
        detail: createdRow.detail,
      },
    };
  }

  if (!createdRow.row) {
    return {
      ok: false,
      status: 500,
      error: {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail: 'instance_create_empty',
      },
    };
  }

  try {
    await writeSavedConfigToTokyo({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      tokyoAccessToken: args.accessToken,
      accountId: args.accountId,
      publicId: args.publicId,
      accountCapsule: args.accountCapsule,
      widgetType: createdRow.row.widgetType,
      config: validatedConfig.value.config,
      displayName: createdRow.row.displayName,
      source: createdRow.row.source,
      meta: createdRow.row.meta ?? null,
    });
  } catch (error) {
    await rollbackCreate({
      accountId: args.accountId,
      publicId: args.publicId,
      accessToken: args.accessToken,
      accountCapsule: args.accountCapsule,
    });
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }

  return {
    ok: true,
    value: {
      publicId: createdRow.row.publicId,
      widgetType: createdRow.row.widgetType,
      status: 'unpublished',
      source: 'account',
    },
  };
}
