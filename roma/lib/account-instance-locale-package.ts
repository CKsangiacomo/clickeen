import {
  prepareAccountInstancePublicPackage,
  readWidgetForInstancePackage,
  materializeAccountInstanceLocalePublicPackage,
} from './account-instance-public-package';
import {
  deleteAccountInstanceLocalePackageInTokyo,
  loadTokyoAccountInstanceDocument,
  writeAccountInstanceLocalePackageInTokyo,
} from './account-instance-direct';
import { readAccountInstanceTranslationValues } from './account-instance-translations';

const LOCALE_PACKAGE_CONCURRENCY = 4;

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
  | 'cache-refresh'
  | 'locale-package-delete';

export type LocalePackageCoordinate = {
  accountId: string;
  instanceId: string;
  locale: string;
};

export type LocalePackageMaterializationValue = {
  ok: boolean;
  completed: Array<LocalePackageCoordinate & { publicPackageFingerprint: string }>;
  failed: Array<LocalePackageCoordinate & {
    phase: LocalePackagePhase;
    reasonKey: string;
    detail?: string;
  }>;
};

export type LocalePackageMaterializationResult =
  | { ok: true; value: LocalePackageMaterializationValue }
  | (RouteFailure & { value: LocalePackageMaterializationValue });

export function buildLocalePackageMaterializationFailure(args: {
  status: number;
  kind: RouteFailure['error']['kind'];
  reasonKey: string;
  detail?: string;
  locales: string[];
  accountId: string;
  instanceId: string;
  phase: LocalePackagePhase;
}): LocalePackageMaterializationResult {
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
      completed: [],
      failed: args.locales.map((locale) => ({
        accountId: args.accountId,
        instanceId: args.instanceId,
        locale,
        phase: args.phase,
        reasonKey: args.reasonKey,
        ...(args.detail ? { detail: args.detail } : {}),
      })),
    },
  };
}

function uniqueNonBaseLocales(locales: string[], baseLocale: string): string[] {
  return Array.from(new Set(locales.filter((locale) => locale && locale !== baseLocale)));
}

export async function runLocalePackagePool<T>(args: {
  locales: string[];
  run: (locale: string) => Promise<T>;
  onUnexpectedError: (locale: string, error: unknown) => T;
}): Promise<T[]> {
  const results = new Array<T>(args.locales.length);
  let nextLocaleIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(LOCALE_PACKAGE_CONCURRENCY, args.locales.length) }, async () => {
      while (nextLocaleIndex < args.locales.length) {
        const index = nextLocaleIndex++;
        const locale = args.locales[index]!;
        try {
          results[index] = await args.run(locale);
        } catch (error) {
          results[index] = args.onUnexpectedError(locale, error);
        }
      }
    }),
  );
  return results;
}

export function localePackagePhaseFromRouteFailure(
  error: RouteFailure['error'],
  defaultPhase: LocalePackagePhase,
): LocalePackagePhase {
  return error.reasonKey.startsWith('tokyo.errors.publicCache.') ? 'cache-refresh' : defaultPhase;
}

export async function materializeAccountInstanceLocalePackages(args: {
  accountId: string;
  accountCapsule: string;
  requestId: string;
  instanceId: string;
  baseLocale: string;
  activeLocales: string[];
}): Promise<LocalePackageMaterializationResult> {
  const locales = uniqueNonBaseLocales(args.activeLocales, args.baseLocale);
  if (!locales.length) return { ok: true, value: { ok: true, completed: [], failed: [] } };

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
      locales,
      accountId: args.accountId,
      instanceId: args.instanceId,
      phase: 'source-read',
    });
  }
  if (saved.value.row.baseLocale && saved.value.row.baseLocale !== args.baseLocale) {
    return buildLocalePackageMaterializationFailure({
      status: 422,
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.translations.baseLocaleMismatch',
      detail: `saved:${saved.value.row.baseLocale}:account:${args.baseLocale}`,
      locales,
      accountId: args.accountId,
      instanceId: args.instanceId,
      phase: 'source-read',
    });
  }

  const compiled = readWidgetForInstancePackage(saved.value.row.widgetType);
  if (!compiled.ok) {
    return buildLocalePackageMaterializationFailure({
      status: compiled.status,
      kind: compiled.error.kind,
      reasonKey: compiled.error.reasonKey,
      detail: compiled.error.detail,
      locales,
      accountId: args.accountId,
      instanceId: args.instanceId,
      phase: 'compile',
    });
  }

  const prepared = await prepareAccountInstancePublicPackage({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
    config: saved.value.config,
  });
  if (!prepared.ok) {
    return buildLocalePackageMaterializationFailure({
      status: prepared.status,
      kind: prepared.error.kind,
      reasonKey: prepared.error.reasonKey,
      detail: prepared.error.detail,
      locales,
      accountId: args.accountId,
      instanceId: args.instanceId,
      phase: 'materializer',
    });
  }

  type LocaleResult =
    | {
        ok: true;
        completed: LocalePackageMaterializationValue['completed'][number];
      }
    | {
        ok: false;
        status: number;
        error: RouteFailure['error'];
        failed: LocalePackageMaterializationValue['failed'][number];
      };

  const failLocale = (locale: string, result: {
    status: number;
    error: RouteFailure['error'];
    phase: LocalePackagePhase;
  }): LocaleResult => ({
    ok: false,
    status: result.status,
    error: result.error,
    failed: {
      accountId: args.accountId,
      instanceId: args.instanceId,
      locale,
      phase: result.phase,
      reasonKey: result.error.reasonKey,
      ...(result.error.detail ? { detail: result.error.detail } : {}),
    },
  });

  const materializeLocale = async (locale: string): Promise<LocaleResult> => {
    const overlay = await readAccountInstanceTranslationValues({
      accountId: args.accountId,
      instanceId: args.instanceId,
      locale,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!overlay.ok) {
      return failLocale(locale, {
        status: overlay.status,
        error: overlay.error,
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
      prepared: prepared.value,
    });
    if (!materialized.ok) {
      return failLocale(locale, {
        status: materialized.status,
        error: materialized.error,
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
      return failLocale(locale, {
        status: stored.status,
        error: stored.error,
        phase: localePackagePhaseFromRouteFailure(stored.error, 'package-write'),
      });
    }
    if (stored.value.publicPackageFingerprint !== materialized.value.evidence.generatedPackageFingerprint) {
      return failLocale(locale, {
        status: 409,
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.instance.embedNotReady',
          detail: 'locale_package_fingerprint_mismatch',
        },
        phase: 'package-write',
      });
    }
    return {
      ok: true,
      completed: {
        accountId: args.accountId,
        instanceId: args.instanceId,
        locale,
        publicPackageFingerprint: stored.value.publicPackageFingerprint,
      },
    };
  };

  const results = await runLocalePackagePool({
    locales,
    run: materializeLocale,
    onUnexpectedError: (locale, error) =>
      failLocale(locale, {
        status: 502,
        error: {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'coreui.errors.instance.embedNotReady',
          detail: error instanceof Error ? error.message : String(error),
        },
        phase: 'materializer',
      }),
  });

  const completed = results.flatMap((result) => (result.ok ? [result.completed] : []));
  const failures = results.flatMap((result) => (result.ok ? [] : [result]));
  const failed = failures.map((result) => result.failed);
  if (failures.length) {
    const first = failures[0]!;
    return {
      ok: false,
      status: first.status,
      error: first.error,
      value: { ok: false, completed, failed },
    };
  }

  return { ok: true, value: { ok: true, completed, failed: [] } };
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
