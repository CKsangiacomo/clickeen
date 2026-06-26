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
import type { HostCommandActivityEvent } from '../lib/session/sessionTypes';
import type { TranslatedLocalesData, TranslationSetup } from './useTranslationPreviewState';
import { listActivePreviewLocales } from '../lib/translations-preview';

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

type TranslationActivityRow = {
  key: string;
  state: 'current' | 'done' | 'failed';
  message: string;
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
      primaryMessage: null,
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
  return generated === 1 ? 'Generated 1 active locale.' : `Generated ${generated} active locales.`;
}

export function resolveGenerateTranslationsError(payload?: unknown): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const localePackages = record.localePackages;
    if (localePackages && typeof localePackages === 'object' && !Array.isArray(localePackages)) {
      const failed = (localePackages as Record<string, unknown>).failed;
      if (failed && typeof failed === 'object' && !Array.isArray(failed)) {
        const failedRecord = failed as Record<string, unknown>;
        const locale = typeof failedRecord.locale === 'string' ? failedRecord.locale.trim() : '';
        const phase = typeof failedRecord.phase === 'string' ? failedRecord.phase.trim() : '';
        const localeLabel = locale ? resolveLocaleLabel(locale) : '';
        const phaseLabel =
          phase === 'package-write' || phase === 'package-materialization'
            ? 'preparing the preview'
            : phase === 'translation-generation'
              ? 'creating the translation'
              : '';
        if (localeLabel && phaseLabel) return `Translations could not finish for ${localeLabel} while ${phaseLabel}.`;
        if (localeLabel) return `Translations could not finish for ${localeLabel}.`;
      }
    }
  }
  return 'Translations could not be generated.';
}

function activityRowState(event: HostCommandActivityEvent): TranslationActivityRow['state'] {
  if (event.stage === 'locale-completed' || event.stage === 'overlay-written') return 'done';
  if (event.stage === 'locale-failed') return 'failed';
  return 'current';
}

function formatActivityMessage(event: HostCommandActivityEvent): string {
  const localeLabel = event.locale ? resolveLocaleLabel(event.locale) : '';
  switch (event.stage) {
    case 'command-started':
      return 'Creating translations';
    case 'locale-started':
      return localeLabel ? `Creating ${localeLabel} translation` : 'Creating translation';
    case 'overlay-written':
      return localeLabel ? `${localeLabel} translated` : 'Translation ready';
    case 'package-materializing':
      return localeLabel ? `Preparing ${localeLabel} preview` : 'Preparing preview';
    case 'locale-completed':
      return localeLabel ? `${localeLabel} ready` : 'Language ready';
    case 'locale-failed':
      return localeLabel ? `${localeLabel} could not be completed` : 'Language could not be completed';
    case 'locale-not-attempted':
      return localeLabel ? `${localeLabel} not completed` : 'Language not completed';
    default:
      return event.message;
  }
}

export function buildActivityRows(events: HostCommandActivityEvent[]): TranslationActivityRow[] {
  return events.slice(-6).map((event, index) => ({
    key: `${event.stage}:${event.locale ?? 'command'}:${event.phase ?? ''}:${index}`,
    state: activityRowState(event),
    message: formatActivityMessage(event),
  }));
}

function CommandActivityBox({
  title,
  rows,
}: {
  title: string;
  rows: TranslationActivityRow[];
}) {
  if (!rows.length) return null;
  return (
    <div className="diet-command-activity" data-size="sm" data-tone="active" role="status" aria-live="polite">
      <div className="diet-command-activity__header">
        <span className="diet-command-activity__title label-s">{title}</span>
      </div>
      <div className="diet-command-activity__rows">
        {rows.map((row) => (
          <div className="diet-command-activity__row" data-state={row.state} key={row.key}>
            <span className="diet-command-activity__text body-s">{row.message}</span>
          </div>
        ))}
      </div>
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
  const [activityEvents, setActivityEvents] = useState<HostCommandActivityEvent[]>([]);
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
  const generateButton = {
    disabled: isStartingTranslations || !panelProductState.canGenerate,
    label: isGeneratingTranslations ? 'Generating translations...' : 'Generate translations',
    message: panelProductState.primaryMessage,
  };
  const activityRows = useMemo(() => buildActivityRows(activityEvents), [activityEvents]);
  const runGenerateTranslations = async () => {
    if (generateButton.disabled || !instanceId) return;
    setGenerateResultMessage(null);
    setGenerateErrorMessage(null);
    setActivityEvents([]);
    setIsStartingTranslations(true);
    setIsGeneratingTranslations(true);
    try {
      const response = await generateTranslations({
        instanceId,
        onActivity: (event) => {
          setActivityEvents((current) => [...current, event].slice(-12));
        },
      });
      if (!response.ok) {
        throw new Error(resolveGenerateTranslationsError(response.json));
      }
      setGenerateResultMessage(resolveGenerateTranslationsMessage(response.json));
      onRequestTranslationsRefresh();
      setIsGeneratingTranslations(false);
      setActivityEvents([]);
    } catch (error) {
      setGenerateErrorMessage(error instanceof Error ? error.message : 'Translations could not be generated.');
      setIsGeneratingTranslations(false);
      setActivityEvents([]);
    } finally {
      setIsStartingTranslations(false);
    }
  };
  useEffect(() => {
    setGenerateResultMessage(null);
    setGenerateErrorMessage(null);
    setIsGeneratingTranslations(false);
    setActivityEvents([]);
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
          {isGeneratingTranslations ? (
            <CommandActivityBox title="Generating translations" rows={activityRows} />
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
      </div>
    </div>
  );
}
