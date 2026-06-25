import type { NextRequest } from 'next/server';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  materializeAccountInstanceLocalePackages,
  type LocalePackageMaterializationValue,
} from './account-instance-locale-package';
import { generateAccountInstanceTranslations } from './account-instance-translations';

type RouteFailure = {
  ok: false;
  status: number;
  error: {
    kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
    reasonKey: string;
    detail?: string;
  };
};

type SourceSaveCascadePhase = 'translation-generation' | NonNullable<LocalePackageMaterializationValue['failed']>['phase'];

export type SourceSaveLocaleCascadeCoordinate = {
  accountId: string;
  instanceId: string;
  locale: string;
};

export type SourceSaveLocaleCascadeValue = {
  ok: boolean;
  invoked: boolean;
  baseLocale: string;
  activeLocales: string[];
  cost: {
    instances: 1;
    activeNonBaseLocales: number;
    coordinates: number;
    configuredActiveLocaleCap: number | null;
    hostCommandTimeoutMs: 120000;
  };
  translation: {
    accepted: boolean;
    completed: string[];
    skipped: Array<SourceSaveLocaleCascadeCoordinate & { phase: 'not-attempted-after-failure' | 'not-accepted' }>;
  };
  localePackages: {
    completed: LocalePackageMaterializationValue['completed'];
    skipped: LocalePackageMaterializationValue['skipped'];
    failed?: SourceSaveLocaleCascadeCoordinate & {
      phase: SourceSaveCascadePhase;
      reasonKey: string;
      detail?: string;
    };
  };
};

export type SourceSaveLocaleCascadeResult =
  | { ok: true; value: SourceSaveLocaleCascadeValue }
  | (RouteFailure & { value: SourceSaveLocaleCascadeValue });

type SourceSaveLocaleCascadeDeps = {
  generateTranslations: typeof generateAccountInstanceTranslations;
  materializeLocalePackages: typeof materializeAccountInstanceLocalePackages;
};

const defaultDeps: SourceSaveLocaleCascadeDeps = {
  generateTranslations: generateAccountInstanceTranslations,
  materializeLocalePackages: materializeAccountInstanceLocalePackages,
};

function uniqueNonBaseLocales(activeLocales: string[], baseLocale: string): string[] {
  return Array.from(new Set(activeLocales.filter((locale) => locale && locale !== baseLocale)));
}

function baseCascadeValue(args: {
  accountId: string;
  instanceId: string;
  baseLocale: string;
  activeLocales: string[];
  configuredActiveLocaleCap: number | null;
}): SourceSaveLocaleCascadeValue {
  return {
    ok: true,
    invoked: args.activeLocales.length > 0,
    baseLocale: args.baseLocale,
    activeLocales: args.activeLocales,
    cost: {
      instances: 1,
      activeNonBaseLocales: args.activeLocales.length,
      coordinates: args.activeLocales.length,
      configuredActiveLocaleCap: args.configuredActiveLocaleCap,
      hostCommandTimeoutMs: 120000,
    },
    translation: {
      accepted: false,
      completed: [],
      skipped: [],
    },
    localePackages: {
      completed: [],
      skipped: [],
    },
  };
}

function skippedAfterFailure(args: {
  accountId: string;
  instanceId: string;
  locales: string[];
}): SourceSaveLocaleCascadeValue['translation']['skipped'] {
  return args.locales.map((locale) => ({
    accountId: args.accountId,
    instanceId: args.instanceId,
    locale,
    phase: 'not-attempted-after-failure',
  }));
}

function valueWithTranslationFailure(args: {
  value: SourceSaveLocaleCascadeValue;
  accountId: string;
  instanceId: string;
  failedLocale: string;
  remainingLocales: string[];
  completedLocales: string[];
  completedPackages: LocalePackageMaterializationValue['completed'];
  skippedPackages: LocalePackageMaterializationValue['skipped'];
  reasonKey: string;
  detail?: string;
}): SourceSaveLocaleCascadeValue {
  return {
    ...args.value,
    ok: false,
    translation: {
      accepted: false,
      completed: args.completedLocales,
      skipped: skippedAfterFailure({
        accountId: args.accountId,
        instanceId: args.instanceId,
        locales: args.remainingLocales,
      }),
    },
    localePackages: {
      completed: args.completedPackages,
      skipped: [
        ...args.skippedPackages,
        ...args.remainingLocales.map((locale) => ({
        accountId: args.accountId,
        instanceId: args.instanceId,
        locale,
        phase: 'not-attempted-after-failure' as const,
        })),
      ],
      failed: {
        accountId: args.accountId,
        instanceId: args.instanceId,
        locale: args.failedLocale,
        phase: 'translation-generation',
        reasonKey: args.reasonKey,
        ...(args.detail ? { detail: args.detail } : {}),
      },
    },
  };
}

export async function runAccountInstanceSourceSaveLocaleCascade(args: {
  request: NextRequest;
  accountId: string;
  instanceId: string;
  baseLocale: string;
  activeLocales: string[];
  configuredActiveLocaleCap: number | null;
  authz: RomaAccountAuthzCapsulePayload;
  accountCapsule: string;
  requestId: string;
  deps?: SourceSaveLocaleCascadeDeps;
}): Promise<SourceSaveLocaleCascadeResult> {
  const activeLocales = uniqueNonBaseLocales(args.activeLocales, args.baseLocale);
  const value = baseCascadeValue({
    accountId: args.accountId,
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    activeLocales,
    configuredActiveLocaleCap: args.configuredActiveLocaleCap,
  });
  if (!activeLocales.length) return { ok: true, value };

  const deps = args.deps ?? defaultDeps;
  let cascadeValue = value;

  for (const [index, locale] of activeLocales.entries()) {
    const generated = await deps.generateTranslations({
      accountId: args.accountId,
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
      activeLocales: [locale],
      authz: args.authz,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    if (!generated.ok) {
      const failedValue = valueWithTranslationFailure({
        value: cascadeValue,
        accountId: args.accountId,
        instanceId: args.instanceId,
        failedLocale: locale,
        remainingLocales: activeLocales.slice(index + 1),
        completedLocales: cascadeValue.translation.completed,
        completedPackages: cascadeValue.localePackages.completed,
        skippedPackages: cascadeValue.localePackages.skipped,
        reasonKey: generated.error.reasonKey,
        ...(generated.error.detail ? { detail: generated.error.detail } : {}),
      });
      return {
        ok: false,
        status: generated.status,
        error: generated.error,
        value: failedValue,
      };
    }

    if (!generated.value.translation.accepted) {
      cascadeValue = {
        ...cascadeValue,
        translation: {
          accepted: cascadeValue.translation.accepted,
          completed: cascadeValue.translation.completed,
          skipped: [
            ...cascadeValue.translation.skipped,
            {
              accountId: args.accountId,
              instanceId: args.instanceId,
              locale,
              phase: 'not-accepted',
            },
          ],
        },
      };
      continue;
    }

    const packages = await deps.materializeLocalePackages({
      request: args.request,
      accountId: args.accountId,
      instanceId: args.instanceId,
      baseLocale: args.baseLocale,
      activeLocales: generated.value.translation.activeLocales,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    });
    const completedLocales = [
      ...cascadeValue.translation.completed,
      ...generated.value.translation.activeLocales,
    ];
    cascadeValue = {
      ...cascadeValue,
      ok: packages.ok,
      translation: {
        accepted: true,
        completed: completedLocales,
        skipped: cascadeValue.translation.skipped,
      },
      localePackages: {
        completed: [...cascadeValue.localePackages.completed, ...packages.value.completed],
        skipped: [...cascadeValue.localePackages.skipped, ...packages.value.skipped],
        ...(packages.value.failed ? { failed: packages.value.failed } : {}),
      },
    };
    if (!packages.ok) {
      const remainingLocales = activeLocales.slice(index + 1);
      const failedValue: SourceSaveLocaleCascadeValue = {
        ...cascadeValue,
        translation: {
          ...cascadeValue.translation,
          skipped: [
            ...cascadeValue.translation.skipped,
            ...skippedAfterFailure({
              accountId: args.accountId,
              instanceId: args.instanceId,
              locales: remainingLocales,
            }),
          ],
        },
        localePackages: {
          ...cascadeValue.localePackages,
          skipped: [
            ...cascadeValue.localePackages.skipped,
            ...remainingLocales.map((remainingLocale) => ({
              accountId: args.accountId,
              instanceId: args.instanceId,
              locale: remainingLocale,
              phase: 'not-attempted-after-failure' as const,
            })),
          ],
        },
      };
      return {
        ok: false,
        status: packages.status,
        error: packages.error,
        value: failedValue,
      };
    }
  }

  return { ok: true, value: cascadeValue };
}
