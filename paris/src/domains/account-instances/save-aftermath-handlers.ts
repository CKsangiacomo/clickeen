import { resolvePolicy } from '@clickeen/ck-policy';
import { buildL10nSnapshot, stableStringify } from '@clickeen/l10n';
import type { Policy } from '@clickeen/ck-policy';
import type { AccountRow, Env, InstanceRow, UpdatePayload } from '../../shared/types';
import { ckError, errorDetail } from '../../shared/errors';
import { loadWidgetLocalizationAllowlist } from '../../shared/l10n';
import { authorizeAccount } from '../../shared/account-auth';
import { isRecord } from '../../shared/validation';
import { enqueueL10nJobs } from '../l10n';
import { stripTextFromConfig } from '../../shared/mirror-packs';
import { convergePublishedInstanceSurface } from './published-convergence';
import { loadSavedConfigStateFromTokyo } from './service';

type SaveAftermathPayload = Pick<UpdatePayload, 'config'> & {
  previousConfig?: Record<string, unknown>;
  widgetType?: string;
  status?: 'published' | 'unpublished';
  source?: 'account' | 'curated';
  created?: boolean;
};

type SaveAftermathStepStatus =
  | { status: 'skipped' }
  | { status: 'scheduled' | 'synced' | 'failed'; detail?: string };

type SaveAftermathContext = {
  account: AccountRow;
  policy: Policy;
  widgetType: string;
  accountId: string;
  publicId: string;
  currentConfig: Record<string, unknown>;
  currentUpdatedAt: string | null;
  previousConfig: Record<string, unknown>;
  source: 'account' | 'curated';
  status: 'published' | 'unpublished';
  created: boolean;
};

type SaveAftermathContextResult =
  | { ok: true; value: SaveAftermathContext }
  | { ok: false; response: Response };

function responseWarning(detail: string) {
  return {
    error: {
      kind: 'INTERNAL',
      reasonKey: 'coreui.errors.db.writeFailed',
      detail,
    },
  };
}

function warningResponse(args: {
  published: boolean;
  translation?: SaveAftermathStepStatus;
  publishedSurface?: SaveAftermathStepStatus;
  changed?: boolean;
  textChanged?: boolean;
  detail: string;
}) {
  return Response.json({
    ok: true,
    changed: args.changed ?? false,
    textChanged: args.textChanged ?? false,
    published: args.published,
    translation: args.translation ?? { status: 'skipped' },
    publishedSurface: args.publishedSurface ?? { status: 'skipped' },
    ...responseWarning(args.detail),
  });
}

async function loadSaveAftermathContext(
  req: Request,
  env: Env,
  accountId: string,
  publicId: string,
): Promise<SaveAftermathContextResult> {
  const authorized = await authorizeAccount(req, env, accountId, 'editor', {
    requireCapsule: true,
  });
  if (authorized.ok === false) return { ok: false, response: authorized.response };
  const account = authorized.account;
  const policy = resolvePolicy({ profile: account.tier, role: authorized.role });

  let payload: SaveAftermathPayload;
  try {
    payload = (await req.json()) as SaveAftermathPayload;
  } catch {
    return {
      ok: false,
      response: ckError(
        { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' },
        422,
      ),
    };
  }

  if (!isRecord(payload.previousConfig)) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.config.invalid',
          paths: ['previousConfig'],
          detail: 'previousConfig must be an object',
        },
        422,
      ),
    };
  }

  const widgetType = typeof payload.widgetType === 'string' ? payload.widgetType.trim() : '';
  if (!widgetType) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          paths: ['widgetType'],
          detail: 'widgetType is required',
        },
        422,
      ),
    };
  }

  const status =
    payload.status === 'published' || payload.status === 'unpublished' ? payload.status : null;
  if (!status) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          paths: ['status'],
          detail: 'status is required',
        },
        422,
      ),
    };
  }

  const source =
    payload.source === 'curated'
      ? 'curated'
      : payload.source === undefined || payload.source === 'account'
        ? 'account'
        : null;
  if (!source) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.payload.invalid',
          paths: ['source'],
          detail: 'source must be account or curated',
        },
        422,
      ),
    };
  }

  const currentSavedState = await loadSavedConfigStateFromTokyo({
    env,
    accountId,
    publicId,
  });
  if (!currentSavedState) {
    return {
      ok: false,
      response: warningResponse({
        published: status === 'published',
        detail: 'saved_tokyo_revision_missing',
      }),
    };
  }

  return {
    ok: true,
    value: {
      account,
      policy,
      widgetType,
      accountId,
      publicId,
      currentConfig: currentSavedState.config,
      currentUpdatedAt: currentSavedState.updatedAt,
      previousConfig: payload.previousConfig,
      source,
      status,
      created: payload.created === true,
    },
  };
}

async function resolveTextDiff(args: {
  env: Env;
  widgetType: string;
  previousConfig: Record<string, unknown>;
  currentConfig: Record<string, unknown>;
}) {
  const allowlist = await loadWidgetLocalizationAllowlist(args.env, args.widgetType);
  const previousBaseTextPack = buildL10nSnapshot(args.previousConfig, allowlist);
  const nextBaseTextPack = buildL10nSnapshot(args.currentConfig, allowlist);
  const textChanged = stableStringify(previousBaseTextPack) !== stableStringify(nextBaseTextPack);
  return { allowlist, previousBaseTextPack, nextBaseTextPack, textChanged };
}

export async function handleAccountSaveTranslationSync(
  req: Request,
  env: Env,
  accountId: string,
  publicId: string,
) {
  const contextResult = await loadSaveAftermathContext(req, env, accountId, publicId);
  if (contextResult.ok === false) return contextResult.response;
  const context = contextResult.value;

  const configChanged =
    context.created ||
    stableStringify(context.previousConfig) !== stableStringify(context.currentConfig);
  if (!configChanged) {
    return Response.json({
      ok: true,
      changed: false,
      textChanged: false,
      published: context.status === 'published',
      translation: { status: 'skipped' },
    });
  }

  let textDiff;
  try {
    textDiff = await resolveTextDiff({
      env,
      widgetType: context.widgetType,
      previousConfig: context.previousConfig,
      currentConfig: context.currentConfig,
    });
  } catch (error) {
    return warningResponse({
      published: context.status === 'published',
      changed: true,
      textChanged: false,
      translation: {
        status: 'failed',
        detail: '[save-translation-sync] failed to build localization snapshot',
      },
      detail: `[save-translation-sync] ${errorDetail(error)}`,
    });
  }

  if (!textDiff.textChanged || context.source === 'curated') {
    return Response.json({
      ok: true,
      changed: true,
      textChanged: textDiff.textChanged,
      published: context.status === 'published',
      translation: { status: 'skipped' },
    });
  }

  const instance: InstanceRow = {
    public_id: context.publicId,
    display_name: context.account.name,
    status: context.status,
    config: context.currentConfig,
    created_at: context.currentUpdatedAt ?? new Date(0).toISOString(),
    updated_at: context.currentUpdatedAt,
    widget_id: null,
    account_id: context.accountId,
    kind: 'user',
  };

  const enqueueResult = await enqueueL10nJobs({
    env,
    instance,
    account: context.account,
    widgetType: context.widgetType,
    config: context.currentConfig,
    baseUpdatedAt: context.currentUpdatedAt,
    policy: context.policy,
  });
  if (!enqueueResult.ok) {
    return warningResponse({
      published: context.status === 'published',
      changed: true,
      textChanged: true,
      translation: { status: 'failed', detail: `[save-translation-sync] ${enqueueResult.error}` },
      detail: `[save-translation-sync] ${enqueueResult.error}`,
    });
  }

  return Response.json({
    ok: true,
    changed: true,
    textChanged: true,
    published: context.status === 'published',
    translation: { status: 'scheduled' },
  });
}

export async function handleAccountSavePublishedSurfaceSync(
  req: Request,
  env: Env,
  accountId: string,
  publicId: string,
) {
  const contextResult = await loadSaveAftermathContext(req, env, accountId, publicId);
  if (contextResult.ok === false) return contextResult.response;
  const context = contextResult.value;

  if (context.status !== 'published') {
    return Response.json({
      ok: true,
      changed: false,
      textChanged: false,
      published: false,
      publishedSurface: { status: 'skipped' },
    });
  }

  const configChanged =
    context.created ||
    stableStringify(context.previousConfig) !== stableStringify(context.currentConfig);
  if (!configChanged) {
    return Response.json({
      ok: true,
      changed: false,
      textChanged: false,
      published: true,
      publishedSurface: { status: 'skipped' },
    });
  }

  let textDiff;
  try {
    textDiff = await resolveTextDiff({
      env,
      widgetType: context.widgetType,
      previousConfig: context.previousConfig,
      currentConfig: context.currentConfig,
    });
  } catch (error) {
    return warningResponse({
      published: true,
      changed: true,
      textChanged: false,
      publishedSurface: {
        status: 'failed',
        detail: '[save-published-surface-sync] failed to build localization snapshot',
      },
      detail: `[save-published-surface-sync] ${errorDetail(error)}`,
    });
  }

  const previousConfigWithoutText = stripTextFromConfig(
    context.previousConfig,
    Object.keys(textDiff.previousBaseTextPack),
  );
  const nextConfigWithoutText = stripTextFromConfig(
    context.currentConfig,
    Object.keys(textDiff.nextBaseTextPack),
  );
  const configFpChanged =
    context.created ||
    stableStringify(previousConfigWithoutText) !== stableStringify(nextConfigWithoutText);

  try {
    const convergenceError = await convergePublishedInstanceSurface({
      env,
      account: context.account,
      policy: context.policy,
      publicId,
      widgetType: context.widgetType,
      config: context.currentConfig,
      baseTextPack: textDiff.nextBaseTextPack,
      writeTextPacks: textDiff.textChanged,
      writeConfigPack: configFpChanged,
      context: 'save-published-surface-sync',
    });
    if (convergenceError) {
      return warningResponse({
        published: true,
        changed: true,
        textChanged: textDiff.textChanged,
        publishedSurface: { status: 'failed', detail: convergenceError },
        detail: convergenceError,
      });
    }
  } catch (error) {
    return warningResponse({
      published: true,
      changed: true,
      textChanged: textDiff.textChanged,
      publishedSurface: {
        status: 'failed',
        detail: `[save-published-surface-sync] ${errorDetail(error)}`,
      },
      detail: `[save-published-surface-sync] ${errorDetail(error)}`,
    });
  }

  return Response.json({
    ok: true,
    changed: true,
    textChanged: textDiff.textChanged,
    published: true,
    publishedSurface: { status: 'synced' },
  });
}
