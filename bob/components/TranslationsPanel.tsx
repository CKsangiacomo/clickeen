'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import { listActivePreviewLocales } from '../lib/translations-preview';
import type { TranslationReview } from '../lib/translations-preview';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);
const BUILDER_UI_LOCALE = 'en';

type TranslationPanelProductState = {
  primaryState:
    | 'unsaved'
    | 'unavailable'
    | 'generating'
    | 'failed'
    | 'available';
  primaryMessage: string | null;
  canGenerate: boolean;
  translatedPanelLocales: string[];
};

function resolveLocaleLabel(locale: string): string {
  const normalized = normalizeLocaleToken(locale) ?? '';
  if (!normalized) return '';
  return (
    resolveCanonicalLocaleLabel({
      locales: CANONICAL_LOCALES,
      uiLocale: BUILDER_UI_LOCALE,
      locale: normalized,
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

export function buildGenerateTranslationsButtonState(args: {
  instanceId: string;
  hasActiveLocales: boolean;
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
  if (!args.hasActiveLocales) {
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

export function resolveTranslationPanelProductState(args: {
  instanceId: string;
  hasActiveLocales: boolean;
  activeLocales: string[];
  translatedLocales: string[];
  hasTranslatableFields: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isGenerating: boolean;
  operationError?: string | null;
}): TranslationPanelProductState {
  const activeSet = new Set(args.activeLocales);
  const translatedPanelLocales = args.translatedLocales
    .filter((locale) => activeSet.has(locale))
    .sort((left, right) => left.localeCompare(right));
  if (args.isDirty || args.isSaving) {
    return {
      primaryState: 'unsaved',
      primaryMessage: 'Save changes before generating translations.',
      canGenerate: false,
      translatedPanelLocales,
    };
  }
  if (!args.instanceId) {
    return { primaryState: 'unavailable', primaryMessage: null, canGenerate: false, translatedPanelLocales: [] };
  }
  if (!args.hasActiveLocales) {
    return { primaryState: 'unavailable', primaryMessage: null, canGenerate: false, translatedPanelLocales: [] };
  }
  if (!args.hasTranslatableFields) {
    return {
      primaryState: 'unavailable',
      primaryMessage: 'This widget has no translation fields.',
      canGenerate: false,
      translatedPanelLocales: [],
    };
  }
  if (args.operationError) {
    return { primaryState: 'failed', primaryMessage: args.operationError, canGenerate: true, translatedPanelLocales };
  }
  if (args.isGenerating) {
    return {
      primaryState: 'generating',
      primaryMessage: 'Generating translations.',
      canGenerate: false,
      translatedPanelLocales,
    };
  }
  if (translatedPanelLocales.length > 0) {
    return { primaryState: 'available', primaryMessage: null, canGenerate: true, translatedPanelLocales };
  }
  return {
    primaryState: 'available',
    primaryMessage: 'No translations generated yet.',
    canGenerate: true,
    translatedPanelLocales,
  };
}

export function resolveGenerateTranslationsMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Translations could not be generated.');
  }
  const translation = (payload as Record<string, unknown>).translation;
  if (!translation || typeof translation !== 'object' || Array.isArray(translation)) {
    throw new Error('Translations could not be generated.');
  }
  const translationRecord = translation as Record<string, unknown>;
  const activeLocales = translationRecord.activeLocales;
  if (
    (payload as Record<string, unknown>).ok !== true ||
    translationRecord.ok !== true ||
    translationRecord.accepted !== true ||
    !Array.isArray(activeLocales)
  ) {
    throw new Error('Translations could not be generated.');
  }
  const generated = activeLocales.filter((entry) => typeof entry === 'string' && entry.trim()).length;
  if (generated !== activeLocales.length || generated <= 0) {
    throw new Error('Translations could not be generated.');
  }
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
}: {
  review: TranslationReview;
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
                <div className="body-s">{item.value || 'Missing translation value.'}</div>
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
  const { generateTranslations } = useWidgetSessionTransport();
  const [isStartingTranslations, setIsStartingTranslations] = useState(false);
  const [isGeneratingTranslations, setIsGeneratingTranslations] = useState(false);
  const [generateResultMessage, setGenerateResultMessage] = useState<string | null>(null);
  const [generateErrorMessage, setGenerateErrorMessage] = useState<string | null>(null);
  const instanceId = chrome.meta?.instanceId ?? '';
  const baseLocale = translationSetup?.baseLocale || translatedLocales?.baseLocale || '';
  const planTranslationsCopy =
    translationSetup?.planTranslationsMax == null
      ? 'unlimited'
      : String(translationSetup.planTranslationsMax);
  const translationError = session.error?.source === 'translation' ? session.error : null;
  const panelProductState = resolveTranslationPanelProductState({
    instanceId,
    hasActiveLocales: Boolean(translationSetup?.activeLocales?.length),
    activeLocales: translationSetup?.activeLocales ?? [],
    translatedLocales: translatedLocales?.translations.map((entry) => entry.locale) ?? [],
    hasTranslatableFields: Boolean(session.compiled?.editableFields?.fields?.length),
    isDirty: session.isDirty,
    isSaving: session.isSaving,
    isGenerating: isGeneratingTranslations,
    operationError: generateErrorMessage,
  });
  const localeValues = useMemo(
    () => (
      listActivePreviewLocales({
        baseLocale,
        activeLocales: translationSetup?.activeLocales ?? [],
      })
    ),
    [baseLocale, translationSetup],
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
  const isSelectedTranslatedLocale =
    Boolean(localeValue && localeValue !== baseLocale && panelProductState.translatedPanelLocales.includes(localeValue));
  const selectedTranslationEntry = isSelectedTranslatedLocale ? { locale: localeValue } : null;
  const sourceSelectedValues =
    isSelectedTranslatedLocale ? translationValuesByLocale[localeValue] ?? null : null;
  const selectedValues = isSelectedTranslatedLocale ? sourceSelectedValues : null;
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
    setGenerateResultMessage(null);
    setGenerateErrorMessage(null);
    setIsStartingTranslations(true);
    setIsGeneratingTranslations(true);
    try {
      const response = await generateTranslations({
        instanceId,
      });
      if (!response.ok) {
        throw new Error(resolveGenerateTranslationsError(response.json));
      }
      setGenerateResultMessage(resolveGenerateTranslationsMessage(response.json));
      onRequestTranslationsRefresh();
      setIsGeneratingTranslations(false);
    } catch (error) {
      setGenerateErrorMessage(error instanceof Error ? error.message : 'Translations could not be generated.');
      setIsGeneratingTranslations(false);
    } finally {
      setIsStartingTranslations(false);
    }
  };
  useEffect(() => {
    setGenerateResultMessage(null);
    setGenerateErrorMessage(null);
    setIsGeneratingTranslations(false);
  }, [instanceId]);
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
          {generateResultMessage ? (
            <div className="label-s label-muted">{generateResultMessage}</div>
          ) : null}
        </div>
        <SelectField
          label="Preview locale"
          value={localeValue}
          onChange={onTranslationPreviewLocaleChange}
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
          <div className="label-s label-muted">Generate translations to preview this language.</div>
        ) : null}
        {!translationsError && selectedTranslationEntry && !selectedValues ? (
          <div className="label-s label-muted">Loading current language values...</div>
        ) : null}
        {!translationsError && selectedValues && !session.compiled.editableFields ? (
          <div className="label-s label-muted">No translation fields declared for this widget.</div>
        ) : null}
        {!translationsError && selectedReview ? (
          <TranslationReviewRows review={selectedReview} />
        ) : null}
      </div>
    </div>
  );
}
