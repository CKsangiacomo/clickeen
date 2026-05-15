import {
  buildOverlayTextValueMap,
  extractTextPrimitiveValues,
  validateOverlayValuesForTextPrimitives,
  type ExtractedTextPrimitiveValue,
} from '@clickeen/ck-contracts/overlay-primitives';
import { resolveLanguageOverlayCode } from '@clickeen/ck-contracts/overlay-codebooks';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  clearLanguageOverlaySelectionInTokyo,
  loadTokyoWidgetCatalog,
  writeLanguageOverlayToTokyo,
} from './account-instance-direct';
import { loadAccountBabelLanguagePolicy } from './account-babel-policy';
import { produceBabelTextValues } from './babel-text-producer';

export type BabelSaveFollowupResult = {
  ok: boolean;
  baseLocale: string | null;
  results: Array<
    | { locale: string; ok: true; overlayId: string }
    | { locale: string; ok: false; reasonKey: string; detail: string; path?: string }
  >;
};

function failure(args: {
  locale: string;
  reasonKey: string;
  detail: string;
  path?: string;
}): BabelSaveFollowupResult['results'][number] {
  return {
    locale: args.locale,
    ok: false,
    reasonKey: args.reasonKey,
    detail: args.detail,
    ...(args.path ? { path: args.path } : {}),
  };
}

function validationFailureDetail(validation: Exclude<ReturnType<typeof validateOverlayValuesForTextPrimitives>, { ok: true }>): {
  reasonKey: string;
  detail: string;
  path: string;
} {
  return {
    reasonKey: `babel.text.${validation.reason}`,
    detail: `producer output ${validation.reason}: ${validation.path}`,
    path: validation.path,
  };
}

function itemsForProducer(items: ExtractedTextPrimitiveValue[]) {
  return items.map((item) => ({
    path: item.path,
    type: item.type,
    value: item.value,
  }));
}

export async function runBabelTextFollowupAfterSave(args: {
  authz: RomaAccountAuthzCapsulePayload;
  accessToken: string;
  accountCapsule?: string | null;
  accountPublicId: string;
  instanceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  requestId?: string | null;
}): Promise<BabelSaveFollowupResult> {
  const policy = await loadAccountBabelLanguagePolicy({
    accessToken: args.accessToken,
    accountId: args.authz.accountId,
    requestId: args.requestId,
  });
  if (!policy.ok) {
    return {
      ok: false,
      baseLocale: null,
      results: [
        failure({
          locale: '<policy>',
          reasonKey: policy.error.reasonKey,
          detail: policy.error.detail ?? 'account_language_policy_unavailable',
        }),
      ],
    };
  }

  const baseLocale = policy.value.baseLocale;
  const targetLocales = policy.value.desiredLocales.filter((locale) => locale !== baseLocale);
  if (!targetLocales.length) return { ok: true, baseLocale, results: [] };

  const catalog = await loadTokyoWidgetCatalog({
    accountId: args.accountPublicId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!catalog.ok) {
    return {
      ok: false,
      baseLocale,
      results: targetLocales.map((locale) =>
        failure({
          locale,
          reasonKey: catalog.error.reasonKey,
          detail: catalog.error.detail ?? 'widget_overlay_contract_unavailable',
        }),
      ),
    };
  }

  const entry = catalog.value.widgets.find((candidate) => candidate.widgetType === args.widgetType);
  if (!entry) {
    return {
      ok: false,
      baseLocale,
      results: targetLocales.map((locale) =>
        failure({
          locale,
          reasonKey: 'coreui.errors.instance.widgetMissing',
          detail: `Missing widget overlay contract for ${args.widgetType}`,
        }),
      ),
    };
  }

  let textItems: ExtractedTextPrimitiveValue[];
  try {
    textItems = extractTextPrimitiveValues({
      spec: { overlays: entry.overlays },
      config: args.config,
    });
  } catch (error) {
    return {
      ok: false,
      baseLocale,
      results: targetLocales.map((locale) =>
        failure({
          locale,
          reasonKey: 'babel.text.contract_invalid',
          detail: error instanceof Error ? error.message : String(error),
        }),
      ),
    };
  }

  const producerItems = itemsForProducer(textItems);
  const results = await Promise.all(
    targetLocales.map(async (locale) => {
      const languageCode = resolveLanguageOverlayCode(locale);
      if (!languageCode) {
        return failure({
          locale,
          reasonKey: 'babel.text.language_unsupported',
          detail: `No overlay language code for locale ${locale}`,
        });
      }

      const cleared = await clearLanguageOverlaySelectionInTokyo({
        accountId: args.accountPublicId,
        instanceId: args.instanceId,
        widgetType: args.widgetType,
        languageCode,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      });
      if (!cleared.ok) {
        return failure({
          locale,
          reasonKey: cleared.error.reasonKey,
          detail: cleared.error.detail ?? 'tokyo_overlay_selection_clear_failed',
        });
      }

      const produced =
        producerItems.length > 0
          ? await produceBabelTextValues({
              authz: args.authz,
              instanceId: args.instanceId,
              request: {
                v: 1,
                widgetType: args.widgetType,
                sourceLanguage: baseLocale,
                targetLanguage: locale,
                items: producerItems,
              },
              requestId: args.requestId,
            })
          : { ok: true as const, value: { v: 1 as const, values: {} } };

      if (!produced.ok) {
        return failure({
          locale,
          reasonKey: 'babel.text.producer_failed',
          detail: produced.detail,
        });
      }

      const validation = validateOverlayValuesForTextPrimitives(textItems, produced.value.values);
      if (!validation.ok) {
        return failure({
          locale,
          ...validationFailureDetail(validation),
        });
      }

      const values = buildOverlayTextValueMap(
        textItems.map((item) => ({
          ...item,
          value: produced.value.values[item.path] as string,
        })),
      );
      const stored = await writeLanguageOverlayToTokyo({
        accountId: args.accountPublicId,
        instanceId: args.instanceId,
        widgetType: args.widgetType,
        languageCode,
        values,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      });
      if (!stored.ok) {
        return failure({
          locale,
          reasonKey: stored.error.reasonKey,
          detail: stored.error.detail ?? 'tokyo_overlay_write_failed',
        });
      }

      return {
        locale,
        ok: true as const,
        overlayId: stored.value.overlayId,
      };
    }),
  );

  return {
    ok: results.every((result) => result.ok),
    baseLocale,
    results,
  };
}
