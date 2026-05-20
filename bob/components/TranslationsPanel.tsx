'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeCanonicalLocalesFile,
  normalizeLocaleToken,
  resolveLocaleLabel as resolveCanonicalLocaleLabel,
} from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
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
const TRANSLATION_GENERATION_MAX_POLL_MS = 120_000;

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
  isDirty: boolean;
  isSaving: boolean;
  isGenerating: boolean;
}): { disabled: boolean; label: string; message: string | null } {
  if (args.isGenerating) {
    return { disabled: true, label: 'Generating translations...', message: null };
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
  return { disabled: false, label: 'Generate translations', message: null };
}

export function isTranslationGenerationAccepted(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const translation = (payload as Record<string, unknown>).translation;
  return Boolean(
    translation &&
      typeof translation === 'object' &&
      !Array.isArray(translation) &&
      (translation as Record<string, unknown>).accepted === true,
  );
}

export function resolveGenerateTranslationsMessage(payload: unknown): string {
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
                        savingPath === item.path ||
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
  const { generateTranslations, saveTranslation } = useWidgetSessionTransport();
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [savingPath, setSavingPath] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isGeneratingTranslations, setIsGeneratingTranslations] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const generationStartedAtRef = useRef<number | null>(null);
  const readyCountAtGenerationStartRef = useRef(0);
  const baseLocale = translationSetup?.baseLocale || translatedLocales?.baseLocale || '';
  const localeState = useMemo(
    () =>
      buildTranslationPanelLocaleState({
        baseLocale,
        activeLocales: translationSetup?.activeLocales ?? [],
        inventory: translatedLocales,
        requestedLocale: translationPreviewLocale,
      }),
    [baseLocale, translatedLocales, translationPreviewLocale, translationSetup?.activeLocales],
  );
  const refreshIfTranslationsMissing = () => {
    if (localeState.shouldRefreshOnDropdownOpen) onRequestTranslationsRefresh();
  };

  const localeOptions = useMemo(() => {
    return localeState.localeValues.map((locale) => ({
      value: locale,
      label: locale === baseLocale ? `${resolveLocaleLabel(locale)} (base)` : resolveLocaleLabel(locale),
    }));
  }, [baseLocale, localeState.localeValues]);
  const localeValue = localeState.localeValue;

  const selectOptions =
    localeOptions.length > 0
      ? localeOptions
      : [
          {
            value: '',
            label: 'Base locale only',
          },
        ];
  const planTranslationsCopy =
    translationSetup?.planTranslationsMax == null
      ? 'unlimited'
      : String(translationSetup.planTranslationsMax);
  const selectedTranslationEntry = localeState.selectedTranslationEntry;
  const selectedValues =
    localeValue && localeValue !== baseLocale ? translationValuesByLocale[localeValue] ?? null : null;
  useEffect(() => {
    setDraftValues(selectedValues ?? {});
    setSavingPath(null);
    setSaveMessage(null);
  }, [localeValue, selectedValues]);
  const selectedReview = useMemo(() => {
    if (!session.compiled?.editableFields || !selectedValues) return null;
    return buildEditableFieldsTranslationReview({
      contract: session.compiled.editableFields,
      config: session.instanceData,
      values: selectedValues,
    });
  }, [selectedValues, session.compiled?.editableFields, session.instanceData]);
  const translationError = session.error?.source === 'translation' ? session.error : null;
  const instanceId = chrome.meta?.instanceId ?? '';
  const generateButton = buildGenerateTranslationsButtonState({
    instanceId,
    expectedTranslationsCount: localeState.expectedTranslationsCount,
    isDirty: session.isDirty,
    isSaving: session.isSaving,
    isGenerating: isGeneratingTranslations,
  });
  const runGenerateTranslations = async () => {
    if (generateButton.disabled || !instanceId) return;
    setGenerateMessage(null);
    setSaveMessage(null);
    setIsGeneratingTranslations(true);
    generationStartedAtRef.current = Date.now();
    readyCountAtGenerationStartRef.current = localeState.readyTranslationsCount;
    try {
      const response = await generateTranslations({
        instanceId,
        baseLocale,
        targetLocales: translationSetup?.activeLocales ?? [],
      });
      if (!response.ok) {
        throw new Error(resolveGenerateTranslationsError(response.json));
      }
      setGenerateMessage(resolveGenerateTranslationsMessage(response.json));
      onRequestTranslationsRefresh();
      if (!isTranslationGenerationAccepted(response.json)) {
        setIsGeneratingTranslations(false);
        generationStartedAtRef.current = null;
      }
    } catch (error) {
      setGenerateMessage(error instanceof Error ? error.message : 'Translations could not be generated.');
      setIsGeneratingTranslations(false);
      generationStartedAtRef.current = null;
    }
  };
  useEffect(() => {
    if (!isGeneratingTranslations) return;
    if (localeState.allExpectedTranslationsReady) {
      setGenerateMessage('Translations ready.');
      setIsGeneratingTranslations(false);
      generationStartedAtRef.current = null;
      return;
    }

    const startedAt = generationStartedAtRef.current ?? Date.now();
    generationStartedAtRef.current = startedAt;
    if (Date.now() - startedAt > TRANSLATION_GENERATION_MAX_POLL_MS) {
      setGenerateMessage('Translations are still generating. Open the language dropdown in a moment.');
      setIsGeneratingTranslations(false);
      generationStartedAtRef.current = null;
      return;
    }

    if (localeState.readyTranslationsCount > readyCountAtGenerationStartRef.current) {
      setGenerateMessage(
        `${localeState.readyTranslationsCount} of ${localeState.expectedTranslationsCount} translations ready.`,
      );
    }

    const timer = window.setTimeout(() => {
      onRequestTranslationsRefresh();
    }, TRANSLATION_GENERATION_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [
    isGeneratingTranslations,
    localeState.allExpectedTranslationsReady,
    localeState.expectedTranslationsCount,
    localeState.readyTranslationsCount,
    onRequestTranslationsRefresh,
  ]);
  const saveTranslationValue = async (path: string) => {
    if (!selectedValues || !localeValue || localeValue === baseLocale || !instanceId) return;
    const nextValue = draftValues[path] ?? selectedValues[path] ?? '';
    const values = buildTranslationValuesAfterEdit({
      values: selectedValues,
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
        {localeState.expectedTranslationsCount > 0 && !localeState.allExpectedTranslationsReady ? (
          <div className="label-s label-muted">
            {localeState.readyTranslationsCount} of {localeState.expectedTranslationsCount} translations ready
          </div>
        ) : null}
        {translationsError ? (
          <div className="label-s label-muted">{translationsError}</div>
        ) : null}
        {translationError ? (
          <div className="label-s label-muted">
            {translationError.detail || translationError.message || 'Translation failed.'}
          </div>
        ) : null}
        {localeValue === baseLocale ? (
          <div className="label-s label-muted">Select a translated language to review it.</div>
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
