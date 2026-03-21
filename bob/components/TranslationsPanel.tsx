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

type TranslationOutputEntry = {
  path: string;
  value: string;
};

type TranslationsPanelData = {
  publicId: string;
  widgetType: string;
  baseLocale: string;
  activeLocales: string[];
  selectedLocale: string;
  statuses: TranslationStatusEntry[];
  translatedOutput: TranslationOutputEntry[];
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

function resolveStatusLabel(status: TranslationStatus): string {
  if (status === 'base') return 'Base';
  if (status === 'dirty') return 'Updating';
  if (status === 'superseded') return 'Needs refresh';
  return 'Ready';
}

function resolveStatusTone(status: TranslationStatus): 'muted' | 'warning' | 'success' | 'neutral' {
  if (status === 'dirty') return 'warning';
  if (status === 'succeeded') return 'success';
  if (status === 'base') return 'neutral';
  return 'muted';
}

function normalizePanelData(payload: unknown): TranslationsPanelData | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const publicId = typeof record.publicId === 'string' ? record.publicId.trim() : '';
  const widgetType = typeof record.widgetType === 'string' ? record.widgetType.trim() : '';
  const baseLocale = typeof record.baseLocale === 'string' ? record.baseLocale.trim() : '';
  const selectedLocale = typeof record.selectedLocale === 'string' ? record.selectedLocale.trim() : '';
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
  const translatedOutput = Array.isArray(record.translatedOutput)
    ? record.translatedOutput
        .map((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
          const item = entry as Record<string, unknown>;
          const path = typeof item.path === 'string' ? item.path.trim() : '';
          const value = typeof item.value === 'string' ? item.value : '';
          if (!path) return null;
          return { path, value };
        })
        .filter((entry): entry is TranslationOutputEntry => Boolean(entry))
    : [];

  if (!publicId || !widgetType || !baseLocale) return null;
  return {
    publicId,
    widgetType,
    baseLocale,
    activeLocales,
    selectedLocale: selectedLocale || baseLocale,
    statuses,
    translatedOutput,
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
  const [requestedLocale, setRequestedLocale] = useState('');
  const [data, setData] = useState<TranslationsPanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRequestedLocale('');
    setData(null);
    setError(null);
  }, [publicId]);

  useEffect(() => {
    if (!publicId) return;
    const controller = new AbortController();
    const url = new URL(`/api/account/instances/${publicId}/translations`, window.location.origin);
    if (requestedLocale) url.searchParams.set('locale', requestedLocale);

    setLoading(true);
    setError(null);

    fetch(url.toString(), {
      method: 'GET',
      credentials: 'same-origin',
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
        setError(message === 'HTTP_404' ? 'Translations are not available for this widget yet.' : 'Builder could not load translations right now.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [publicId, requestedLocale]);

  const selectedLocale = requestedLocale || data?.selectedLocale || data?.baseLocale || '';
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

  const statusEntries = useMemo(() => {
    const statuses = data?.statuses ?? [];
    return statuses.map((entry) => ({
      ...entry,
      label: resolveLocaleLabel(entry.locale),
      tone: resolveStatusTone(entry.status),
      copy: resolveStatusLabel(entry.status),
      isSelected: selectedLocale === entry.locale,
    }));
  }, [data?.statuses, selectedLocale]);

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
        Inspect Tokyo translation truth for this widget. Translation stays read-only here; widget locale behavior lives below.
      </div>

      <div className="tdmenucontent__fields translations-panel__body">
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
            <div className="label-s tdmenucontent__cluster-label">Translation status</div>
          </div>
          <div className="tdmenucontent__cluster-body">
            {loading ? <div className="settings-panel__status body-s">Loading translations…</div> : null}
            {error ? <div className="settings-panel__error body-s">{error}</div> : null}
            {!loading && !error && statusEntries.length > 0 ? (
              <div className="translations-panel__status-list">
                {statusEntries.map((entry) => (
                  <div key={entry.locale} className="translations-panel__status-row">
                    <span className="body-s">{entry.label}</span>
                    <span
                      className="translations-panel__badge"
                      data-tone={entry.tone}
                      data-selected={entry.isSelected ? 'true' : 'false'}
                    >
                      {entry.copy}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="tdmenucontent__cluster">
          <div className="tdmenucontent__cluster-header">
            <div className="label-s tdmenucontent__cluster-label">Translated output</div>
          </div>
          <div className="tdmenucontent__cluster-body">
            <SelectField
              label="View locale"
              value={selectedLocale}
              onChange={(next) => setRequestedLocale(next)}
              options={localeOptions.length > 0 ? localeOptions : [{ value: '', label: 'No locales available yet' }]}
              disabled={localeOptions.length === 0}
            />
            {selectedLocale === data?.baseLocale ? (
              <div className="settings-panel__note body-s">The base locale is shown for reference only and cannot be edited here.</div>
            ) : null}
            {!loading && !error && (data?.translatedOutput.length ?? 0) === 0 ? (
              <div className="settings-panel__warning body-s">No translated output is ready for this locale yet.</div>
            ) : null}
            {(data?.translatedOutput ?? []).map((entry) => (
              <div key={entry.path} className="translations-panel__entry">
                <div className="label-s label-muted">{entry.path}</div>
                <div className="body-s translations-panel__value">{entry.value || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
