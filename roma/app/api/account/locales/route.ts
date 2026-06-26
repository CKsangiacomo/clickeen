import { NextRequest, NextResponse } from 'next/server';
import {
  isRecord,
  parseAccountLocaleListStrict,
  parseAccountLocalePolicyStrict,
  validateAccountLocaleList,
  validateAccountLocalePolicy,
} from '@clickeen/ck-contracts';
import { resolvePolicy } from '@clickeen/ck-policy';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { listAccountInstancesInTokyo } from '@roma/lib/account-instance-direct';
import {
  deleteAccountInstanceLocalePackageArtifact,
  materializeAccountInstanceLocalePackages,
  type LocalePackagePhase,
  type LocalePackageMaterializationValue,
} from '@roma/lib/account-instance-locale-package';
import { buildLocalePackageDeleteFailureCoordinate } from '@roma/lib/account-locale-overlay-update';
import {
  deleteAccountInstanceTranslationValues,
  generateAccountInstanceTranslations,
} from '@roma/lib/account-instance-translations';
import { loadAccountBaseLocaleLockState } from '@roma/lib/account-base-locale-lock';
import {
  ACCOUNT_ACTIVE_LOCALES_PATCH_SELECT,
  buildAccountActiveLocalesPatch,
  readAccountActiveLocalesPatch,
  type AccountActiveLocalesPatchRow,
} from '@roma/lib/account-active-locales-storage';
import { enforceActiveLocaleEntitlement } from '@roma/lib/account-locale-entitlements';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

type AccountLocalesWritePayload = {
  activeLocales?: unknown;
  localePolicy?: unknown;
};

type LocaleOverlayUpdateError = {
  kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  reasonKey: string;
  detail?: string;
};

type LocaleOverlayUpdateFailure = {
  ok: false;
  status: number;
  error: LocaleOverlayUpdateError;
  value?: LocaleOverlayUpdateValue;
};

type LocaleOverlayUpdateValue = {
  ok: boolean;
  instancesChecked: number;
  cost: {
    instances: number;
    changedLocales: number;
    coordinates: number;
    configuredActiveLocaleCap: number | null;
    hostCommandTimeoutMs: 120000;
  };
  deleted: Array<{ instanceId: string; locale: string }>;
  generated: Array<{ instanceId: string; locales: string[] }>;
  skipped: Array<{ instanceId: string; locales: string[]; reasonKey: string; detail?: string }>;
  localePackages: {
    deleted: Array<{ accountId: string; instanceId: string; locale: string }>;
    generated: LocalePackageMaterializationValue['completed'];
    skipped: LocalePackageMaterializationValue['skipped'];
    failed?: NonNullable<LocalePackageMaterializationValue['failed']>;
  };
  failed?: {
    accountId: string;
    instanceId: string;
    locale: string;
    phase:
      | 'translation-delete'
      | 'translation-generation'
      | 'locale-package-materialize'
      | LocalePackagePhase;
    reasonKey: string;
    detail?: string;
  };
  error?: LocaleOverlayUpdateError;
};

function resolveSupabaseAdminConfig(): { baseUrl: string; serviceRoleKey: string } {
  const baseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('roma.errors.account.locales.supabase_admin_config_missing');
  }
  return { baseUrl, serviceRoleKey };
}

async function supabaseAdminFetch(pathnameWithQuery: string, init?: RequestInit): Promise<Response> {
  const config = resolveSupabaseAdminConfig();
  const headers = new Headers(init?.headers);
  headers.set('apikey', config.serviceRoleKey);
  headers.set('authorization', `Bearer ${config.serviceRoleKey}`);
  headers.set('accept', 'application/json');
  if (!headers.has('content-type') && init?.body) headers.set('content-type', 'application/json');

  return fetch(`${config.baseUrl}${pathnameWithQuery}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function resolveDbErrorDetail(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  const message = payload.message ?? payload.error_description ?? payload.error;
  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

function localeOverlayFailure(args: {
  status: number;
  kind: LocaleOverlayUpdateError['kind'];
  reasonKey: string;
  detail: string;
  value?: Omit<LocaleOverlayUpdateValue, 'ok' | 'error'>;
}): LocaleOverlayUpdateFailure {
  const error: LocaleOverlayUpdateError = {
    kind: args.kind,
    reasonKey: args.reasonKey,
    detail: args.detail,
  };
  return {
    ok: false,
    status: args.status,
    error,
    ...(args.value ? { value: { ...args.value, ok: false, error } } : {}),
  };
}

function emptyOverlayUpdate(): LocaleOverlayUpdateValue {
  return {
    ok: true,
    instancesChecked: 0,
    cost: {
      instances: 0,
      changedLocales: 0,
      coordinates: 0,
      configuredActiveLocaleCap: null,
      hostCommandTimeoutMs: 120000,
    },
    deleted: [],
    generated: [],
    skipped: [],
    localePackages: {
      deleted: [],
      generated: [],
      skipped: [],
    },
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveActiveLocaleDelta(args: {
  previousActiveLocales: string[];
  nextActiveLocales: string[];
  baseLocale: string;
}): {
  addedLocales: string[];
  removedLocales: string[];
} {
  const previousActiveLocales = Array.from(
    new Set(args.previousActiveLocales.filter((locale) => locale !== args.baseLocale)),
  );
  const nextActiveLocales = Array.from(new Set(args.nextActiveLocales.filter((locale) => locale !== args.baseLocale)));
  const previousActiveSet = new Set(previousActiveLocales);
  const nextActiveSet = new Set(nextActiveLocales);
  return {
    addedLocales: nextActiveLocales.filter((locale) => !previousActiveSet.has(locale)),
    removedLocales: previousActiveLocales.filter((locale) => !nextActiveSet.has(locale)),
  };
}

function mergeOverlayUpdates(left: LocaleOverlayUpdateValue, right: LocaleOverlayUpdateValue): LocaleOverlayUpdateValue {
  return {
    instancesChecked: Math.max(left.instancesChecked, right.instancesChecked),
    cost: {
      instances: Math.max(left.cost.instances, right.cost.instances),
      changedLocales: Math.max(left.cost.changedLocales, right.cost.changedLocales),
      coordinates: left.cost.coordinates + right.cost.coordinates,
      configuredActiveLocaleCap: right.cost.configuredActiveLocaleCap ?? left.cost.configuredActiveLocaleCap,
      hostCommandTimeoutMs: 120000,
    },
    deleted: [...left.deleted, ...right.deleted],
    generated: [...left.generated, ...right.generated],
    skipped: [...left.skipped, ...right.skipped],
    localePackages: {
      deleted: [...left.localePackages.deleted, ...right.localePackages.deleted],
      generated: [...left.localePackages.generated, ...right.localePackages.generated],
      skipped: [...left.localePackages.skipped, ...right.localePackages.skipped],
      ...(right.localePackages.failed
        ? { failed: right.localePackages.failed }
        : left.localePackages.failed
          ? { failed: left.localePackages.failed }
          : {}),
    },
    ok: left.ok && right.ok,
    ...(right.error ? { error: right.error } : left.error ? { error: left.error } : {}),
  };
}

async function reconcileAccountLocaleOverlays(args: {
  request: NextRequest;
  accountId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
  addedLocales: string[];
  removedLocales: string[];
  baseLocale: string;
  configuredActiveLocaleCap: number | null;
  authz: Parameters<typeof generateAccountInstanceTranslations>[0]['authz'];
}): Promise<
  | {
      ok: true;
      value: LocaleOverlayUpdateValue;
    }
  | LocaleOverlayUpdateFailure
> {
  const removedLocales = Array.from(new Set(args.removedLocales.filter((locale) => locale !== args.baseLocale)));
  const addedLocales = Array.from(new Set(args.addedLocales.filter((locale) => locale !== args.baseLocale)));

  if (removedLocales.length === 0 && addedLocales.length === 0) {
    return { ok: true, value: emptyOverlayUpdate() };
  }

  const instances = await listAccountInstancesInTokyo({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!instances.ok) return instances;
  const changedLocaleCount = addedLocales.length + removedLocales.length;
  const cost: LocaleOverlayUpdateValue['cost'] = {
    instances: instances.value.accountInstances.length,
    changedLocales: changedLocaleCount,
    coordinates: instances.value.accountInstances.length * changedLocaleCount,
    configuredActiveLocaleCap: args.configuredActiveLocaleCap,
    hostCommandTimeoutMs: 120000,
  };

  const deleted: Array<{ instanceId: string; locale: string }> = [];
  const generated: Array<{ instanceId: string; locales: string[] }> = [];
  const skipped: Array<{ instanceId: string; locales: string[]; reasonKey: string; detail?: string }> = [];
  const localePackages: LocaleOverlayUpdateValue['localePackages'] = {
    deleted: [],
    generated: [],
    skipped: [],
  };
  let instancesChecked = 0;

  for (const instance of instances.value.accountInstances) {
    instancesChecked += 1;
    for (const locale of removedLocales) {
      const result = await deleteAccountInstanceTranslationValues({
        accountId: args.accountId,
        instanceId: instance.instanceId,
        locale,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      });
      if (!result.ok) {
        return localeOverlayFailure({
          status: result.status,
          kind: result.error.kind,
          reasonKey: result.error.reasonKey,
          detail: `delete:${instance.instanceId}:${locale}:${result.error.detail ?? result.error.reasonKey}`,
          value: {
            instancesChecked,
            cost,
            deleted,
            generated,
            skipped,
            localePackages,
            failed: {
              accountId: args.accountId,
              instanceId: instance.instanceId,
              locale,
              phase: 'translation-delete',
              reasonKey: result.error.reasonKey,
              ...(result.error.detail ? { detail: result.error.detail } : {}),
            },
          },
        });
      }
      deleted.push({ instanceId: instance.instanceId, locale });
      const packageDelete = await deleteAccountInstanceLocalePackageArtifact({
        accountId: args.accountId,
        instanceId: instance.instanceId,
        locale,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      });
      if (!packageDelete.ok) {
        const packageFailure = buildLocalePackageDeleteFailureCoordinate({
          accountId: args.accountId,
          instanceId: instance.instanceId,
          locale,
          reasonKey: packageDelete.error.reasonKey,
          ...(packageDelete.error.detail ? { detail: packageDelete.error.detail } : {}),
        });
        return localeOverlayFailure({
          status: packageDelete.status,
          kind: packageDelete.error.kind,
          reasonKey: packageDelete.error.reasonKey,
          detail: `locale-package-delete:${instance.instanceId}:${locale}:${packageDelete.error.detail ?? packageDelete.error.reasonKey}`,
          value: {
            instancesChecked,
            cost,
            deleted,
            generated,
            skipped,
            localePackages: {
              ...localePackages,
              failed: packageFailure,
            },
            failed: {
              accountId: args.accountId,
              instanceId: instance.instanceId,
              locale,
              phase: packageFailure.phase,
              reasonKey: packageDelete.error.reasonKey,
              ...(packageDelete.error.detail ? { detail: packageDelete.error.detail } : {}),
            },
          },
        });
      }
      localePackages.deleted.push(packageDelete.value);
    }

    if (addedLocales.length === 0) continue;

    for (const locale of addedLocales) {
      const generation = await generateAccountInstanceTranslations({
        accountId: args.accountId,
        instanceId: instance.instanceId,
        baseLocale: args.baseLocale,
        activeLocales: [locale],
        authz: args.authz,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      });
      if (!generation.ok) {
        if (generation.error.detail === 'saved_instance_has_no_translatable_fields') {
          skipped.push({
            instanceId: instance.instanceId,
            locales: [locale],
            reasonKey: generation.error.reasonKey,
            detail: generation.error.detail,
          });
          continue;
        }
        return localeOverlayFailure({
          status: generation.status,
          kind: generation.error.kind,
          reasonKey: generation.error.reasonKey,
          detail: `generate:${instance.instanceId}:${locale}:${generation.error.detail ?? generation.error.reasonKey}`,
          value: {
            instancesChecked,
            cost,
            deleted,
            generated,
            skipped,
            localePackages,
            failed: {
              accountId: args.accountId,
              instanceId: instance.instanceId,
              locale,
              phase: 'translation-generation',
              reasonKey: generation.error.reasonKey,
              ...(generation.error.detail ? { detail: generation.error.detail } : {}),
            },
          },
        });
      }
      if (!generation.value.translation.accepted) {
        skipped.push({
          instanceId: instance.instanceId,
          locales: [locale],
          reasonKey: 'coreui.errors.translation.noActiveLocales',
          detail: 'not_accepted',
        });
        continue;
      }
      const packageMaterialization = await materializeAccountInstanceLocalePackages({
        request: args.request,
        accountId: args.accountId,
        instanceId: instance.instanceId,
        baseLocale: args.baseLocale,
        activeLocales: generation.value.translation.activeLocales,
        accountCapsule: args.accountCapsule ?? '',
        requestId: args.requestId ?? '',
      });
      localePackages.generated.push(...packageMaterialization.value.completed);
      localePackages.skipped.push(...packageMaterialization.value.skipped);
      if (!packageMaterialization.ok) {
        return localeOverlayFailure({
          status: packageMaterialization.status,
          kind: packageMaterialization.error.kind,
          reasonKey: packageMaterialization.error.reasonKey,
          detail: `locale-package-materialize:${packageMaterialization.value.failed?.instanceId ?? instance.instanceId}:${packageMaterialization.value.failed?.locale ?? locale}:${packageMaterialization.value.failed?.phase ?? 'unknown'}:${packageMaterialization.error.detail ?? packageMaterialization.error.reasonKey}`,
          value: {
            instancesChecked,
            cost,
            deleted,
            generated,
            skipped,
            localePackages: {
              ...localePackages,
              ...(packageMaterialization.value.failed ? { failed: packageMaterialization.value.failed } : {}),
            },
            failed: {
              accountId: args.accountId,
              instanceId: instance.instanceId,
              locale: packageMaterialization.value.failed?.locale ?? locale,
              phase: packageMaterialization.value.failed?.phase ?? 'locale-package-materialize',
              reasonKey: packageMaterialization.error.reasonKey,
              ...(packageMaterialization.error.detail ? { detail: packageMaterialization.error.detail } : {}),
            },
          },
        });
      }
      generated.push({ instanceId: instance.instanceId, locales: generation.value.translation.activeLocales });
    }
  }

  return {
    ok: true,
    value: {
      ok: true,
      instancesChecked,
      cost,
      deleted,
      generated,
      skipped,
      localePackages,
    },
  };
}

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  try {
    const accountState = await loadCurrentAccountLocalesState({
      accessToken: current.value.accessToken,
      accountId: current.value.authzPayload.accountId,
      requestId: current.value.requestId,
    });
    if (!accountState.ok) {
      return withSession(
        request,
        NextResponse.json(
          accountState.payload ?? {
            error: {
              kind: accountState.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
              reasonKey:
                accountState.status === 401
                  ? 'coreui.errors.auth.required'
                  : 'coreui.errors.auth.contextUnavailable',
            },
          },
          { status: accountState.status },
        ),
        current.value.setCookies,
      );
    }

    const baseLocaleLock = await loadAccountBaseLocaleLockState({
      accountId: current.value.authzPayload.accountPublicId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    });
    if (!baseLocaleLock.ok) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: baseLocaleLock.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
              reasonKey:
                baseLocaleLock.status === 401
                  ? 'coreui.errors.auth.required'
                  : 'coreui.errors.auth.contextUnavailable',
              detail: baseLocaleLock.detail,
            },
          },
          { status: baseLocaleLock.status },
        ),
        current.value.setCookies,
      );
    }

    return withSession(
      request,
      NextResponse.json({
        accountId: current.value.authzPayload.accountId,
        activeLocales: accountState.activeLocales,
        localePolicy: accountState.localePolicy,
        baseLocaleLocked: baseLocaleLock.locked,
      }),
      current.value.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }
}

export async function PUT(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'admin' });
  if (!current.ok) return current.response;

  try {
    const bodyResult = await readJsonPayloadOrValidation<AccountLocalesWritePayload | null>(request);
    if (!bodyResult.ok) {
      return withSession(
        request,
        NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
        current.value.setCookies,
      );
    }
    const body = bodyResult.payload;

    if (!isRecord(body)) {
      return withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
          { status: 422 },
        ),
        current.value.setCookies,
      );
    }

    const localeIssues = validateAccountLocaleList(body.activeLocales, 'activeLocales');
    if (localeIssues.length) {
      return withSession(request, NextResponse.json(localeIssues, { status: 422 }), current.value.setCookies);
    }

    const policyIssues = validateAccountLocalePolicy(body.localePolicy, 'localePolicy');
    if (policyIssues.length) {
      return withSession(request, NextResponse.json(policyIssues, { status: 422 }), current.value.setCookies);
    }

    const activeLocales = parseAccountLocaleListStrict(body.activeLocales);
    const localePolicy = parseAccountLocalePolicyStrict(body.localePolicy);
    const baseLocale = normalizeLocaleToken(localePolicy.baseLocale);
    if (!baseLocale) {
      return withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
          { status: 422 },
        ),
        current.value.setCookies,
      );
    }

    const policy = resolvePolicy({
      profile: current.value.authzPayload.profile,
      role: current.value.authzPayload.role,
    });
    const activeLocaleCapRaw = policy.limits['l10n.locales.max'];
    const activeLocaleCap =
      typeof activeLocaleCapRaw === 'number' && Number.isFinite(activeLocaleCapRaw)
        ? Math.max(0, Math.floor(activeLocaleCapRaw))
        : null;
    const entitlementGate = enforceActiveLocaleEntitlement(policy, activeLocales);
    if (entitlementGate) return withSession(request, entitlementGate, current.value.setCookies);

    const accountState = await loadCurrentAccountLocalesState({
      accessToken: current.value.accessToken,
      accountId: current.value.authzPayload.accountId,
      requestId: current.value.requestId,
    });
    if (!accountState.ok) {
      return withSession(
        request,
        NextResponse.json(
          accountState.payload ?? {
            error: {
              kind: accountState.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
              reasonKey:
                accountState.status === 401
                  ? 'coreui.errors.auth.required'
                  : 'coreui.errors.auth.contextUnavailable',
            },
          },
          { status: accountState.status },
        ),
        current.value.setCookies,
      );
    }

    const baseLocaleLock = await loadAccountBaseLocaleLockState({
      accountId: current.value.authzPayload.accountPublicId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    });
    if (!baseLocaleLock.ok) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: baseLocaleLock.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
              reasonKey:
                baseLocaleLock.status === 401
                  ? 'coreui.errors.auth.required'
                  : 'coreui.errors.auth.contextUnavailable',
              detail: baseLocaleLock.detail,
            },
          },
          { status: baseLocaleLock.status },
        ),
        current.value.setCookies,
      );
    }
    if (baseLocaleLock.locked && baseLocale !== accountState.localePolicy.baseLocale) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'VALIDATION',
              reasonKey: 'coreui.errors.account.locales.baseLocaleLocked',
            },
          },
          { status: 422 },
        ),
        current.value.setCookies,
      );
    }

    const activeDelta = resolveActiveLocaleDelta({
      previousActiveLocales: accountState.activeLocales,
      nextActiveLocales: activeLocales,
      baseLocale,
    });
    const settingsUnchanged =
      activeDelta.addedLocales.length === 0 &&
      activeDelta.removedLocales.length === 0 &&
      sameJson(localePolicy, accountState.localePolicy);

    if (settingsUnchanged) {
      return withSession(
        request,
        NextResponse.json({
          accountId: current.value.authzPayload.accountId,
          activeLocales: accountState.activeLocales,
          localePolicy: accountState.localePolicy,
          overlayUpdate: emptyOverlayUpdate(),
        }),
        current.value.setCookies,
      );
    }

    const params = new URLSearchParams({
      id: `eq.${current.value.authzPayload.accountId}`,
      select: ACCOUNT_ACTIVE_LOCALES_PATCH_SELECT,
    });
    const upstream = await supabaseAdminFetch(`/rest/v1/accounts?${params.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(buildAccountActiveLocalesPatch({ activeLocales, localePolicy })),
    });
    const upstreamPayload = await readJson(upstream);
    if (!upstream.ok) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey: 'coreui.errors.db.writeFailed',
              detail: resolveDbErrorDetail(upstreamPayload, `supabase_status_${upstream.status}`),
            },
          },
          { status: 502 },
        ),
        current.value.setCookies,
      );
    }
    if (!Array.isArray(upstreamPayload)) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey: 'coreui.errors.db.writeFailed',
              detail: 'account_locale_patch_payload_invalid',
            },
          },
          { status: 502 },
        ),
        current.value.setCookies,
      );
    }

    const patchedRow = upstreamPayload[0] as AccountActiveLocalesPatchRow | undefined;
    if (!isRecord(patchedRow) || patchedRow.id !== current.value.authzPayload.accountId) {
      return withSession(
        request,
        NextResponse.json(
          { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' } },
          { status: 404 },
        ),
        current.value.setCookies,
      );
    }

    let overlayUpdate = emptyOverlayUpdate();
    if (activeDelta.addedLocales.length > 0 || activeDelta.removedLocales.length > 0) {
      const pendingOverlayUpdate = await reconcileAccountLocaleOverlays({
        request,
        accountId: current.value.authzPayload.accountPublicId,
        accountCapsule: current.value.authzToken,
        requestId: current.value.requestId,
        addedLocales: activeDelta.addedLocales,
        removedLocales: activeDelta.removedLocales,
        baseLocale,
        configuredActiveLocaleCap: activeLocaleCap,
        authz: current.value.authzPayload,
      });
      if (pendingOverlayUpdate.ok) {
        overlayUpdate = mergeOverlayUpdates(overlayUpdate, pendingOverlayUpdate.value);
      } else {
        overlayUpdate = pendingOverlayUpdate.value ?? {
          ...emptyOverlayUpdate(),
          ok: false,
          error: pendingOverlayUpdate.error,
        };
      }
    }

    return withSession(
      request,
      NextResponse.json({
        accountId: current.value.authzPayload.accountId,
        ...readAccountActiveLocalesPatch(patchedRow),
        overlayUpdate,
      }),
      current.value.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }
}
