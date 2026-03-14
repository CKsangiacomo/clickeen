import { resolvePolicy, type Policy } from '@clickeen/ck-policy';
import type { AccountRow, CuratedInstanceRow, Env, InstanceRow } from '../../shared/types';
import { loadAccountById } from '../../shared/accounts';
import { isTrustedInternalServiceRequest } from '../../shared/auth';
import { mintRomaAccountAuthzCapsule } from '../../shared/authz-capsule';
import { formatCuratedDisplayName, readCuratedMeta } from '../../shared/curated-meta';
import { ckError, errorDetail } from '../../shared/errors';
import { json } from '../../shared/http';
import {
  asTrimmedString,
  assertConfig,
  assertAccountId,
  isRecord,
} from '../../shared/validation';
import {
  assertPublicId,
  isCuratedInstanceRow,
  resolveInstanceAccountId,
} from '../../shared/instances';
import {
  handleAccountInstanceLayerDelete,
  handleAccountInstanceLayerUpsert,
  handleAccountInstanceL10nStatus,
} from '../l10n';
import { loadAccountLocalizationPayload } from '../account-instances/read-handlers';
import {
  loadSavedConfigStateFromTokyo,
  writeSavedConfigToTokyo,
} from '../account-instances/service';
import {
  loadInstanceByAccountAndPublicId,
  resolveWidgetTypeForInstance,
} from '../instances';

const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';
const DEVSTUDIO_CAPSULE_TTL_SEC = 15 * 60;

type DevstudioInstanceContext = {
  account: AccountRow;
  instance: InstanceRow | CuratedInstanceRow;
  ownerAccountId: string;
  widgetType: string;
  savedState: NonNullable<Awaited<ReturnType<typeof loadSavedConfigStateFromTokyo>>>;
  policy: Policy;
};

type LocalizationPayload = Awaited<ReturnType<typeof loadAccountLocalizationPayload>>;

type OverlayEntry = LocalizationPayload['localeOverlays'][number];

function notFoundInstance(): Response {
  return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
}

function validationError(detail: string): Response {
  return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid', detail }, 422);
}

function internalError(detail: string): Response {
  return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
}

function resolveInstanceDisplayName(instance: InstanceRow | CuratedInstanceRow): string {
  if (isCuratedInstanceRow(instance)) {
    return formatCuratedDisplayName(readCuratedMeta(instance.meta), instance.public_id);
  }
  return asTrimmedString(instance.display_name) ?? DEFAULT_INSTANCE_DISPLAY_NAME;
}

async function requireInternalDevstudioPlatformAccount(
  req: Request,
  env: Env,
  accountId: string,
): Promise<{ ok: true; account: AccountRow } | { ok: false; response: Response }> {
  if (!isTrustedInternalServiceRequest(req, env)) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'DENY',
          reasonKey: 'coreui.errors.auth.forbidden',
          detail: 'devstudio_internal_auth_required',
        },
        403,
      ),
    };
  }

  let account: AccountRow | null = null;
  try {
    account = await loadAccountById(env, accountId);
  } catch (error) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.readFailed',
          detail: errorDetail(error),
        },
        500,
      ),
    };
  }

  if (!account) {
    return {
      ok: false,
      response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404),
    };
  }

  if (account.is_platform !== true) {
    return {
      ok: false,
      response: ckError(
        {
          kind: 'DENY',
          reasonKey: 'coreui.errors.auth.forbidden',
          detail: 'devstudio_platform_account_required',
        },
        403,
      ),
    };
  }

  return { ok: true, account };
}

async function loadDevstudioInstanceContext(args: {
  req: Request;
  env: Env;
  accountId: string;
  publicId: string;
}): Promise<{ ok: true; value: DevstudioInstanceContext } | { ok: false; response: Response }> {
  const accountResult = await requireInternalDevstudioPlatformAccount(args.req, args.env, args.accountId);
  if (!accountResult.ok) return accountResult;
  const account = accountResult.account;

  let instance: InstanceRow | CuratedInstanceRow | null = null;
  try {
    instance = await loadInstanceByAccountAndPublicId(args.env, account.id, args.publicId);
  } catch (error) {
    return { ok: false, response: internalError(errorDetail(error)) };
  }
  if (!instance) {
    return { ok: false, response: notFoundInstance() };
  }

  if (isCuratedInstanceRow(instance)) {
    const curatedOwnerAccountId = asTrimmedString(instance.owner_account_id);
    if (curatedOwnerAccountId !== account.id) {
      return { ok: false, response: notFoundInstance() };
    }
  }

  const ownerAccountId = resolveInstanceAccountId(instance) ?? account.id;

  let savedState: Awaited<ReturnType<typeof loadSavedConfigStateFromTokyo>> = null;
  try {
    savedState = await loadSavedConfigStateFromTokyo({
      env: args.env,
      accountId: ownerAccountId,
      publicId: args.publicId,
    });
  } catch (error) {
    return { ok: false, response: internalError(errorDetail(error)) };
  }
  if (!savedState) {
    return { ok: false, response: notFoundInstance() };
  }

  let widgetType: string | null = null;
  try {
    widgetType = await resolveWidgetTypeForInstance(args.env, instance, savedState.widgetType);
  } catch (error) {
    return { ok: false, response: internalError(errorDetail(error)) };
  }
  if (!widgetType) {
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500),
    };
  }

  return {
    ok: true,
    value: {
      account,
      instance,
      ownerAccountId,
      widgetType,
      savedState,
      policy: resolvePolicy({ profile: account.tier, role: 'owner' }),
    },
  };
}

function withLocalizationOverlayDefaults(localization: LocalizationPayload): LocalizationPayload {
  const localeSet = new Set<string>();
  const baseLocale = asTrimmedString(localization.policy?.baseLocale) ?? 'en';
  localeSet.add(baseLocale);
  localization.accountLocales.forEach((locale) => {
    const normalized = asTrimmedString(locale);
    if (normalized) localeSet.add(normalized);
  });

  const overlaysByLocale = new Map<string, OverlayEntry>();
  localization.localeOverlays.forEach((entry) => {
    const locale = asTrimmedString(entry.locale);
    if (!locale) return;
    overlaysByLocale.set(locale, entry);
    localeSet.add(locale);
  });

  const localeOverlays = Array.from(localeSet)
    .sort((a, b) => a.localeCompare(b))
    .map((locale) => {
      const existing = overlaysByLocale.get(locale);
      if (existing) return existing;
      return {
        locale,
        source: null,
        baseFingerprint: null,
        baseUpdatedAt: null,
        hasUserOps: false,
        baseOps: [],
        userOps: [],
      } satisfies OverlayEntry;
    });

  return {
    ...localization,
    accountLocales: Array.from(localeSet).sort((a, b) => a.localeCompare(b)),
    localeOverlays,
  };
}

async function mintInternalOwnerCapsule(env: Env, account: AccountRow): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const capsule = await mintRomaAccountAuthzCapsule(env, {
    sub: 'devstudio.local',
    userId: 'devstudio.local',
    accountId: account.id,
    accountStatus: asTrimmedString(account.status) ?? 'active',
    accountIsPlatform: account.is_platform === true,
    accountName: account.name,
    accountSlug: account.slug,
    accountWebsiteUrl: account.website_url,
    accountL10nLocales: account.l10n_locales,
    accountL10nPolicy: account.l10n_policy,
    role: 'owner',
    profile: account.tier,
    authzVersion: `devstudio.local:${account.id}:owner`,
    iat: nowSec,
    exp: nowSec + DEVSTUDIO_CAPSULE_TTL_SEC,
  });
  return capsule.token;
}

async function buildInternalDevstudioAccountRequest(args: {
  req: Request;
  env: Env;
  account: AccountRow;
  method: 'GET' | 'PUT' | 'DELETE';
  body?: string;
}): Promise<Request> {
  const url = new URL(args.req.url);
  url.searchParams.set('subject', 'account');
  const headers = new Headers({
    authorization: `Bearer ${args.env.PARIS_DEV_JWT}`,
    'x-ck-internal-service': 'devstudio.local',
    'x-ck-authz-capsule': await mintInternalOwnerCapsule(args.env, args.account),
    accept: 'application/json',
  });
  if (typeof args.body === 'string') {
    headers.set('content-type', 'application/json');
  }
  return new Request(url.toString(), {
    method: args.method,
    headers,
    body: args.body,
  });
}

function readAccountAndPublicId(url: URL):
  | { ok: true; accountId: string; publicId: string }
  | { ok: false; response: Response } {
  const accountIdResult = assertAccountId(url.searchParams.get('accountId'));
  if (!accountIdResult.ok) return { ok: false, response: accountIdResult.response };

  const publicIdResult = assertPublicId(url.searchParams.get('publicId'));
  if (!publicIdResult.ok) {
    return {
      ok: false,
      response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422),
    };
  }

  return {
    ok: true,
    accountId: accountIdResult.value,
    publicId: publicIdResult.value,
  };
}

export async function handleInternalDevstudioInstance(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const parsed = readAccountAndPublicId(url);
  if (!parsed.ok) return parsed.response;

  if (req.method === 'GET') {
    const context = await loadDevstudioInstanceContext({
      req,
      env,
      accountId: parsed.accountId,
      publicId: parsed.publicId,
    });
    if (!context.ok) return context.response;

    const { account, instance, ownerAccountId, widgetType, savedState, policy } = context.value;

    return json({
      publicId: parsed.publicId,
      displayName: resolveInstanceDisplayName(instance),
      ownerAccountId,
      widgetType,
      status: instance.status,
      meta: null,
      config: savedState.config,
      policy,
      accountId: account.id,
    });
  }

  if (req.method === 'PUT') {
    const context = await loadDevstudioInstanceContext({
      req,
      env,
      accountId: parsed.accountId,
      publicId: parsed.publicId,
    });
    if (!context.ok) return context.response;

    let payload: unknown = null;
    try {
      payload = await req.json();
    } catch {
      payload = null;
    }
    if (!isRecord(payload)) {
      return validationError('payload must be an object');
    }
    const configResult = assertConfig(payload.config);
    if (!configResult.ok) {
      return validationError(configResult.issues[0]?.message || 'config must be an object');
    }

    try {
      await writeSavedConfigToTokyo({
        env,
        accountId: context.value.ownerAccountId,
        publicId: parsed.publicId,
        widgetType: context.value.widgetType,
        config: configResult.value,
      });
    } catch (error) {
      return internalError(errorDetail(error));
    }

    let nextSavedState: Awaited<ReturnType<typeof loadSavedConfigStateFromTokyo>> = null;
    try {
      nextSavedState = await loadSavedConfigStateFromTokyo({
        env,
        accountId: context.value.ownerAccountId,
        publicId: parsed.publicId,
      });
    } catch (error) {
      return internalError(errorDetail(error));
    }
    if (!nextSavedState) {
      return internalError('devstudio_saved_config_missing_after_write');
    }

    return json({
      config: nextSavedState.config,
      aftermath: null,
    });
  }

  return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.method.notAllowed' }, 405);
}

export async function handleInternalDevstudioInstanceLocalization(
  req: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(req.url);
  const parsed = readAccountAndPublicId(url);
  if (!parsed.ok) return parsed.response;

  const context = await loadDevstudioInstanceContext({
    req,
    env,
    accountId: parsed.accountId,
    publicId: parsed.publicId,
  });
  if (!context.ok) return context.response;

  try {
    const localization = await loadAccountLocalizationPayload({
      env,
      publicId: parsed.publicId,
      accountLocalesRaw: context.value.account.l10n_locales,
      accountL10nPolicyRaw: context.value.account.l10n_policy,
      policy: context.value.policy,
    });
    return json({ localization: withLocalizationOverlayDefaults(localization) });
  } catch (error) {
    return internalError(errorDetail(error));
  }
}

export async function handleInternalDevstudioInstanceL10nStatus(
  req: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(req.url);
  const parsed = readAccountAndPublicId(url);
  if (!parsed.ok) return parsed.response;

  const accountResult = await requireInternalDevstudioPlatformAccount(req, env, parsed.accountId);
  if (!accountResult.ok) return accountResult.response;

  const internalReq = await buildInternalDevstudioAccountRequest({
    req,
    env,
    account: accountResult.account,
    method: 'GET',
  });
  return handleAccountInstanceL10nStatus(internalReq, env, parsed.accountId, parsed.publicId);
}

export async function handleInternalDevstudioUserLayer(
  req: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(req.url);
  const parsed = readAccountAndPublicId(url);
  if (!parsed.ok) return parsed.response;
  const locale = asTrimmedString(url.searchParams.get('locale'));
  if (!locale) {
    return validationError('locale is required');
  }

  const accountResult = await requireInternalDevstudioPlatformAccount(req, env, parsed.accountId);
  if (!accountResult.ok) return accountResult.response;

  const body = req.method === 'PUT' ? await req.text() : undefined;
  const internalReq = await buildInternalDevstudioAccountRequest({
    req,
    env,
    account: accountResult.account,
    method: req.method === 'DELETE' ? 'DELETE' : 'PUT',
    body,
  });

  if (req.method === 'PUT') {
    return handleAccountInstanceLayerUpsert(
      internalReq,
      env,
      parsed.accountId,
      parsed.publicId,
      'user',
      locale,
    );
  }

  if (req.method === 'DELETE') {
    return handleAccountInstanceLayerDelete(
      internalReq,
      env,
      parsed.accountId,
      parsed.publicId,
      'user',
      locale,
    );
  }

  return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.method.notAllowed' }, 405);
}
