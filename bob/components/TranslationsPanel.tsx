'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  type CanonicalLocaleEntry,
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
import systemStatesCopy from '../l10n/system-states/en.json';
import translationsCopy from '../l10n/translations/en.json';

const CANONICAL_LOCALES = localesJson as CanonicalLocaleEntry[];
const BUILDER_UI_LOCALE = 'en';

type TranslationActivityRow = {
  key: string;
  message: string;
};

function resolveLocaleLabel(locale: string): string {
  const entry = CANONICAL_LOCALES.find((candidate) => candidate.code === locale)!;
  return entry.labels![BUILDER_UI_LOCALE]!;
}

type TranslationOutcome = {
  accepted: boolean;
  requestedLocales: string[];
  translatedLocales: string[];
  failedLocales: Array<{ locale: string; reasonKey: string; detail?: string }>;
};

type TranslationGenerationPayload = {
  ok: boolean;
  translation: TranslationOutcome;
};

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
        <span className="diet-textfield__display-label">{label}</span>
        <select
          className="diet-textfield__field"
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

export function TranslationsPanel({
  agentActivityTitle,
  translationPreviewLocale,
  onTranslationPreviewLocaleChange,
  onRequestTranslationsRefresh,
  translationSetup,
  translatedLocales,
  savedTranslationsLoading,
  savedTranslationsError,
}: {
  agentActivityTitle: string;
  translationPreviewLocale: string;
  onTranslationPreviewLocaleChange: (locale: string) => void;
  onRequestTranslationsRefresh: () => void;
  translationSetup: TranslationSetup;
  translatedLocales: TranslatedLocalesData | null;
  savedTranslationsLoading: boolean;
  savedTranslationsError: boolean;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const { generateTranslations } = useWidgetSessionTransport();
  const [isStartingTranslations, setIsStartingTranslations] = useState(false);
  const [isGeneratingTranslations, setIsGeneratingTranslations] = useState(false);
  const [activityEvents, setActivityEvents] = useState<AgentActivityEvent[]>([]);
  const instanceId = chrome.meta!.instanceId;
  const baseLocale = translationSetup.baseLocale;
  const planTranslationsCopy =
    translationSetup.planTranslationsMax === null
      ? translationsCopy.values.unlimited
      : String(translationSetup.planTranslationsMax);
  const activeLocales = translationSetup.activeLocales;
  const hasActiveLocales = activeLocales.length > 0;
  const hasTranslatableFields = session.compiled!.editableFields.fields.length > 0;
  const localeValues = useMemo(
    () => listPreviewableLocales(baseLocale, translatedLocales),
    [baseLocale, translatedLocales],
  );
  const localeOptions = useMemo(() => {
    return localeValues.map((locale) => ({
      value: locale,
      label: locale === baseLocale
        ? translationsCopy.values.baseLocaleOption.replace('{locale}', resolveLocaleLabel(locale))
        : resolveLocaleLabel(locale),
    }));
  }, [baseLocale, localeValues]);
  const localeValue =
    translationPreviewLocale && localeValues.includes(translationPreviewLocale)
      ? translationPreviewLocale
      : baseLocale;
  const selectOptions = localeOptions;
  const savedTranslationsPending = !savedTranslationsError && (
    Boolean(instanceId !== null && !translatedLocales) || savedTranslationsLoading
  );
  const savedTranslationsEmpty = Boolean(
    translatedLocales && translatedLocales.translations.length === 0,
  );
  const translationsPending = isStartingTranslations || isGeneratingTranslations;
  const generateButton = {
    disabled:
      isStartingTranslations ||
      isGeneratingTranslations ||
      instanceId === null ||
      session.isSaving ||
      session.isDirty ||
      !hasActiveLocales ||
      !hasTranslatableFields,
    label: translationsPending
      ? translationsCopy.command.pending
      : translationsCopy.command.ready,
  };
  const activityRows = useMemo(() => activityEvents.map((event, index) => ({
    key: `agent:${index}:${event.message}`,
    message: event.message,
  })), [activityEvents]);
  const runGenerateTranslations = async () => {
    if (generateButton.disabled || instanceId === null) return;
    setActivityEvents([]);
    setIsStartingTranslations(true);
    setIsGeneratingTranslations(true);
    try {
      const response = await generateTranslations({
        instanceId,
        onActivity: (event) => {
          setActivityEvents((current) => [...current, event]);
        },
      });
      if (
        response.ok &&
        (response.json as TranslationGenerationPayload).translation.translatedLocales.length > 0
      ) {
        onRequestTranslationsRefresh();
      }
      setIsGeneratingTranslations(false);
      setActivityEvents([]);
    } catch {
      setIsGeneratingTranslations(false);
      setActivityEvents([]);
    } finally {
      setIsStartingTranslations(false);
    }
  };
  useEffect(() => {
    setIsGeneratingTranslations(false);
    setActivityEvents([]);
  }, [instanceId]);
  if (!session.compiled) {
    return null;
  }

  return (
    <div className="tdmenucontent">
      <div className="heading-3">{translationsCopy.title}</div>
      <div className="tdmenucontent__fields">
        <div className="tdmenucontent__cluster">
          <div className="label-s label-muted">{translationsCopy.fields.baseLocale}</div>
          <div className="body-s">{resolveLocaleLabel(baseLocale)}</div>
        </div>
        <div className="tdmenucontent__cluster">
          <div className="label-s label-muted">{translationsCopy.fields.planAvailability}</div>
          <div className="body-s">{planTranslationsCopy}</div>
        </div>
        <div className="tdmenucontent__cluster">
          <button
            className="diet-button"
            data-size="small"
            data-type="primary"
            data-loading={translationsPending ? 'true' : undefined}
            type="button"
            disabled={generateButton.disabled}
            aria-busy={translationsPending ? 'true' : undefined}
            onClick={() => void runGenerateTranslations()}
          >
            {translationsPending ? (
              <span className="diet-spinner" aria-hidden="true" />
            ) : null}
            <span className="diet-button__label">{generateButton.label}</span>
          </button>
          {isGeneratingTranslations ? (
            <AgentActivity title={agentActivityTitle} rows={activityRows} />
          ) : null}
        </div>
        {savedTranslationsPending ? (
          <div
            className="diet-loading-state"
            role="status"
            aria-label={systemStatesCopy.loading.accessibleLabel}
          >
            <span className="diet-spinner" data-size="medium" aria-hidden="true" />
          </div>
        ) : null}
        {!savedTranslationsPending && !savedTranslationsError && savedTranslationsEmpty ? (
          <div className="diet-empty-state">
            <span
              className="diet-empty-state__icon diet-icon diet-icon-mask"
              style={{ '--diet-icon-source': 'url("/dieter/icons/svg/ellipsis.svg")' } as React.CSSProperties}
              aria-hidden="true"
            />
            <span className="diet-empty-state__label body-s">
              {translationsCopy.empty}
            </span>
          </div>
        ) : null}
        {!savedTranslationsPending && !savedTranslationsError && !savedTranslationsEmpty ? (
          <SelectField
            label={translationsCopy.fields.previewLocale}
            value={localeValue}
            onChange={onTranslationPreviewLocaleChange}
            options={selectOptions}
            disabled={!selectOptions[0]?.value}
          />
        ) : null}
      </div>
    </div>
  );
}
