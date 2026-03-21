'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { normalizeWidgetLocaleSwitcherSettings, type WidgetLocaleSwitcherSettings } from '@clickeen/ck-contracts';
import {
  normalizeCanonicalLocalesFile,
  normalizeLocaleToken,
  resolveLocaleLabel as resolveCanonicalLocaleLabel,
} from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';

type TranslationStatus = 'base' | 'dirty' | 'succeeded' | 'superseded';

type TranslationStatusEntry = {
  locale: string;
  status: TranslationStatus;
};

type TranslationsPanelData = {
  baseLocale: string;
  activeLocales: string[];
  statuses: TranslationStatusEntry[];
};

type OverallTranslationStatus = {
  title: string;
  detail: string;
  className: 'settings-panel__note' | 'settings-panel__warning' | 'settings-panel__success';
};

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);

const ATTACH_TO_OPTIONS: Array<{ value: WidgetLocaleSwitcherSettings['attachTo']; label: string }> = [
  { value: 'stage', label: 'Stage' },
  { value: 'pod', label: 'Pod' },
];

const POSITION_OPTIONS: Array<{ value: WidgetLocaleSwitcherSettings['position']; label: string }> = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'right-middle', label: 'Right middle' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'left-middle', label: 'Left middle' },
];

function resolveLocaleLabel(locale: string): string {
  const normalized = normalizeLocaleToken(locale) ?? '';
  if (!normalized) return '';
  return (
    resolveCanonicalLocaleLabel({
      locales: CANONICAL_LOCALES,
      uiLocale: normalized,
      targetLocale: normalized,
    }) || normalized
  );
}

function normalizePanelData(payload: unknown): TranslationsPanelData | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const baseLocale = typeof record.baseLocale === 'string' ? record.baseLocale.trim() : '';
  const activeLocales = Array.isArray(record.activeLocales)
    ? record.activeLocales.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean)
    : [];
  const statuses = Array.isArray(record.statuses)
    ? record.statuses
        .map((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
          const item = entry as Record<string, unknown>;
          const locale = typeof item.locale === 'string' ? item.locale.trim() : '';
          const status = typeof item.status === 'string' ? item.status.trim() : '';
          if (!locale || !status) return null;
          if (status !== 'base' && status !== 'dirty' && status !== 'succeeded' && status !== 'superseded') return null;
          return { locale, status } as TranslationStatusEntry;
        })
        .filter((entry): entry is TranslationStatusEntry => Boolean(entry))
    : [];

  if (!baseLocale) return null;
  return {
    baseLocale,
    activeLocales,
    statuses,
  };
}

function resolveOverallTranslationStatus(data: TranslationsPanelData | null): OverallTranslationStatus | null {
  if (!data) return null;
  const translatedLocales = data.activeLocales.filter((locale) => locale !== data.baseLocale);
  if (translatedLocales.length === 0) {
    return {
      title: 'No active translations yet',
      detail: 'Add more locales in Settings before translation preview becomes available.',
      className: 'settings-panel__note',
    };
  }

  const translatedStatuses = data.statuses.filter((entry) => entry.locale !== data.baseLocale);
  if (translatedStatuses.some((entry) => entry.status === 'dirty')) {
    return {
      title: 'Updating',
      detail: 'Translations are still catching up with the latest saved widget content.',
      className: 'settings-panel__warning',
    };
  }
  if (translatedStatuses.some((entry) => entry.status === 'superseded')) {
    return {
      title: 'Needs refresh',
      detail: 'Save the widget again to refresh translations against the latest content.',
      className: 'settings-panel__warning',
    };
  }
  if (translatedStatuses.some((entry) => entry.status === 'succeeded')) {
    return {
      title: 'Up to date',
      detail: 'Active locales are ready to preview.',
      className: 'settings-panel__success',
    };
  }
  return {
    title: 'Not available yet',
    detail: 'Translations are not ready for this widget yet.',
    className: 'settings-panel__note',
  };
}

function ToggleField({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="diet-toggle diet-toggle--block" data-size="md">
      <span className="diet-toggle__label label-s" id={`${id}-label`}>
        {label}
      </span>
      <input
        id={id}
        className="diet-toggle__input sr-only"
        type="checkbox"
        role="switch"
        aria-labelledby={`${id}-label`}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label className="diet-toggle__switch" htmlFor={id} aria-hidden="true">
        <span className="diet-toggle__knob" />
      </label>
    </div>
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

export function TranslationsPanel() {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const apiFetch = session.apiFetch;
  const baseId = useId();
  const publicId = chrome.meta?.publicId ?? '';
  const localeSwitcherState =
    session.instanceData && typeof session.instanceData === 'object'
      ? (session.instanceData as Record<string, unknown>).localeSwitcher
      : null;
  const switcher = useMemo(
    () => normalizeWidgetLocaleSwitcherSettings(localeSwitcherState ?? null),
    [localeSwitcherState],
  );
  const [data, setData] = useState<TranslationsPanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
  }, [publicId]);

  useEffect(() => {
    if (!publicId) return;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    apiFetch(`/api/account/instances/${encodeURIComponent(publicId)}/translations`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }
        const payload = normalizePanelData(await response.json());
        if (!payload) throw new Error('coreui.errors.translations.invalid');
        setData(payload);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Builder could not load translations right now.';
        setData(null);
        setError(
          message === 'HTTP_404'
            ? 'Translations are not available for this widget yet.'
            : 'Builder could not load translations right now.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [apiFetch, publicId]);

  const localeOptions = useMemo(() => {
    const locales = data?.activeLocales ?? [];
    return locales.map((locale) => ({
      value: locale,
      label: resolveLocaleLabel(locale),
    }));
  }, [data?.activeLocales]);
  const hasMultipleLocales = localeOptions.length > 1;
  const fixedLocaleValue =
    switcher.alwaysShowLocale && localeOptions.some((option) => option.value === switcher.alwaysShowLocale)
      ? switcher.alwaysShowLocale
      : localeOptions[0]?.value || data?.baseLocale || '';
  const previewLocaleValue = (() => {
    const normalized = normalizeLocaleToken(chrome.preview.locale) ?? '';
    if (normalized && localeOptions.some((option) => option.value === normalized)) return normalized;
    return data?.baseLocale || localeOptions[0]?.value || '';
  })();
  const overallStatus = resolveOverallTranslationStatus(data);

  useEffect(() => {
    if (!data?.baseLocale) return;
    if (!previewLocaleValue) return;
    if (previewLocaleValue === data.baseLocale && chrome.preview.locale) {
      chrome.setPreview({ locale: '' });
    }
  }, [chrome.preview.locale, chrome.setPreview, data?.baseLocale, previewLocaleValue]);

  if (!session.compiled) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">Translations</div>
        <div className="label-s label-muted">Load a widget to inspect its translations.</div>
      </div>
    );
  }

  const setLocaleSwitcherField = (field: keyof WidgetLocaleSwitcherSettings, value: string | boolean | null) => {
    session.applyOps([{ op: 'set', path: `localeSwitcher.${field}`, value }]);
  };

  const handleByIpChange = (checked: boolean) => {
    const ops: Array<{ op: 'set'; path: string; value: string | boolean | null }> = [
      { op: 'set', path: 'localeSwitcher.byIp', value: checked },
    ];
    if (!checked && !switcher.alwaysShowLocale) {
      ops.push({
        op: 'set',
        path: 'localeSwitcher.alwaysShowLocale',
        value: fixedLocaleValue || null,
      });
    }
    session.applyOps(ops);
  };

  return (
    <div className="tdmenucontent">
      <div className="heading-3">Translations</div>
      <div className="label-s label-muted">
        Inspect whether translations are current for this widget. Translation stays read-only here; locale viewing happens in the preview.
      </div>

      <div className="tdmenucontent__fields">
        <div className="tdmenucontent__cluster">
          <div className="tdmenucontent__cluster-header">
            <div className="label-s tdmenucontent__cluster-label">Widget locale behavior</div>
          </div>
          <div className="tdmenucontent__cluster-body">
            <ToggleField
              id={`${baseId}-switcher-enabled`}
              label="Show locale switcher"
              checked={switcher.enabled}
              disabled={!hasMultipleLocales}
              onChange={(checked) => setLocaleSwitcherField('enabled', checked)}
            />
            <ToggleField
              id={`${baseId}-switcher-ip`}
              label="Show by IP"
              checked={switcher.byIp}
              disabled={!hasMultipleLocales}
              onChange={handleByIpChange}
            />
            {!hasMultipleLocales ? (
              <div className="settings-panel__note body-s">
                Add more active locales in Settings before locale presentation controls affect this widget.
              </div>
            ) : null}
            {!switcher.byIp ? (
              <SelectField
                label="Always show"
                value={fixedLocaleValue}
                onChange={(next) => setLocaleSwitcherField('alwaysShowLocale', next || null)}
                options={localeOptions.length > 0 ? localeOptions : [{ value: '', label: 'No locales available yet' }]}
                disabled={!hasMultipleLocales}
              />
            ) : null}
            {switcher.enabled ? (
              <>
                <SelectField
                  label="Attach to"
                  value={switcher.attachTo}
                  onChange={(next) => setLocaleSwitcherField('attachTo', next as WidgetLocaleSwitcherSettings['attachTo'])}
                  options={ATTACH_TO_OPTIONS}
                />
                <SelectField
                  label="Position"
                  value={switcher.position}
                  onChange={(next) => setLocaleSwitcherField('position', next as WidgetLocaleSwitcherSettings['position'])}
                  options={POSITION_OPTIONS}
                />
                <div className="settings-panel__note">
                  Style the locale switcher in <strong>Appearance</strong> and <strong>Typography</strong>. The switcher stays a normal widget element, not a special translation UI.
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="tdmenucontent__cluster">
          <div className="tdmenucontent__cluster-header">
            <div className="label-s tdmenucontent__cluster-label">Translation freshness</div>
          </div>
          <div className="tdmenucontent__cluster-body">
            {loading ? <div className="settings-panel__status body-s">Loading translations…</div> : null}
            {error ? <div className="settings-panel__error body-s">{error}</div> : null}
            {!loading && !error && overallStatus ? (
              <div className={`${overallStatus.className} body-s`}>
                <strong>{overallStatus.title}</strong>
                <div>{overallStatus.detail}</div>
              </div>
            ) : null}
            <SelectField
              label="Show translation"
              value={previewLocaleValue}
              onChange={(next) =>
                chrome.setPreview({
                  locale: next === data?.baseLocale ? '' : next,
                })
              }
              options={localeOptions.length > 0 ? localeOptions : [{ value: '', label: 'No locales available yet' }]}
              disabled={localeOptions.length === 0}
            />
            <div className="settings-panel__note body-s">
              This loads the selected locale into the preview only. The drawer stays read-only.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
