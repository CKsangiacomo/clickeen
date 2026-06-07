'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeCanonicalLocalesFile,
  normalizeLocaleToken,
  resolveLocaleLabel as resolveCanonicalLocaleLabel,
} from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import {
  isActiveTranslationGeneration,
  normalizeTranslationGenerationFromPayload,
  normalizeTranslationGenerationSummary,
  type TranslationGenerationSummary,
} from '@clickeen/ck-contracts/translation-product-state';
import {
  useWidgetSession,
  useWidgetSessionChrome,
  useWidgetSessionTransport,
} from '../lib/session/useWidgetSession';
import type { TranslatedLocalesData, TranslationSetup } from './useTranslationPreviewState';
import { buildEditableFieldsTranslationReview } from '../lib/translations-preview';
import { buildTranslationPanelLocaleState } from '../lib/translations-preview';
import type { TranslationReview } from '../lib/translations-preview';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);
const BUILDER_UI_LOCALE = 'en';
const TRANSLATION_GENERATION_POLL_MS = 3_000;

type TranslationPanelProductState = {
  primaryState:
    | 'loading'
    | 'unsaved'
    | 'unavailable'
    | 'ready'
    | 'generating'
    | 'baseChangedWhileGenerating'
    | 'baseChanged'
    | 'partialFailure'
    | 'failed'
    | 'available';
  primaryMessage: string | null;
  canGenerate: boolean;
  reviewableLocales: string[];
};

function resolveLocaleLabel(locale: string): string {
  const normalized = normalizeLocaleToken(locale) ?? '';
  if (!normalized) return '';
  return (
    resolveCanonicalLocaleLabel({
      locales: CANONICAL_LOCALES,
      uiLocale: BUILDER_UI_LOCALE,
      targetLocale: normalized,
    }) || normalized
  );
}

function SelectField({
  label,
  value,
  onChange,
  onClick,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onClick?: () => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="diet-textfield" data-size="md">
      <label className="diet-textfield__control">
        <span className="diet-textfield__display-label label-s">{label}</span>
        <select
          className="diet-textfield__field body-s"
          value={value}
          onMouseDown={onClick}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function buildTranslationValuesAfterEdit(args: {
  values: Record<string, string>;
  path: string;
  value: string;
}): Record<string, string> {
  return {
    ...args.values,
    [args.path]: args.value,
  };
}

export function buildGenerateTranslationsButtonState(args: {
  instanceId: string;
  expectedTranslationsCount: number;
  hasTranslatableFields: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isStarting: boolean;
  isGenerating: boolean;
}): { disabled: boolean; label: string; message: string | null } {
  if (args.isGenerating) {
    return { disabled: true, label: 'Generating translations...', message: null };
  }
  if (args.isStarting) {
    return { disabled: true, label: 'Generate translations', message: null };
  }
  if (!args.instanceId) {
    return { disabled: true, label: 'Generate translations', message: null };
  }
  if (args.isSaving) {
    return { disabled: true, label: 'Generate translations', message: null };
  }
  if (args.isDirty) {
    return {
      disabled: true,
      label: 'Generate translations',
      message: 'Save changes before generating translations.',
    };
  }
  if (args.expectedTranslationsCount <= 0) {
    return { disabled: true, label: 'Generate translations', message: null };
  }
  if (!args.hasTranslatableFields) {
    return {
      disabled: true,
      label: 'Generate translations',
      message: 'This widget has no translation fields.',
    };
  }
  return { disabled: false, label: 'Generate translations', message: null };
}

export { isActiveTranslationGeneration, normalizeTranslationGenerationSummary };

function reviewableLocalesForGeneration(generation: TranslationGenerationSummary | null): string[] {
  return (generation?.locales ?? [])
    .filter((locale) => locale.reviewable && locale.state === 'inSync')
    .map((locale) => locale.locale)
    .sort((left, right) => left.localeCompare(right));
}

export function resolveTranslationPanelProductState(args: {
  instanceId: string;
  expectedTranslationsCount: number;
  hasTranslatableFields: boolean;
  isDirty: boolean;
  isSaving: boolean;
  generationLoaded: boolean;
  generation: TranslationGenerationSummary | null;
  operationError?: string | null;
}): TranslationPanelProductState {
  const reviewableLocales = reviewableLocalesForGeneration(args.generation);
  if (args.isDirty || args.isSaving) {
    return {
      primaryState: 'unsaved',
      primaryMessage: 'Save changes before generating translations.',
      canGenerate: false,
      reviewableLocales,
    };
  }
  if (!args.instanceId) {
    return { primaryState: 'unavailable', primaryMessage: null, canGenerate: false, reviewableLocales: [] };
  }
  if (args.expectedTranslationsCount <= 0) {
    return { primaryState: 'unavailable', primaryMessage: null, canGenerate: false, reviewableLocales: [] };
  }
  if (!args.hasTranslatableFields) {
    return {
      primaryState: 'unavailable',
      primaryMessage: 'This widget has no translation fields.',
      canGenerate: false,
      reviewableLocales: [],
    };
  }
  if (!args.generationLoaded) {
    return { primaryState: 'loading', primaryMessage: null, canGenerate: false, reviewableLocales: [] };
  }
  if (args.operationError) {
    return { primaryState: 'failed', primaryMessage: args.operationError, canGenerate: true, reviewableLocales };
  }

  const generation = args.generation;
  const active = isActiveTranslationGeneration(generation);
  if (active && generation?.isCurrentBaseContent === false) {
    return {
      primaryState: 'baseChangedWhileGenerating',
      primaryMessage: 'The base content has changed. Regenerate translations when generation finishes.',
      canGenerate: false,
      reviewableLocales,
    };
  }
  if (active) {
    return {
      primaryState: 'generating',
      primaryMessage: 'Generating translations.',
      canGenerate: false,
      reviewableLocales,
    };
  }

  const localeStates = generation?.locales ?? [];
  const outOfSync = localeStates.some((locale) => locale.state === 'outOfSync');
  if (outOfSync) {
    return {
      primaryState: 'baseChanged',
      primaryMessage: 'The base content has changed. Regenerate translations.',
      canGenerate: true,
      reviewableLocales,
    };
  }

  const failedLocales = localeStates.filter((locale) => locale.state === 'failed');
  if (failedLocales.length > 0 && reviewableLocales.length > 0) {
    const detail = failedLocales[0]?.detail || failedLocales[0]?.reasonKey || generation?.detail || generation?.reasonKey || '';
    return {
      primaryState: 'partialFailure',
      primaryMessage: `Some translations failed.${detail ? ` ${detail}` : ''}`,
      canGenerate: true,
      reviewableLocales,
    };
  }
  if (failedLocales.length > 0 || generation?.status === 'failed') {
    const detail = failedLocales[0]?.detail || failedLocales[0]?.reasonKey || generation?.detail || generation?.reasonKey || '';
    return {
      primaryState: 'failed',
      primaryMessage: `Translations failed.${detail ? ` ${detail}` : ''}`,
      canGenerate: true,
      reviewableLocales,
    };
  }
  if (reviewableLocales.length > 0) {
    return { primaryState: 'available', primaryMessage: null, canGenerate: true, reviewableLocales };
  }
  return {
    primaryState: 'ready',
    primaryMessage: 'No translations generated yet.',
    canGenerate: true,
    reviewableLocales,
  };
}

export function isTranslationGenerationAccepted(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const translation = (payload as Record<string, unknown>).translation;
  const generation = normalizeTranslationGenerationFromPayload(payload);
  return Boolean(
    translation &&
      typeof translation === 'object' &&
      !Array.isArray(translation) &&
      (translation as Record<string, unknown>).accepted === true &&
      isActiveTranslationGeneration(generation),
  );
}

export function resolveTranslationGenerationStatusMessage(generation: TranslationGenerationSummary): string {
  if (isActiveTranslationGeneration(generation) && generation.isCurrentBaseContent === false) {
    return 'The base content has changed. Regenerate translations when generation finishes.';
  }
  if (isActiveTranslationGeneration(generation)) return 'Generating translations.';
  if (generation.locales.some((locale) => locale.state === 'outOfSync')) {
    return 'The base content has changed. Regenerate translations.';
  }
  if (generation.status === 'failed') {
    const failed = generation.locales.filter((locale) => locale.state === 'failed').length;
    const detail = generation.detail || generation.reasonKey || '';
    return `${failed || 'Some'} translations failed.${detail ? ` ${detail}` : ''}`;
  }
  if (generation.locales.some((locale) => locale.state === 'failed')) return 'Some translations failed.';
  return 'No translations to generate.';
}

export function resolveGenerateTranslationsMessage(payload: unknown): string {
  const generation = normalizeTranslationGenerationFromPayload(payload);
  if (generation) return resolveTranslationGenerationStatusMessage(generation);
  if (isTranslationGenerationAccepted(payload)) {
    return 'Generating translations. This can take a little while.';
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Translations generated.';
  }
  const translation = (payload as Record<string, unknown>).translation;
  if (!translation || typeof translation !== 'object' || Array.isArray(translation)) {
    return 'Translations generated.';
  }
  const results = Array.isArray((translation as Record<string, unknown>).results)
    ? ((translation as Record<string, unknown>).results as Array<Record<string, unknown>>)
    : [];
  const generated = results.filter((result) => result?.ok === true).length;
  const failed = results.find((result) => result?.ok === false);
  if (failed) {
    const detail = typeof failed.detail === 'string' && failed.detail.trim() ? failed.detail.trim() : '';
    const locale = typeof failed.locale === 'string' && failed.locale.trim() ? failed.locale.trim() : '';
    throw new Error([locale, detail].filter(Boolean).join(': ') || 'Translations could not be generated.');
  }
  if (generated <= 0) return 'No translations to generate.';
  return `Generated ${generated} translations.`;
}

export function buildTranslationGenerationPanelState(payload: unknown): {
  isGenerating: boolean;
  message: string | null;
  shouldRefreshTranslations: boolean;
} | null {
  const generation = normalizeTranslationGenerationFromPayload(payload);
  if (!generation) return null;
  const isGenerating = isActiveTranslationGeneration(generation);
  const panelState = resolveTranslationPanelProductState({
    instanceId: generation.instanceId,
    expectedTranslationsCount: generation.targetLocales.length,
    hasTranslatableFields: true,
    isDirty: false,
    isSaving: false,
    generationLoaded: true,
    generation,
  });
  return {
    isGenerating,
    message: panelState.primaryMessage,
    shouldRefreshTranslations:
      isGenerating ||
      generation.status === 'completed' ||
      panelState.reviewableLocales.length > 0 ||
      generation.locales.some((locale) => locale.state === 'outOfSync'),
  };
}

function resolveGenerateTranslationsError(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Translations could not be generated.';
  }
  const error = (payload as Record<string, unknown>).error;
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    const detail = (error as Record<string, unknown>).detail;
    const reasonKey = (error as Record<string, unknown>).reasonKey;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    if (typeof reasonKey === 'string' && reasonKey.trim()) return reasonKey.trim();
  }
  const translation = (payload as Record<string, unknown>).translation;
  if (translation && typeof translation === 'object' && !Array.isArray(translation)) {
    const detail = (translation as Record<string, unknown>).detail;
    const reasonKey = (translation as Record<string, unknown>).reasonKey;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    if (typeof reasonKey === 'string' && reasonKey.trim()) return reasonKey.trim();
  }
  return 'Translations could not be generated.';
}

export function TranslationReviewRows({
  review,
  draftValues,
  editable = false,
  savingPath = null,
  onDraftValueChange,
  onSaveValue,
}: {
  review: TranslationReview;
  draftValues?: Record<string, string>;
  editable?: boolean;
  savingPath?: string | null;
  onDraftValueChange?: (path: string, value: string) => void;
  onSaveValue?: (path: string) => void;
}) {
  return (
    <div className="tdmenucontent__fields" data-testid="translation-review-rows">
      {review.sections.map((section, sectionIndex) => (
        <div className="tdmenucontent__cluster" key={`${section.title}:${sectionIndex}`}>
          <div className="overline-small tdmenucontent__cluster-label">{section.title}</div>
          <div className="tdmenucontent__cluster-body">
            {section.items.map((item) => (
              <div className="tdmenucontent__cluster" key={item.path}>
                <div className="label-s label-muted">{item.label}</div>
                {editable ? (
                  <div className="tdmenucontent__cluster">
                    <textarea
                      className="diet-textarea__field body-s"
                      value={draftValues?.[item.path] ?? item.value}
                      onChange={(event) => onDraftValueChange?.(item.path, event.target.value)}
                      rows={item.value.length > 120 ? 5 : 3}
                    />
                    <button
                      className="diet-btn-txt"
                      data-size="sm"
                      data-variant="neutral"
                      type="button"
                      disabled={
                        savingPath !== null ||
                        !onSaveValue ||
                        (draftValues?.[item.path] ?? item.value) === item.value
                      }
                      onClick={() => onSaveValue?.(item.path)}
                    >
                      <span className="diet-btn-txt__label body-s">
                        {savingPath === item.path ? 'Saving...' : 'Save'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="body-s">{item.value || 'Missing translation value.'}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TranslationsPanel({
  translationPreviewLocale,
  onTranslationPreviewLocaleChange,
  onRequestTranslationsRefresh,
  translationSetup,
  translatedLocales,
  translationValuesByLocale,
  translationsLoading,
  translationsError,
}: {
  translationPreviewLocale: string;
  onTranslationPreviewLocaleChange: (locale: string) => void;
  onRequestTranslationsRefresh: () => void;
  translationSetup: TranslationSetup | null;
  translatedLocales: TranslatedLocalesData | null;
  translationValuesByLocale: Record<string, Record<string, string>>;
  translationsLoading: boolean;
  translationsError: string | null;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const { generateTranslations, readTranslationGeneration, saveTranslation } = useWidgetSessionTransport();
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const draftValuesRef = useRef<Record<string, string>>({});
  const dirtyDraftPathsRef = useRef<Set<string>>(new Set());
  const activeDraftLocaleRef = useRef('');
  const [localTranslationValuesByLocale, setLocalTranslationValuesByLocale] = useState<Record<string, Record<string, string>>>({});
  const [savingPath, setSavingPath] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isStartingTranslations, setIsStartingTranslations] = useState(false);
  const [isGeneratingTranslations, setIsGeneratingTranslations] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [translationGeneration, setTranslationGeneration] = useState<TranslationGenerationSummary | null>(null);
  const [translationGenerationLoaded, setTranslationGenerationLoaded] = useState(false);
  const initialGenerationReadInstanceId = useRef('');
  const readTranslationGenerationRef = useRef(readTranslationGeneration);
  const onRequestTranslationsRefreshRef = useRef(onRequestTranslationsRefresh);
  useEffect(() => {
    readTranslationGenerationRef.current = readTranslationGeneration;
  }, [readTranslationGeneration]);
  useEffect(() => {
    onRequestTranslationsRefreshRef.current = onRequestTranslationsRefresh;
  }, [onRequestTranslationsRefresh]);
  useEffect(() => {
    draftValuesRef.current = draftValues;
  }, [draftValues]);
  const instanceId = chrome.meta?.instanceId ?? '';
  const baseLocale = translationSetup?.baseLocale || translatedLocales?.baseLocale || '';
  const localeState = useMemo(
    () =>
      buildTranslationPanelLocaleState({
        baseLocale,
        selectedTargetLocales: translationSetup?.selectedTargetLocales ?? [],
        translatedLocales,
        requestedLocale: translationPreviewLocale,
      }),
    [baseLocale, translatedLocales, translationPreviewLocale, translationSetup?.selectedTargetLocales],
  );
  const planTranslationsCopy =
    translationSetup?.planTranslationsMax == null
      ? 'unlimited'
      : String(translationSetup.planTranslationsMax);
  const translationError = session.error?.source === 'translation' ? session.error : null;
  const panelProductState = resolveTranslationPanelProductState({
    instanceId,
    expectedTranslationsCount: localeState.expectedTranslationsCount,
    hasTranslatableFields: Boolean(session.compiled?.editableFields?.fields?.length),
    isDirty: session.isDirty,
    isSaving: session.isSaving,
    generationLoaded: translationGenerationLoaded,
    generation: translationGeneration,
    operationError: generateMessage,
  });
  const refreshIfTranslationsMissing = () => {
    if (localeState.shouldRefreshOnDropdownOpen || panelProductState.reviewableLocales.length === 0) {
      onRequestTranslationsRefresh();
    }
  };
  const localeValues = useMemo(
    () => (
      baseLocale
        ? [baseLocale, ...panelProductState.reviewableLocales.filter((locale) => locale !== baseLocale)]
        : []
    ),
    [baseLocale, panelProductState.reviewableLocales],
  );
  const localeOptions = useMemo(() => {
    return localeValues.map((locale) => ({
      value: locale,
      label: locale === baseLocale ? `${resolveLocaleLabel(locale)} (base)` : resolveLocaleLabel(locale),
    }));
  }, [baseLocale, localeValues]);
  const localeValue =
    translationPreviewLocale && localeValues.includes(translationPreviewLocale)
      ? translationPreviewLocale
      : baseLocale || localeValues[0] || '';
  const selectOptions =
    localeOptions.length > 0
      ? localeOptions
      : [
          {
            value: '',
            label: 'Base locale only',
          },
        ];
  const isSelectedReviewable =
    Boolean(localeValue && localeValue !== baseLocale && panelProductState.reviewableLocales.includes(localeValue));
  const selectedTranslationEntry = isSelectedReviewable ? { locale: localeValue } : null;
  const sourceSelectedValues =
    isSelectedReviewable ? translationValuesByLocale[localeValue] ?? null : null;
  const selectedValues =
    isSelectedReviewable ? localTranslationValuesByLocale[localeValue] ?? sourceSelectedValues : null;
  useEffect(() => {
    const localeChanged = activeDraftLocaleRef.current !== localeValue;
    activeDraftLocaleRef.current = localeValue;

    if (isSelectedReviewable && sourceSelectedValues) {
      setLocalTranslationValuesByLocale((current) => ({
        ...current,
        [localeValue]: sourceSelectedValues,
      }));
    }

    if (localeChanged) {
      dirtyDraftPathsRef.current = new Set();
      setDraftValues(sourceSelectedValues ?? {});
      setSavingPath(null);
      setSaveMessage(null);
      return;
    }

    if (!sourceSelectedValues) return;
    setDraftValues((current) => {
      const next = { ...sourceSelectedValues };
      dirtyDraftPathsRef.current.forEach((path) => {
        if (Object.prototype.hasOwnProperty.call(current, path)) {
          next[path] = current[path];
        }
      });
      return next;
    });
  }, [isSelectedReviewable, localeValue, sourceSelectedValues]);
  const selectedReview = useMemo(() => {
    if (!session.compiled?.editableFields || !selectedValues) return null;
    return buildEditableFieldsTranslationReview({
      contract: session.compiled.editableFields,
      config: session.instanceData,
      values: selectedValues,
    });
  }, [selectedValues, session.compiled?.editableFields, session.instanceData]);
  const generateButton = {
    disabled: isStartingTranslations || !panelProductState.canGenerate,
    label: isGeneratingTranslations ? 'Generating translations...' : 'Generate translations',
    message: panelProductState.primaryMessage,
  };
  const runGenerateTranslations = async () => {
    if (generateButton.disabled || !instanceId) return;
    setGenerateMessage(null);
    setSaveMessage(null);
    setIsStartingTranslations(true);
    try {
      const response = await generateTranslations({
        instanceId,
        baseLocale,
        targetLocales: translationSetup?.selectedTargetLocales ?? [],
      });
      if (!response.ok) {
        throw new Error(resolveGenerateTranslationsError(response.json));
      }
      const generation = normalizeTranslationGenerationFromPayload(response.json);
      setTranslationGeneration(generation);
      setTranslationGenerationLoaded(true);
      onRequestTranslationsRefresh();
      setIsGeneratingTranslations(isTranslationGenerationAccepted(response.json));
    } catch (error) {
      setGenerateMessage(error instanceof Error ? error.message : 'Translations could not be generated.');
      setIsGeneratingTranslations(false);
    } finally {
      setIsStartingTranslations(false);
    }
  };
  useEffect(() => {
    setTranslationGeneration(null);
    setTranslationGenerationLoaded(false);
    setGenerateMessage(null);
    setIsGeneratingTranslations(false);
    initialGenerationReadInstanceId.current = '';
  }, [instanceId]);
  useEffect(() => {
    if (!instanceId || initialGenerationReadInstanceId.current === instanceId) return;
    let cancelled = false;
    initialGenerationReadInstanceId.current = instanceId;
    readTranslationGenerationRef.current({ instanceId })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(resolveGenerateTranslationsError(response.json));
        }
        const generation = normalizeTranslationGenerationFromPayload(response.json);
        setTranslationGeneration(generation);
        setTranslationGenerationLoaded(true);
        const panelState = buildTranslationGenerationPanelState(response.json);
        if (!panelState) return;
        setGenerateMessage(null);
        setIsGeneratingTranslations(panelState.isGenerating);
        if (panelState.shouldRefreshTranslations) {
          onRequestTranslationsRefreshRef.current();
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setGenerateMessage(error instanceof Error ? error.message : 'Translation generation state could not be read.');
        setIsGeneratingTranslations(false);
        setTranslationGenerationLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId]);
  useEffect(() => {
    if (!isGeneratingTranslations || !instanceId) return;

    const timer = window.setTimeout(() => {
      readTranslationGeneration({ instanceId })
        .then((response) => {
          if (!response.ok) {
            throw new Error(resolveGenerateTranslationsError(response.json));
          }
          const generation = normalizeTranslationGenerationFromPayload(response.json);
          if (!generation) throw new Error('Translation generation state could not be read.');
          setTranslationGeneration(generation);
          setTranslationGenerationLoaded(true);
          setGenerateMessage(null);
          setIsGeneratingTranslations(isActiveTranslationGeneration(generation));
          onRequestTranslationsRefresh();
        })
        .catch((error) => {
          setGenerateMessage(error instanceof Error ? error.message : 'Translation generation state could not be read.');
          setIsGeneratingTranslations(false);
        });
    }, TRANSLATION_GENERATION_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [
    isGeneratingTranslations,
    instanceId,
    onRequestTranslationsRefresh,
    readTranslationGeneration,
  ]);
  const saveTranslationValue = async (path: string) => {
    if (!selectedValues || !localeValue || localeValue === baseLocale || !instanceId || savingPath) return;
    const currentValues = localTranslationValuesByLocale[localeValue] ?? selectedValues;
    const nextValue = draftValuesRef.current[path] ?? currentValues[path] ?? '';
    const values = buildTranslationValuesAfterEdit({
      values: currentValues,
      path,
      value: nextValue,
    });
    setSavingPath(path);
    setSaveMessage(null);
    try {
      const response = await saveTranslation({
        instanceId,
        locale: localeValue,
        values,
      });
      if (!response.ok) {
        throw new Error('Translated value could not be saved.');
      }
      dirtyDraftPathsRef.current.delete(path);
      setLocalTranslationValuesByLocale((current) => ({
        ...current,
        [localeValue]: values,
      }));
      setDraftValues((current) => {
        const next = { ...values };
        dirtyDraftPathsRef.current.forEach((draftPath) => {
          if (Object.prototype.hasOwnProperty.call(current, draftPath)) {
            next[draftPath] = current[draftPath];
          }
        });
        return next;
      });
      setSaveMessage('Translation saved.');
      onRequestTranslationsRefresh();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Translated value could not be saved.');
    } finally {
      setSavingPath(null);
    }
  };
  if (!session.compiled) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">Translations</div>
        <div className="label-s label-muted">Load a widget to inspect its locales.</div>
      </div>
    );
  }

  return (
    <div className="tdmenucontent">
      <div className="heading-3">Translations</div>
      <div className="tdmenucontent__fields">
        <div className="tdmenucontent__cluster">
          <div className="label-s label-muted">Base locale</div>
          <div className="body-s">{baseLocale ? resolveLocaleLabel(baseLocale) : 'Not set'}</div>
        </div>
        <div className="tdmenucontent__cluster">
          <div className="label-s label-muted">Translations available in your plan</div>
          <div className="body-s">{planTranslationsCopy}</div>
        </div>
        <div className="tdmenucontent__cluster">
          <div className="label-s label-muted">Target translations</div>
          <div className="body-s">{localeState.expectedTranslationsCount}</div>
        </div>
        <div className="tdmenucontent__cluster">
          <button
            className="diet-btn-txt"
            data-size="sm"
            data-variant="primary"
            type="button"
            disabled={generateButton.disabled}
            onClick={() => void runGenerateTranslations()}
          >
            <span className="diet-btn-txt__label body-s">{generateButton.label}</span>
          </button>
          {generateButton.message ? (
            <div className="label-s label-muted">{generateButton.message}</div>
          ) : null}
          {generateMessage ? (
            <div className="label-s label-muted">{generateMessage}</div>
          ) : null}
        </div>
        <SelectField
          label="Preview locale"
          value={localeValue}
          onChange={onTranslationPreviewLocaleChange}
          onClick={refreshIfTranslationsMissing}
          options={selectOptions}
          disabled={!selectOptions[0]?.value}
        />
        {translationsError ? (
          <div className="label-s label-muted">{translationsError}</div>
        ) : null}
        {translationError ? (
          <div className="label-s label-muted">
            {translationError.detail || translationError.message || 'Translation failed.'}
          </div>
        ) : null}
        {!translationsError && localeValue !== baseLocale && !selectedTranslationEntry && !translationsLoading ? (
          <div className="label-s label-muted">Translation not ready yet.</div>
        ) : null}
        {!translationsError && selectedTranslationEntry && !selectedValues ? (
          <div className="label-s label-muted">Loading current language values...</div>
        ) : null}
        {!translationsError && selectedValues && !session.compiled.editableFields ? (
          <div className="label-s label-muted">No translation fields declared for this widget.</div>
        ) : null}
        {saveMessage ? (
          <div className="label-s label-muted">{saveMessage}</div>
        ) : null}
        {!translationsError && selectedReview ? (
          <TranslationReviewRows
            review={selectedReview}
            draftValues={draftValues}
            editable={Boolean(selectedValues && localeValue !== baseLocale)}
            savingPath={savingPath}
            onDraftValueChange={(path, value) => {
              if (selectedValues && value === (selectedValues[path] ?? '')) {
                dirtyDraftPathsRef.current.delete(path);
              } else {
                dirtyDraftPathsRef.current.add(path);
              }
              draftValuesRef.current = {
                ...draftValuesRef.current,
                [path]: value,
              };
              setDraftValues((current) => ({
                ...current,
                [path]: value,
              }));
            }}
            onSaveValue={saveTranslationValue}
          />
        ) : null}
      </div>
    </div>
  );
}
