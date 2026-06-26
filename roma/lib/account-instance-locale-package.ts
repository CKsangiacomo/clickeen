import type { NextRequest } from 'next/server';
import {
  compileWidgetForInstancePackage,
  materializeAccountInstanceLocalePublicPackage,
} from './account-instance-public-package';
import {
  deleteAccountInstanceLocalePackageInTokyo,
  loadTokyoAccountInstanceDocument,
  writeAccountInstanceLocalePackageInTokyo,
} from './account-instance-direct';
import { readAccountInstanceTranslationValues } from './account-instance-translations';

type RouteFailure = {
  ok: false;
  status: number;
  error: {
    kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
    reasonKey: string;
    detail?: string;
  };
};

export type LocalePackagePhase =
  | 'source-read'
  | 'compile'
  | 'overlay-read'
  | 'materializer'
  | 'package-write'
  | 'locale-package-delete';

export type LocalePackageCoordinate = {
  accountId: string;
  instanceId: string;
  locale: string;
};

export type LocalePackageMaterializationValue = {
  ok: boolean;
  completed: Array<LocalePackageCoordinate & { publicPackageFingerprint: string }>;
  skipped: Array<LocalePackageCoordinate & { phase: 'not-attempted-after-failure' }>;
  failed?: LocalePackageCoordinate & {
    phase: LocalePackagePhase;
    reasonKey: string;
    detail?: string;
  };
};

export type LocalePackageMaterializationResult =
  | { ok: true; value: LocalePackageMaterializationValue }
  | (RouteFailure & { value: LocalePackageMaterializationValue });

export type LocalePackageActivityEvent = {
  stage: 'package-materializing' | 'locale-completed';
  locale: string;
  completed: number;
  total: number;
  message: string;
};

export function buildLocalePackageMaterializationFailure(args: {
  status: number;
  kind: RouteFailure['error']['kind'];
  reasonKey: string;
  detail?: string;
  completed: LocalePackageMaterializationValue['completed'];
  remainingLocales: string[];
  accountId: string;
  instanceId: string;
  locale: string;
  phase: LocalePackagePhase;
}): LocalePackageMaterializationResult {
  const failed = {
    accountId: args.accountId,
    instanceId: args.instanceId,
    locale: args.locale,
    phase: args.phase,
    reasonKey: args.reasonKey,
    ...(args.detail ? { detail: args.detail } : {}),
  };
  return {
    ok: false,
    status: args.status,
    error: {
      kind: args.kind,
      reasonKey: args.reasonKey,
      ...(args.detail ? { detail: args.detail } : {}),
    },
    value: {
      ok: false,
      completed: args.completed,
      skipped: args.remainingLocales.map((locale) => ({
        accountId: args.accountId,
        instanceId: args.instanceId,
        locale,
        phase: 'not-attempted-after-failure',
      })),
      failed,
    },
  };
}

function uniqueNonBaseLocales(locales: string[], baseLocale: string): string[] {
  return Array.from(new Set(locales.filter((locale) => locale && locale !== baseLocale)));
}

export async function materializeAccountInstanceLocalePackages(args: {
  request: NextRequest;
  accountId: string;
  accountCapsule: string;
  requestId: string;
  instanceId: string;
  baseLocale: string;
  activeLocales: string[];
  onActivity?: (event: LocalePackageActivityEvent) => void;
}): Promise<LocalePackageMaterializationResult> {
  const locales = uniqueNonBaseLocales(args.activeLocales, args.baseLocale);
  const completed: LocalePackageMaterializationValue['completed'] = [];
  if (!locales.length) return { ok: true, value: { ok: true, completed, skipped: [] } };

  const saved = await loadTokyoAccountInstanceDocument({
    accountId: args.accountId,
    instanceId: args.instanceId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!saved.ok) {
    return buildLocalePackageMaterializationFailure({
      status: saved.status,
      kind: saved.error.kind,
      reasonKey: saved.error.reasonKey,
      detail: saved.error.detail,
      completed,
      remainingLocales: locales.slice(1),
      accountId: args.accountId,
      instanceId: args.instanceId,
      locale: locales[0]!,
      phase: 'source-read',
    });
  }
  if (saved.value.row.baseLocale && saved.value.row.baseLocale !== args.baseLocale) {
    return buildLocalePackageMaterializationFailure({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.translations.baseLocaleMismatch',
      detail: `saved:${saved.value.row.baseLocale}:account:${args.baseLocale}`,
      completed,
      remainingLocales: locales.slice(1),
      accountId: args.accountId,
      instanceId: args.instanceId,
      locale: locales[0]!,
      phase: 'source-read',
    });
  }

  const compiled = await compileWidgetForInstancePackage(args.request, saved.value.row.widgetType);
  if (!compiled.ok) {
    return buildLocalePackageMaterializationFailure({
      status: compiled.status,
      kind: compiled.error.kind,
      reasonKey: compiled.error.reasonKey,
      detail: compiled.error.detail,
      completed,
      remainingLocales: locales.slice(1),
      accountId: args.accountId,
      instanceId: args.instanceId,
      locale: locales[0]!,
      phase: 'compile',
    });
  }

  for (const [index, locale] of locales.entries()) {
    const remainingLocales = locales.slice(index + 1);
    args.onActivity?.({
      stage: 'package-materializing',
      locale,
      completed: completed.length,
      total: locales.length,
      message: `Writing ${locale} package.`,
    });
    const overlay = await readAccountInstanceTranslationValues({
      accountId: args.accountId,
      instanceId: args.instanceId,
      locale,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!overlay.ok) {
      return buildLocalePackageMaterializationFailure({
        status: overlay.status,
        kind: overlay.error.kind,
        reasonKey: overlay.error.reasonKey,
        detail: overlay.error.detail,
        completed,
        remainingLocales,
        accountId: args.accountId,
        instanceId: args.instanceId,
        locale,
        phase: 'overlay-read',
      });
    }

    const materialized = await materializeAccountInstanceLocalePublicPackage({
      compiled: compiled.value,
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
      requestedLocale: locale,
      activeLocales: locales,
      displayName: saved.value.row.displayName,
      config: saved.value.config,
      overlayValues: overlay.value.values,
    });
    if (!materialized.ok) {
      return buildLocalePackageMaterializationFailure({
        status: materialized.status,
        kind: materialized.error.kind,
        reasonKey: materialized.error.reasonKey,
        detail: materialized.error.detail,
        completed,
        remainingLocales,
        accountId: args.accountId,
        instanceId: args.instanceId,
        locale,
        phase: 'materializer',
      });
    }

    const stored = await writeAccountInstanceLocalePackageInTokyo({
      accountId: args.accountId,
      instanceId: args.instanceId,
      locale,
      baseLocale: args.baseLocale,
      sourceUpdatedAt: saved.value.row.updatedAt ?? '',
      materializerContractVersion: materialized.value.evidence.materializerContractVersion,
      publicPackage: materialized.value.package,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!stored.ok) {
      return buildLocalePackageMaterializationFailure({
        status: stored.status,
        kind: stored.error.kind,
        reasonKey: stored.error.reasonKey,
        detail: stored.error.detail,
        completed,
        remainingLocales,
        accountId: args.accountId,
        instanceId: args.instanceId,
        locale,
        phase: 'package-write',
      });
    }
    if (stored.value.publicPackageFingerprint !== materialized.value.evidence.generatedPackageFingerprint) {
      return buildLocalePackageMaterializationFailure({
        status: 409,
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.instance.embedNotReady',
        detail: 'locale_package_fingerprint_mismatch',
        completed,
        remainingLocales,
        accountId: args.accountId,
        instanceId: args.instanceId,
        locale,
        phase: 'package-write',
      });
    }
    completed.push({
      accountId: args.accountId,
      instanceId: args.instanceId,
      locale,
      publicPackageFingerprint: stored.value.publicPackageFingerprint,
    });
    args.onActivity?.({
      stage: 'locale-completed',
      locale,
      completed: completed.length,
      total: locales.length,
      message: `${locale} complete.`,
    });
  }

  return { ok: true, value: { ok: true, completed, skipped: [] } };
}

export async function deleteAccountInstanceLocalePackageArtifact(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: LocalePackageCoordinate } | RouteFailure> {
  const deleted = await deleteAccountInstanceLocalePackageInTokyo(args);
  if (!deleted.ok) return deleted;
  return {
    ok: true,
    value: {
      accountId: deleted.value.accountId,
      instanceId: deleted.value.instanceId,
      locale: deleted.value.locale,
    },
  };
}
