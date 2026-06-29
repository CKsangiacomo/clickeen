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
import type { AgentActivityEvent } from '../lib/session/sessionTypes';
import type { TranslatedLocalesData, TranslationSetup } from './useTranslationPreviewState';
import { listPreviewableLocales } from '../lib/translations-preview';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);
const BUILDER_UI_LOCALE = 'en';

type TranslationActivityRow = {
  key: string;
  message: string;
};

function resolveLocaleLabel(locale: string): string {
  const normalized = normalizeLocaleToken(locale) ?? '';
  if (!normalized) return 'Language unavailable';
  return (
    resolveCanonicalLocaleLabel({
      locales: CANONICAL_LOCALES,
      uiLocale: BUILDER_UI_LOCALE,
      locale: normalized,
    }) || 'Language unavailable'
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

export function buildActivityRows(events: AgentActivityEvent[]): TranslationActivityRow[] {
  return events
    .slice(-6)
    .map((event, index) => ({
      key: `agent:${index}:${event.message}`,
      message: event.message,
    }));
}

function AgentActivity({
  title,
  rows,
}: {
  title: string;
  rows: TranslationActivityRow[];
}) {
  if (!rows.length) return null;
  return (
    <div className="diet-agent-activity" data-size="sm" data-tone="active" role="status" aria-live="polite">
      <div className="diet-agent-activity__header">
        <span className="diet-agent-activity__title label-s">{title}</span>
      </div>
      <div className="diet-agent-activity__rows">
        {rows.map((row) => (
          <div className="diet-agent-activity__row" key={row.key}>
            <span className="diet-agent-activity__text body-s">{row.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TRANSLATION_GENERATION_FAILED_COPY = 'Translation generation failed. Please try again.';

export function TranslationsPanel({
  translationPreviewLocale,
  onTranslationPreviewLocaleChange,
  onRequestTranslationsRefresh,
  translationSetup,
  translatedLocales,
}: {
  translationPreviewLocale: string;
  onTranslationPreviewLocaleChange: (locale: string) => void;
  onRequestTranslationsRefresh: () => void;
  translationSetup: TranslationSetup | null;
  translatedLocales: TranslatedLocalesData | null;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const { generateTranslations } = useWidgetSessionTransport();
  const [isStartingTranslations, setIsStartingTranslations] = useState(false);
  const [isGeneratingTranslations, setIsGeneratingTranslations] = useState(false);
  const [activityEvents, setActivityEvents] = useState<AgentActivityEvent[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const instanceId = chrome.meta?.instanceId ?? '';
  const baseLocale = translationSetup?.baseLocale || translatedLocales?.baseLocale || '';
  const planTranslationsCopy =
    translationSetup?.planTranslationsMax == null
      ? 'unlimited'
      : String(translationSetup.planTranslationsMax);
  const activeLocales = useMemo(() => translationSetup?.activeLocales ?? [], [translationSetup?.activeLocales]);
  const hasActiveLocales = activeLocales.length > 0;
  const hasTranslatableFields = Boolean(session.compiled?.editableFields?.fields?.length);
  const generateButtonMessage =
    session.isDirty || session.isSaving
      ? 'Save changes before generating translations.'
      : hasActiveLocales && !hasTranslatableFields
        ? 'This widget has no translation fields.'
        : null;
  const localeValues = useMemo(
    () => listPreviewableLocales(translatedLocales).filter((locale) => locale === baseLocale || activeLocales.includes(locale)),
    [activeLocales, baseLocale, translatedLocales],
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
  const generateButton = {
    disabled:
      isStartingTranslations ||
      isGeneratingTranslations ||
      !instanceId ||
      session.isSaving ||
      session.isDirty ||
      !hasActiveLocales ||
      !hasTranslatableFields,
    label: isGeneratingTranslations ? 'Generating translations...' : 'Generate translations',
    message: generateButtonMessage,
  };
  const activityRows = useMemo(() => buildActivityRows(activityEvents), [activityEvents]);
  const runGenerateTranslations = async () => {
    if (generateButton.disabled || !instanceId) return;
    setActivityEvents([]);
    setGenerationError(null);
    setIsStartingTranslations(true);
    setIsGeneratingTranslations(true);
    try {
      const response = await generateTranslations({
        instanceId,
        onActivity: (event) => {
          setActivityEvents((current) => [...current, event].slice(-12));
        },
      });
      if (response.ok) {
        onRequestTranslationsRefresh();
      } else {
        setGenerationError(TRANSLATION_GENERATION_FAILED_COPY);
      }
      setIsGeneratingTranslations(false);
      setActivityEvents([]);
    } catch {
      setIsGeneratingTranslations(false);
      setActivityEvents([]);
      setGenerationError(TRANSLATION_GENERATION_FAILED_COPY);
    } finally {
      setIsStartingTranslations(false);
    }
  };
  useEffect(() => {
    setIsGeneratingTranslations(false);
    setActivityEvents([]);
    setGenerationError(null);
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
          {isGeneratingTranslations ? (
            <AgentActivity title="Translation Agent" rows={activityRows} />
          ) : null}
          {generationError ? (
            <div className="body-s" role="alert">
              {generationError}
            </div>
          ) : null}
        </div>
        <SelectField
          label="Preview locale"
          value={localeValue}
          onChange={onTranslationPreviewLocaleChange}
          options={selectOptions}
          disabled={!selectOptions[0]?.value}
        />
      </div>
    </div>
  );
}
