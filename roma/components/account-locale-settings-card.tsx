'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeCanonicalLocalesFile, resolveLocaleLabel } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import settingsCopy from '../l10n/settings/en.json';
import { useRomaAccountApi } from './account-api';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { RomaLoadingState } from './roma-system-state';

type AccountLocalesPayload = {
  activeLocales: string[];
  localePolicy: {
    baseLocale: string;
    ip: { countryToLocale: Record<string, string> };
  };
};

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);

const DEFAULT_COUNTRIES_BY_LOCALE: Record<string, string[]> = {
  ar: ['SA', 'AE', 'EG', 'MA', 'DZ', 'TN', 'JO', 'LB', 'KW', 'QA', 'BH', 'OM'],
  bn: ['BD'],
  cs: ['CZ'],
  da: ['DK'],
  de: ['DE', 'AT', 'CH'],
  en: ['US', 'GB', 'AU', 'CA', 'NZ', 'IE'],
  es: ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR'],
  fi: ['FI'],
  fil: ['PH'],
  fr: ['FR', 'BE', 'CH', 'CA'],
  he: ['IL'],
  hi: ['IN'],
  hu: ['HU'],
  id: ['ID'],
  it: ['IT'],
  ja: ['JP'],
  ko: ['KR'],
  nb: ['NO'],
  nl: ['NL', 'BE'],
  pl: ['PL'],
  pt: ['PT', 'BR'],
  ro: ['RO'],
  sv: ['SE'],
  th: ['TH'],
  tr: ['TR'],
  uk: ['UA'],
  vi: ['VN'],
  'zh-hans': ['CN', 'SG'],
  'zh-tw': ['TW', 'HK', 'MO'],
};

function resolveLocaleUiLabel(code: string): string {
  const label = resolveLocaleLabel({
    locales: CANONICAL_LOCALES,
    uiLocale: 'en',
    locale: code,
  });
  return `${label} (${code})`;
}

function buildDefaultCountryToLocale(args: { enabledLocales: string[]; baseLocale: string }): Record<string, string> {
  const enabledSet = new Set(args.enabledLocales);
  const mapping: Record<string, string> = {};

  const prioritized = CANONICAL_LOCALES.map((entry) => entry.code).filter((code) => enabledSet.has(code) && code !== args.baseLocale);
  for (const locale of prioritized) {
    const countries = DEFAULT_COUNTRIES_BY_LOCALE[locale] ?? [];
    for (const country of countries) {
      if (!mapping[country]) mapping[country] = locale;
    }
  }

  return mapping;
}

export function AccountLocaleSettingsCard(args: {
  accountId: string;
  canEdit: boolean;
  onSaved?: (() => Promise<void> | void) | undefined;
}) {
  const accountApi = useRomaAccountApi();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [baseLocaleLocked, setBaseLocaleLocked] = useState(false);
  const [draftBaseLocale, setDraftBaseLocale] = useState('en');
  const [draftActiveLocales, setDraftActiveLocales] = useState<string[]>([]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await accountApi.fetchJson<{
        activeLocales: string[];
        baseLocaleLocked: boolean;
        localePolicy: AccountLocalesPayload['localePolicy'];
      }>(`/api/account/locales?_t=${Date.now()}`, { method: 'GET' });

      setBaseLocaleLocked(payload.baseLocaleLocked);
      setDraftBaseLocale(payload.localePolicy.baseLocale);
      setDraftActiveLocales(payload.activeLocales);
      setSettingsReady(true);
    } catch {
      setSettingsReady(false);
    } finally {
      setLoading(false);
    }
  }, [accountApi]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const refreshSettings = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadSettings();
    } finally {
      setRefreshing(false);
    }
  }, [loadSettings]);

  const baseLocale = draftBaseLocale;
  const localeOptions = useMemo(
    () =>
      CANONICAL_LOCALES.filter((entry) => entry.code !== baseLocale).map((entry) => ({
        code: entry.code,
        label: resolveLocaleUiLabel(entry.code),
        enabled: draftActiveLocales.includes(entry.code),
      })),
    [baseLocale, draftActiveLocales],
  );
  const saveSettings = useCallback(async () => {
    setSaving(true);

    try {
      const activeLocales = draftActiveLocales;

      const enabledLocales = [draftBaseLocale, ...activeLocales];
      const payload: AccountLocalesPayload = {
        activeLocales,
        localePolicy: {
          baseLocale: draftBaseLocale,
          ip: {
            countryToLocale: buildDefaultCountryToLocale({
              enabledLocales,
              baseLocale: draftBaseLocale,
            }),
          },
        },
      };

      await accountApi.fetchJson('/api/account/locales', {
        method: 'PUT',
        headers: accountApi.buildHeaders({ contentType: 'application/json' }),
        body: JSON.stringify(payload),
      });
      await loadSettings();
      await args.onSaved?.();
    } catch {
    } finally {
      setSaving(false);
    }
  }, [args, accountApi, draftActiveLocales, draftBaseLocale, loadSettings]);

  return (
    <section className="rd-canvas-module">
      <h2 className="heading-6">{settingsCopy.languages.title}</h2>

      {!settingsReady ? (
        <div className="roma-inline-stack">
          {loading && !refreshing ? <RomaLoadingState /> : null}
          <div className="rd-canvas-module__actions">
            <button
              className="diet-button"
              data-size="medium"
              data-type="tertiary"
              data-loading={refreshing || undefined}
              type="button"
              aria-busy={refreshing || undefined}
              disabled={loading || saving}
              onClick={() => void refreshSettings()}
            >
              {refreshing ? <span className="diet-spinner" aria-hidden="true" /> : null}
              <span className="diet-button__label">{refreshing ? settingsCopy.languages.refreshing : settingsCopy.languages.refresh}</span>
            </button>
          </div>
        </div>
      ) : null}

      {settingsReady ? (
        <div className="roma-inline-stack">
          <div className="roma-inline-stack">
            <DieterDropdownActions
              label={settingsCopy.languages.base}
              ariaLabel={settingsCopy.languages.chooseBase}
              value={baseLocale}
              disabled={loading || saving || !args.canEdit || baseLocaleLocked}
              onChange={(value) => {
                setDraftBaseLocale(value);
                setDraftActiveLocales((current) => current.filter((entry) => entry !== value));
              }}
              options={CANONICAL_LOCALES.map((entry) => ({
                value: entry.code,
                label: resolveLocaleUiLabel(entry.code),
              }))}
            />
          </div>

          <div className="roma-inline-stack">
            <div className="label-s">{settingsCopy.languages.active}</div>
            <div className="roma-locale-settings__list">
              {localeOptions.map((entry) => (
                <label key={entry.code} className="roma-locale-settings__option">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    disabled={loading || saving || !args.canEdit}
                    onChange={(event) => {
                      const nextChecked = event.target.checked;
                      setDraftActiveLocales((current) => {
                        const values = new Set(current);
                        if (nextChecked) values.add(entry.code);
                        else values.delete(entry.code);
                        return Array.from(values).sort((a, b) => a.localeCompare(b));
                      });
                    }}
                  />
                  <span className="body-s">{entry.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rd-canvas-module__actions">
            <button
              className="diet-button"
              data-size="medium"
              data-type="tertiary"
              data-loading={refreshing || undefined}
              type="button"
              aria-busy={refreshing || undefined}
              disabled={loading || saving}
              onClick={() => void refreshSettings()}
            >
              {refreshing ? <span className="diet-spinner" aria-hidden="true" /> : null}
              <span className="diet-button__label">{refreshing ? settingsCopy.languages.refreshing : settingsCopy.languages.refresh}</span>
            </button>
            <button
              className="diet-button"
              data-size="medium"
              data-type="primary"
              data-loading={saving || undefined}
              type="button"
              aria-busy={saving || undefined}
              disabled={loading || saving || !args.canEdit}
              onClick={() => void saveSettings()}
            >
              {saving ? <span className="diet-spinner" aria-hidden="true" /> : null}
              <span className="diet-button__label">{saving ? settingsCopy.languages.saving : settingsCopy.languages.save}</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
