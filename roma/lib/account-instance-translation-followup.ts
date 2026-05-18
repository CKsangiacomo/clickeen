import {
  buildOverlayTextValueMap,
  extractTextPrimitiveValues,
  validateOverlayValuesForTextPrimitives,
  type ExtractedTextPrimitiveValue,
} from '@clickeen/ck-contracts/overlay-primitives';
import {
  buildCurrentLanguageValues,
  buildFaqSavedTextGraph,
  selectFaqFieldsNeedingTranslation,
  type FaqLanguageValue,
  type FaqSavedTextField,
} from '@clickeen/ck-contracts/faq-language-values';
import { resolveLanguageOverlayCode } from '@clickeen/ck-contracts/overlay-codebooks';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  clearLanguageOverlaySelectionInTokyo,
  loadTokyoWidgetCatalog,
  writeLanguageOverlayToTokyo,
} from './account-instance-direct';
import {
  loadAccountInstanceLocaleOverlayInventory,
  readAccountInstanceLocaleOverlayObject,
} from './account-instance-locale-overlays';
import {
  loadAccountTranslationLanguagePolicy,
  type AccountTranslationLanguagePolicy,
} from './account-translation-policy';
import { produceInstanceTranslationValues } from './instance-translation-agent-client';

export type InstanceTranslationFollowupResult = {
  ok: boolean;
  baseLocale: string | null;
  results: Array<
    | { locale: string; ok: true; overlayId: string }
    | {
        locale: string;
        ok: false;
        reasonKey: string;
        detail: string;
        path?: string;
      }
  >;
};

function failure(args: {
  locale: string;
  reasonKey: string;
  detail: string;
  path?: string;
}): InstanceTranslationFollowupResult['results'][number] {
  return {
    locale: args.locale,
    ok: false,
    reasonKey: args.reasonKey,
    detail: args.detail,
    ...(args.path ? { path: args.path } : {}),
  };
}

function validationFailureDetail(
  validation: Exclude<ReturnType<typeof validateOverlayValuesForTextPrimitives>, { ok: true }>,
): {
  reasonKey: string;
  detail: string;
  path: string;
} {
  return {
    reasonKey: `instance.translation.${validation.reason}`,
    detail: `translation output ${validation.reason}: ${validation.path}`,
    path: validation.path,
  };
}

function itemsForTranslation(items: ExtractedTextPrimitiveValue[]) {
  return items.map((item) => ({
    path: item.path,
    type: item.type,
    label: item.label,
    ...(item.role ? { role: item.role } : {}),
    value: item.value,
  }));
}

function thrownFailure(locale: string, error: unknown): InstanceTranslationFollowupResult['results'][number] {
  return failure({
    locale,
    reasonKey: 'instance.translation.unhandled_failure',
    detail: error instanceof Error ? error.message : String(error),
  });
}

function valuesMatch(expected: Record<string, string>, actual: Record<string, string>): boolean {
  const expectedEntries = Object.entries(expected);
  const actualEntries = Object.entries(actual);
  if (expectedEntries.length !== actualEntries.length) return false;
  return expectedEntries.every(([path, value]) => actual[path] === value);
}

async function verifyStoredOverlay(args: {
  accountPublicId: string;
  instanceId: string;
  overlayId: string;
  values: Record<string, string>;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<InstanceTranslationFollowupResult['results'][number] | null> {
  const object = await readAccountInstanceLocaleOverlayObject({
    accountId: args.accountPublicId,
    instanceId: args.instanceId,
    overlayId: args.overlayId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!object.ok) {
    return failure({
      locale: '<overlay>',
      reasonKey: object.error.reasonKey,
      detail: object.error.detail ?? 'tokyo_overlay_verify_read_failed',
    });
  }
  if (object.value.overlayId !== args.overlayId || !valuesMatch(args.values, object.value.values)) {
    return failure({
      locale: '<overlay>',
      reasonKey: 'instance.translation.overlay_verification_failed',
      detail: 'Tokyo stored overlay could not be read back with the translated values',
    });
  }
  return null;
}

function translationItemsForFaqFields(items: FaqSavedTextField[]) {
  return items.map((item) => ({
    path: item.identity.path,
    type: item.type,
    label: item.label,
    role: item.identity.role,
    value: item.baseText,
  }));
}

function previousLanguageValuesFromOverlay(args: {
  fields: FaqSavedTextField[];
  locale: string;
  values: Record<string, string>;
}): FaqLanguageValue[] {
  return args.fields
    .filter((field) => typeof args.values[field.identity.path] === 'string')
    .map((field) => ({
      identity: field.identity,
      locale: args.locale,
      value: args.values[field.identity.path] as string,
      updatedAt: new Date(0).toISOString(),
    }));
}

export async function runInstanceTranslationFollowupAfterSave(args: {
  authz: RomaAccountAuthzCapsulePayload;
  accessToken: string;
  accountCapsule?: string | null;
  accountPublicId: string;
  instanceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  previousConfig?: Record<string, unknown> | null;
  translateAllCurrentFields?: boolean;
  targetLocales?: string[];
  translationPolicy?: AccountTranslationLanguagePolicy;
  requestId?: string | null;
}): Promise<InstanceTranslationFollowupResult> {
  let policy:
    | { ok: true; value: AccountTranslationLanguagePolicy }
    | Awaited<ReturnType<typeof loadAccountTranslationLanguagePolicy>>;
  try {
    policy = args.translationPolicy
      ? { ok: true, value: args.translationPolicy }
      : await loadAccountTranslationLanguagePolicy({
          accessToken: args.accessToken,
          accountId: args.authz.accountId,
          requestId: args.requestId,
        });
  } catch (error) {
    return {
      ok: false,
      baseLocale: null,
      results: [thrownFailure('<policy>', error)],
    };
  }
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
  const desiredTargetLocales = policy.value.desiredLocales.filter((locale) => locale !== baseLocale);
  const desiredTargetLocaleSet = new Set(desiredTargetLocales);
  const requestedTargetLocales = Array.isArray(args.targetLocales)
    ? Array.from(new Set(args.targetLocales.map((locale) => String(locale || '').trim()).filter(Boolean)))
    : null;
  const targetLocales = Array.isArray(args.targetLocales)
    ? Array.from(
        new Set(
          args.targetLocales
            .map((locale) => String(locale || '').trim())
            .filter((locale) => locale && locale !== baseLocale && desiredTargetLocaleSet.has(locale)),
        ),
      )
    : desiredTargetLocales;
  if (requestedTargetLocales?.length && !targetLocales.length) {
    return {
      ok: false,
      baseLocale,
      results: requestedTargetLocales.map((locale) =>
        failure({
          locale,
          reasonKey: 'instance.translation.locale_not_in_policy',
          detail: `Locale ${locale} is not currently enabled for translation`,
        }),
      ),
    };
  }
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
          reasonKey: 'instance.translation.contract_invalid',
          detail: error instanceof Error ? error.message : String(error),
        }),
      ),
    };
  }

  const translationItems = itemsForTranslation(textItems);
  const results = await Promise.all(
    targetLocales.map(async (locale) => {
      try {
        const languageCode = resolveLanguageOverlayCode(locale);
        if (!languageCode) {
          return failure({
            locale,
            reasonKey: 'instance.translation.language_unsupported',
            detail: `No overlay language code for locale ${locale}`,
          });
        }

        const translateAllCurrentFields = args.translateAllCurrentFields === true;

        if (args.widgetType === 'faq' && entry.content && !translateAllCurrentFields && !args.previousConfig) {
          return failure({
            locale,
            reasonKey: 'instance.translation.previous_config_missing',
            detail: 'previous saved FAQ config is required for changed-field translation',
          });
        }

        if (args.widgetType === 'faq' && entry.content && (translateAllCurrentFields || args.previousConfig)) {
          let previousFields: FaqSavedTextField[];
          let currentFields: FaqSavedTextField[];
          try {
            previousFields = translateAllCurrentFields
              ? []
              : buildFaqSavedTextGraph({
                  contract: entry.content,
                  config: args.previousConfig as Record<string, unknown>,
                  instanceId: args.instanceId,
                });
            currentFields = buildFaqSavedTextGraph({
              contract: entry.content,
              config: args.config,
              instanceId: args.instanceId,
            });
          } catch (error) {
            return failure({
              locale,
              reasonKey: 'instance.translation.contract_invalid',
              detail: error instanceof Error ? error.message : String(error),
            });
          }

          let previousValues: FaqLanguageValue[] = [];
          if (!translateAllCurrentFields) {
            const inventory = await loadAccountInstanceLocaleOverlayInventory({
              accountId: args.accountPublicId,
              instanceId: args.instanceId,
              baseLocale,
              accountCapsule: args.accountCapsule,
              requestId: args.requestId,
            });
            if (!inventory.ok) {
              return failure({
                locale,
                reasonKey: inventory.error.reasonKey,
                detail: inventory.error.detail ?? 'tokyo_overlay_inventory_unavailable',
              });
            }
            const existingOverlay = inventory.value.overlays.find((overlay) => overlay.locale === locale);
            if (existingOverlay) {
              const object = await readAccountInstanceLocaleOverlayObject({
                accountId: args.accountPublicId,
                instanceId: args.instanceId,
                overlayId: existingOverlay.overlayId,
                accountCapsule: args.accountCapsule,
                requestId: args.requestId,
              });
              if (!object.ok) {
                return failure({
                  locale,
                  reasonKey: object.error.reasonKey,
                  detail: object.error.detail ?? 'tokyo_overlay_read_failed',
                });
              }
              previousValues = previousLanguageValuesFromOverlay({
                fields: previousFields,
                locale,
                values: object.value.values,
              });
            }
          }

          const changedFields = translateAllCurrentFields
            ? currentFields
            : selectFaqFieldsNeedingTranslation({
                previousSavedTextGraph: previousFields,
                currentSavedTextGraph: currentFields,
                previousLanguageValues: previousValues,
              });
          const changedTranslationItems = translationItemsForFaqFields(changedFields);
          const produced =
            changedTranslationItems.length > 0
              ? await produceInstanceTranslationValues({
                  authz: args.authz,
                  instanceId: args.instanceId,
                  request: {
                    v: 1,
                    widgetType: args.widgetType,
                    sourceLanguage: baseLocale,
                    targetLanguage: locale,
                    items: changedTranslationItems,
                  },
                  requestId: args.requestId,
                })
              : { ok: true as const, value: { v: 1 as const, values: {} } };

          if (!produced.ok) {
            return failure({
              locale,
              reasonKey: 'instance.translation.agent_failed',
              detail: produced.detail,
            });
          }

          const changedByPath = new Map(changedFields.map((field) => [field.identity.path, field]));
          const merged = buildCurrentLanguageValues({
            previousSavedTextGraph: previousFields,
            currentSavedTextGraph: currentFields,
            previousLanguageValues: previousValues,
            translatedValues: Object.entries(produced.value.values).map(([path, value]) => {
              const field = changedByPath.get(path);
              return {
                identity: field?.identity ?? {
                  instanceId: args.instanceId,
                  widgetType: 'faq' as const,
                  path,
                  role: '<unknown>',
                },
                value,
              };
            }),
            locale,
            updatedAt: new Date().toISOString(),
            jobId: crypto.randomUUID(),
          });
          if (!merged.ok) {
            return failure({
              locale,
              reasonKey: `instance.translation.${merged.reason}`,
              detail: `current language merge failed: ${merged.fieldKey}`,
              path: merged.fieldKey,
            });
          }

          const values = Object.fromEntries(merged.values.map((value) => [value.identity.path, value.value]));
          const validation = validateOverlayValuesForTextPrimitives(textItems, values);
          if (!validation.ok) {
            return failure({
              locale,
              ...validationFailureDetail(validation),
            });
          }
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
          const verifyFailure = await verifyStoredOverlay({
            accountPublicId: args.accountPublicId,
            instanceId: args.instanceId,
            overlayId: stored.value.overlayId,
            values,
            accountCapsule: args.accountCapsule,
            requestId: args.requestId,
          });
          if (verifyFailure) return { ...verifyFailure, locale };
          return {
            locale,
            ok: true as const,
            overlayId: stored.value.overlayId,
          };
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
          translationItems.length > 0
            ? await produceInstanceTranslationValues({
                authz: args.authz,
                instanceId: args.instanceId,
                request: {
                  v: 1,
                  widgetType: args.widgetType,
                  sourceLanguage: baseLocale,
                  targetLanguage: locale,
                  items: translationItems,
                },
                requestId: args.requestId,
              })
            : { ok: true as const, value: { v: 1 as const, values: {} } };

        if (!produced.ok) {
          return failure({
            locale,
            reasonKey: 'instance.translation.agent_failed',
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
        const verifyFailure = await verifyStoredOverlay({
          accountPublicId: args.accountPublicId,
          instanceId: args.instanceId,
          overlayId: stored.value.overlayId,
          values,
          accountCapsule: args.accountCapsule,
          requestId: args.requestId,
        });
        if (verifyFailure) return { ...verifyFailure, locale };

        return {
          locale,
          ok: true as const,
          overlayId: stored.value.overlayId,
        };
      } catch (error) {
        return thrownFailure(locale, error);
      }
    }),
  );

  return {
    ok: results.every((result) => result.ok),
    baseLocale,
    results,
  };
}
