import { can, resolvePolicyFromEntitlementsSnapshot, type RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  createAccountInstanceRow,
  deleteAccountInstanceRow,
} from './michael';
import {
  deleteSavedConfigFromTokyo,
  writeSavedConfigToTokyo,
} from './account-instance-direct';
import { resolveTokyoBaseUrl } from './env/tokyo';

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
  await deleteSavedConfigFromTokyo({
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    tokyoAccessToken: args.accessToken,
    accountId: args.accountId,
    publicId: args.publicId,
    accountCapsule: args.accountCapsule,
  });
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

  if (!args.config || typeof args.config !== 'object' || Array.isArray(args.config)) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.config.invalid',
        paths: ['config'],
      },
    };
  }
  const config = args.config as Record<string, unknown>;

  try {
    await writeSavedConfigToTokyo({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      tokyoAccessToken: args.accessToken,
      accountId: args.accountId,
      publicId: args.publicId,
      accountCapsule: args.accountCapsule,
      widgetType: args.widgetType,
      config,
      displayName: null,
      source: 'account',
      meta: null,
    });
  } catch (error) {
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

  const createdRow = await createAccountInstanceRow({
    accountId: args.accountId,
    publicId: args.publicId,
    widgetType: args.widgetType,
    berlinAccessToken: args.accessToken,
  });
  if (!createdRow.ok) {
    await rollbackCreate({
      accountId: args.accountId,
      publicId: args.publicId,
      accessToken: args.accessToken,
      accountCapsule: args.accountCapsule,
    });
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
    await rollbackCreate({
      accountId: args.accountId,
      publicId: args.publicId,
      accessToken: args.accessToken,
      accountCapsule: args.accountCapsule,
    });
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
