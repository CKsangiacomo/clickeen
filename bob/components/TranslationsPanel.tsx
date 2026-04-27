'use client';

import { useMemo } from 'react';
import {
  normalizeCanonicalLocalesFile,
  normalizeLocaleToken,
  resolveLocaleLabel as resolveCanonicalLocaleLabel,
} from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import type { TranslationsPreviewData } from './useTranslationsPreviewState';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);
const BUILDER_UI_LOCALE = 'en';

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
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
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

export function TranslationsPanel({
  overlayPreviewLocale,
  onOverlayPreviewLocaleChange,
  translationsData,
  translationsLoading,
  translationsError,
}: {
  overlayPreviewLocale: string;
  onOverlayPreviewLocaleChange: (locale: string) => void;
  translationsData: TranslationsPreviewData | null;
  translationsLoading: boolean;
  translationsError: string | null;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const localeCap = chrome.policy?.caps['l10n.locales.max'];
  const showLocaleUpsell = typeof localeCap === 'number' && Number.isFinite(localeCap);

  const localeOptions = useMemo(() => {
    const locales = translationsData?.status === 'ready' ? translationsData.readyLocales : [];
    return locales.map((locale) => ({
      value: locale,
      label: resolveLocaleLabel(locale),
    }));
  }, [translationsData]);

  const localeValue =
    overlayPreviewLocale && localeOptions.some((option) => option.value === overlayPreviewLocale)
      ? overlayPreviewLocale
      : translationsData?.baseLocale || localeOptions[0]?.value || '';

  const selectOptions =
    localeOptions.length > 0
      ? localeOptions
      : [
          {
            value: '',
            label: translationsLoading
              ? 'Checking translations...'
              : translationsError
                ? 'Translations unavailable'
              : translationsData?.status === 'accepted' || translationsData?.status === 'working'
                ? 'Translations preparing'
                : translationsData?.status === 'failed'
                  ? 'Translations failed'
                  : 'Translations not ready yet',
          },
        ];
  const translationStatusTitle = translationsLoading
    ? 'Checking translations'
    : translationsError
      ? 'Translations unavailable'
      : translationsData?.status === 'ready'
        ? 'Translations are ready'
        : translationsData?.status === 'failed'
          ? 'Translations failed'
          : 'Translations are preparing';
  const translationStatusBody = translationsLoading
    ? 'Builder is checking whether this widget is ready in your account languages.'
    : translationsError
      ? translationsError
      : translationsData?.status === 'ready'
        ? 'Preview this widget in the languages available for this account.'
        : translationsData?.status === 'failed'
          ? 'Save again to request translation for the current widget state.'
          : 'Translations are queued for the current widget state. Preview will unlock when they are ready.';

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
          <div className="label-s label-muted">Translation status</div>
          <div className="body-s">{translationStatusTitle}</div>
          <div className="label-s label-muted">{translationStatusBody}</div>
        </div>
        <SelectField
          label="Display locale"
          value={localeValue}
          onChange={onOverlayPreviewLocaleChange}
          options={selectOptions}
          disabled={!selectOptions[0]?.value}
        />
        {showLocaleUpsell ? (
          <div className="settings-panel__note settings-panel__note--upsell">
            <div>
              <div className="label-s">More languages</div>
              <div className="body-s">
                Your current plan includes up to {localeCap} display languages. Upgrade to unlock more locales.
              </div>
            </div>
            <button
              type="button"
              className="diet-btn-txt"
              data-size="sm"
              data-variant="neutral"
              onClick={() =>
                chrome.requestUpsell(
                  'coreui.upsell.reason.capReached',
                  `l10n.locales.max=${localeCap}`,
                )
              }
            >
              <span className="diet-btn-txt__label">Upgrade plan</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
