'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeCanonicalLocalesFile, normalizeLocaleToken, resolveLocaleLabel } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { fetchParisJson } from './paris-http';

type AccountLocalesPayload = {
  locales: string[];
  policy: {
    v: 1;
    baseLocale: string;
    ip: { enabled: boolean; countryToLocale: Record<string, string> };
    switcher: { enabled: boolean };
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
  const normalized = normalizeLocaleToken(code) ?? code;
  const label = resolveLocaleLabel({ locales: CANONICAL_LOCALES, uiLocale: 'en', targetLocale: normalized });
  return `${label} (${normalized})`;
}

function buildDefaultCountryToLocale(args: { enabledLocales: string[]; baseLocale: string }): Record<string, string> {
  const baseLocale = normalizeLocaleToken(args.baseLocale);
  const enabledSet = new Set(
    args.enabledLocales.map((entry) => normalizeLocaleToken(entry)).filter((entry): entry is string => Boolean(entry)),
  );
  const mapping: Record<string, string> = {};

  const prioritized = CANONICAL_LOCALES.map((entry) => entry.code).filter((code) => enabledSet.has(code) && code !== baseLocale);
  for (const locale of prioritized) {
    const countries = DEFAULT_COUNTRIES_BY_LOCALE[locale] ?? [];
    for (const country of countries) {
      if (!mapping[country]) mapping[country] = locale;
    }
  }

  return mapping;
}

function normalizeAdditionalLocales(value: unknown, baseLocale: string): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((entry) => normalizeLocaleToken(entry))
    .filter((entry): entry is string => Boolean(entry) && entry !== baseLocale);
  return Array.from(new Set(normalized));
}

function asParisReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AccountLocaleSettingsCard(args: { accountId: string; canEdit: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftBaseLocale, setDraftBaseLocale] = useState('en');
  const [draftAdditionalLocales, setDraftAdditionalLocales] = useState<string[]>([]);
  const [draftIpEnabled, setDraftIpEnabled] = useState(false);
  const [draftSwitcherEnabled, setDraftSwitcherEnabled] = useState(true);

  const loadSettings = useCallback(async () => {
    if (!args.accountId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchParisJson<{
        locales?: unknown;
        policy?: {
          baseLocale?: unknown;
          ip?: { enabled?: unknown; countryToLocale?: unknown };
          switcher?: { enabled?: unknown };
        } | null;
      }>(`/api/accounts/${encodeURIComponent(args.accountId)}/locales?_t=${Date.now()}`, {
        method: 'GET',
      });

      const baseLocale = normalizeLocaleToken(payload.policy?.baseLocale) ?? 'en';
      setDraftBaseLocale(baseLocale);
      setDraftAdditionalLocales(normalizeAdditionalLocales(payload.locales, baseLocale));
      setDraftIpEnabled(payload.policy?.ip?.enabled === true);
      setDraftSwitcherEnabled(payload.policy?.switcher?.enabled !== false);
      setSuccess(null);
    } catch (nextError) {
      setError(asParisReason(nextError));
    } finally {
      setLoading(false);
    }
  }, [args.accountId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const baseLocale = normalizeLocaleToken(draftBaseLocale) ?? 'en';
  const localeOptions = useMemo(
    () =>
      CANONICAL_LOCALES.filter((entry) => entry.code !== baseLocale).map((entry) => ({
        code: entry.code,
        label: resolveLocaleUiLabel(entry.code),
        enabled: draftAdditionalLocales.includes(entry.code),
      })),
    [baseLocale, draftAdditionalLocales],
  );

  const saveSettings = useCallback(async () => {
    if (!args.accountId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const normalizedBase = normalizeLocaleToken(draftBaseLocale) ?? 'en';
    const additionalLocales = Array.from(
      new Set(
        draftAdditionalLocales
          .map((entry) => normalizeLocaleToken(entry))
          .filter((entry): entry is string => Boolean(entry) && entry !== normalizedBase),
      ),
    );

    const enabledLocales = [normalizedBase, ...additionalLocales];
    const payload: AccountLocalesPayload = {
      locales: additionalLocales,
      policy: {
        v: 1,
        baseLocale: normalizedBase,
        ip: {
          enabled: draftIpEnabled,
          countryToLocale: draftIpEnabled
            ? buildDefaultCountryToLocale({ enabledLocales, baseLocale: normalizedBase })
            : {},
        },
        switcher: {
          enabled: draftSwitcherEnabled,
        },
      },
    };

    try {
      await fetchParisJson(`/api/accounts/${encodeURIComponent(args.accountId)}/locales?subject=account`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await loadSettings();
      setSuccess('Saved languages.');
    } catch (nextError) {
      setError(asParisReason(nextError));
    } finally {
      setSaving(false);
    }
  }, [args.accountId, draftAdditionalLocales, draftBaseLocale, draftIpEnabled, draftSwitcherEnabled, loadSettings]);

  return (
    <section className="rd-canvas-module">
      <h2 className="heading-6">Languages</h2>
      <p className="body-m">These account languages drive automatic translation after Save for every widget in this account.</p>
      {!args.canEdit ? <p className="body-s">Read-only mode: language settings are disabled.</p> : null}
      {error ? <p className="body-m">{error}</p> : null}
      {success ? <p className="body-s">{success}</p> : null}

      <div className="roma-inline-stack">
        <label className="roma-inline-stack" htmlFor="roma-settings-base-locale">
          <span className="label-s">Base language</span>
          <select
            id="roma-settings-base-locale"
            className="roma-select"
            value={baseLocale}
            disabled={loading || saving || !args.canEdit}
            onChange={(event) => {
              const nextBase = normalizeLocaleToken(event.target.value) ?? 'en';
              setDraftBaseLocale(nextBase);
              setDraftAdditionalLocales((current) => current.filter((entry) => entry !== nextBase));
            }}
          >
            {CANONICAL_LOCALES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {resolveLocaleUiLabel(entry.code)}
              </option>
            ))}
          </select>
        </label>

        <div className="roma-inline-stack">
          <div className="label-s">Enabled languages</div>
          <p className="body-s">Base language is always enabled. Add the other languages that should update automatically after Save.</p>
          <div className="roma-locale-settings__list">
            {localeOptions.map((entry) => (
              <label key={entry.code} className="roma-locale-settings__option">
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  disabled={loading || saving || !args.canEdit}
                  onChange={(event) => {
                    const nextChecked = event.target.checked;
                    setDraftAdditionalLocales((current) => {
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

        <div className="roma-locale-settings__toggles">
          <label className="roma-locale-settings__option">
            <input
              type="checkbox"
              checked={draftIpEnabled}
              disabled={loading || saving || !args.canEdit}
              onChange={(event) => setDraftIpEnabled(event.target.checked)}
            />
            <span className="body-s">Auto-detect language by visitor IP</span>
          </label>
          <label className="roma-locale-settings__option">
            <input
              type="checkbox"
              checked={draftSwitcherEnabled}
              disabled={loading || saving || !args.canEdit}
              onChange={(event) => setDraftSwitcherEnabled(event.target.checked)}
            />
            <span className="body-s">Show language switcher in the widget</span>
          </label>
        </div>

        <div className="rd-canvas-module__actions">
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="line2"
            type="button"
            disabled={loading || saving}
            onClick={() => void loadSettings()}
          >
            <span className="diet-btn-txt__label body-m">{loading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            disabled={loading || saving || !args.canEdit}
            onClick={() => void saveSettings()}
          >
            <span className="diet-btn-txt__label body-m">{saving ? 'Saving…' : 'Save languages'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
