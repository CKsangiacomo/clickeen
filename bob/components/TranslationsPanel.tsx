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
import { bobUiCopy } from '../l10n/ui-copy';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);
const BUILDER_UI_LOCALE = 'en';

type TranslationActivityRow = {
  key: string;
  message: string;
};

export type TranslationGenerationFeedback = {
  tone: 'success' | 'warning' | 'error';
  title: string;
  lines: string[];
};

type TranslationCommandResponse = {
  ok: boolean;
  status: number;
  json: unknown;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
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

function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function summarizeLocaleList(locales: string[]): string {
  const labels = locales.map(resolveLocaleLabel).filter(Boolean);
  if (!labels.length) return '';
  if (labels.length <= 3) return labels.join(', ');
  return `${labels.slice(0, 3).join(', ')} and ${formatCount(labels.length - 3, 'more language')}`;
}

function resolveTranslationErrorCopy(payload: Record<string, unknown> | null, status: number): string {
  const error = isRecord(payload?.error) ? payload.error : null;
  const reasonKey = typeof error?.reasonKey === 'string' ? error.reasonKey.trim() : '';
  switch (reasonKey) {
    case 'coreui.upsell.reason.limitReached':
      return 'Your current plan cannot generate all requested translations.';
    case 'coreui.errors.auth.required':
      return 'You need to sign in again before generating translations.';
    case 'coreui.errors.auth.forbidden':
      return 'You do not have permission to generate translations for this account.';
    case 'coreui.errors.payload.invalid':
      return 'The translation request was invalid. Save the widget and try again.';
    case 'coreui.errors.translation.failed':
      return 'Translation generation failed. Please try again.';
    case 'coreui.errors.translations.baseLocaleMismatch':
      return 'The saved widget language changed. Refresh Builder and try again.';
    default:
      if (status === 401) return 'You need to sign in again before generating translations.';
      if (status === 403 || status === 402) return 'Your account cannot generate these translations right now.';
      if (status === 422) return 'The translation request could not be accepted. Save the widget and try again.';
      return 'Translation generation failed. Please try again.';
  }
}

export function shouldRefreshTranslationsAfterGeneration(payload: unknown): boolean {
  const outcome = (payload as TranslationGenerationPayload).translation;
  return outcome.accepted && outcome.translatedLocales.length > 0;
}

export function buildTranslationGenerationFeedback(response: TranslationCommandResponse): TranslationGenerationFeedback {
  const payload = isRecord(response.json) ? response.json : null;
  if (!response.ok) {
    return {
      tone: 'error',
      title: 'Translation generation failed',
      lines: [resolveTranslationErrorCopy(payload, response.status)],
    };
  }

  const outcome = (response.json as TranslationGenerationPayload).translation;

  if (!outcome.accepted) {
    return {
      tone: 'warning',
      title: 'No translations generated',
      lines: ['No translation languages are available for this widget.'],
    };
  }

  const translatedLocales = outcome.translatedLocales;
  const translationFailures = outcome.failedLocales;
  const failedTranslationLocales = translationFailures.map((failure) => failure.locale);
  const failedTranslationCopy = summarizeLocaleList(failedTranslationLocales);
  if (translatedLocales.length === 0) {
    return {
      tone: 'error',
      title: 'Translation generation failed',
      lines: [
        failedTranslationCopy
          ? `Translation failed for ${failedTranslationCopy}.`
          : 'No requested language was translated.',
      ],
    };
  }

  const generatedCopy = `Generated translations for ${summarizeLocaleList(translatedLocales)}.`;

  if (translationFailures.length > 0) {
    return {
      tone: 'warning',
      title: 'Translations partially generated',
      lines: [
        generatedCopy,
        failedTranslationCopy
          ? `Translation failed for ${failedTranslationCopy}.`
          : `${formatCount(translationFailures.length, 'language')} failed.`,
      ],
    };
  }

  return {
    tone: 'success',
    title: 'Translations generated',
    lines: [generatedCopy, 'Preview translations have been refreshed.'],
  };
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
  translationSetup: TranslationSetup | null;
  translatedLocales: TranslatedLocalesData | null;
  savedTranslationsLoading: boolean;
  savedTranslationsError: string | null;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const { generateTranslations } = useWidgetSessionTransport();
  const [isStartingTranslations, setIsStartingTranslations] = useState(false);
  const [isGeneratingTranslations, setIsGeneratingTranslations] = useState(false);
  const [activityEvents, setActivityEvents] = useState<AgentActivityEvent[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationFeedback, setGenerationFeedback] = useState<TranslationGenerationFeedback | null>(null);
  const instanceId = chrome.meta?.instanceId ?? '';
  const baseLocale = translationSetup?.baseLocale ?? '';
  const planTranslationsCopy =
    translationSetup?.planTranslationsMax == null
      ? 'unlimited'
      : String(translationSetup.planTranslationsMax);
  const activeLocales = useMemo(() => translationSetup?.activeLocales ?? [], [translationSetup?.activeLocales]);
  const hasActiveLocales = activeLocales.length > 0;
  const hasTranslatableFields = Boolean(session.compiled?.editableFields?.fields?.length);
  const generateButtonMessage =
    !instanceId
      ? 'Save this widget before generating translations.'
      : session.isDirty || session.isSaving
      ? 'Save changes before generating translations.'
      : hasActiveLocales && !hasTranslatableFields
        ? 'This widget has no translation fields.'
        : null;
  const localeValues = useMemo(
    () => listPreviewableLocales(baseLocale, translatedLocales),
    [baseLocale, translatedLocales],
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
      : baseLocale;
  const selectOptions = localeOptions;
  const savedTranslationsPending = !savedTranslationsError && (
    Boolean(instanceId && baseLocale && !translatedLocales) || savedTranslationsLoading
  );
  const savedTranslationsEmpty = Boolean(
    translatedLocales && translatedLocales.translations.length === 0,
  );
  const translationsPending = isStartingTranslations || isGeneratingTranslations;
  const generateButton = {
    disabled:
      isStartingTranslations ||
      isGeneratingTranslations ||
      !instanceId ||
      session.isSaving ||
      session.isDirty ||
      !hasActiveLocales ||
      !hasTranslatableFields,
    label: translationsPending
      ? bobUiCopy.commands.translations.pending
      : bobUiCopy.commands.translations.ready,
    message: generateButtonMessage,
  };
  const activityRows = useMemo(() => buildActivityRows(activityEvents), [activityEvents]);
  const runGenerateTranslations = async () => {
    if (generateButton.disabled || !instanceId) return;
    setActivityEvents([]);
    setGenerationError(null);
    setGenerationFeedback(null);
    setIsStartingTranslations(true);
    setIsGeneratingTranslations(true);
    try {
      const response = await generateTranslations({
        instanceId,
        onActivity: (event) => {
          setActivityEvents((current) => [...current, event].slice(-12));
        },
      });
      const feedback = buildTranslationGenerationFeedback(response);
      setGenerationFeedback(feedback);
      if (shouldRefreshTranslationsAfterGeneration(response.json)) {
        onRequestTranslationsRefresh();
      }
      setIsGeneratingTranslations(false);
      setActivityEvents([]);
    } catch {
      setIsGeneratingTranslations(false);
      setActivityEvents([]);
      setGenerationError(TRANSLATION_GENERATION_FAILED_COPY);
      setGenerationFeedback(null);
    } finally {
      setIsStartingTranslations(false);
    }
  };
  useEffect(() => {
    setIsGeneratingTranslations(false);
    setActivityEvents([]);
    setGenerationError(null);
    setGenerationFeedback(null);
  }, [instanceId]);
  if (!session.compiled) {
    return null;
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
          {generateButton.message ? (
            <div className="label-s label-muted">{generateButton.message}</div>
          ) : null}
          {isGeneratingTranslations ? (
            <AgentActivity title={agentActivityTitle} rows={activityRows} />
          ) : null}
          {generationFeedback ? (
            <div
              data-feedback-tone={generationFeedback.tone}
              role={generationFeedback.tone === 'success' ? 'status' : 'alert'}
            >
              <div className="label-s">{generationFeedback.title}</div>
              {generationFeedback.lines.map((line) => (
                <div className="body-s" key={line}>
                  {line}
                </div>
              ))}
            </div>
          ) : null}
          {generationError ? (
            <div className="body-s" role="alert">
              {generationError}
            </div>
          ) : null}
        </div>
        {savedTranslationsPending ? (
          <div
            className="diet-loading-state"
            role="status"
            aria-label={bobUiCopy.states.loading.accessibleLabel}
          >
            <span className="diet-spinner" data-size="medium" aria-hidden="true" />
          </div>
        ) : null}
        {savedTranslationsError ? (
          <div className="body-s" role="alert">
            {savedTranslationsError}
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
              {bobUiCopy.states.empty.translations}
            </span>
          </div>
        ) : null}
        {!savedTranslationsPending && !savedTranslationsError && !savedTranslationsEmpty ? (
          <SelectField
            label="Preview locale"
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
