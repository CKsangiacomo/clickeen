'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeCanonicalLocalesFile, normalizeLocaleToken, resolveLocaleLabel } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import type { PolicyProfile } from '@clickeen/ck-policy';
import { useRomaAccountApi } from './account-api';
import { useRomaMe } from './use-roma-me';
import {
  materializeAccountAdditionalLocales,
  normalizeAdditionalAccountLocales,
  resolveSystemChosenAdditionalLocale,
  usesSystemChosenAdditionalLocale,
} from '@roma/lib/account-locales';

type AccountLocalesPayload = {
  locales: string[];
  policy: {
    v: 1;
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

const ACCOUNT_LOCALES_REASON_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again to manage account languages.',
  'coreui.errors.auth.contextUnavailable': 'Account languages are unavailable right now. Please try again.',
  'coreui.errors.auth.forbidden': 'You do not have permission to manage account languages.',
  'coreui.errors.db.readFailed': 'Failed to load account languages. Please try again.',
  'coreui.errors.db.writeFailed': 'Saving account languages failed. Please try again.',
  'coreui.errors.payload.invalid': 'The account language request was invalid. Please try again.',
  'coreui.errors.payload.invalidJson': 'The account language request was invalid. Please try again.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
  'coreui.errors.account.locales.invalid': 'Account language settings are invalid. Please review the inputs and try again.',
  'coreui.upsell.reason.capReached': 'Your current plan cannot enable more languages.',
};

function resolveAccountLocalesErrorCopy(reason: unknown, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = ACCOUNT_LOCALES_REASON_COPY[normalized];
  if (mapped) return mapped;
  if (normalized.startsWith('HTTP_') || normalized.startsWith('coreui.')) return fallback;
  return normalized;
}

export function AccountLocaleSettingsCard(args: {
  accountId: string;
  canEdit: boolean;
  onSaved?: (() => Promise<void> | void) | undefined;
}) {
  const me = useRomaMe();
  const accountApi = useRomaAccountApi(me.data);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftBaseLocale, setDraftBaseLocale] = useState('en');
  const [draftAdditionalLocales, setDraftAdditionalLocales] = useState<string[]>([]);
  const policyProfile = useMemo(() => {
    const raw = typeof me.data?.authz?.profile === 'string' ? me.data.authz.profile.trim() : '';
    switch (raw) {
      case 'free':
      case 'tier1':
      case 'tier2':
      case 'tier3':
        return raw as PolicyProfile;
      default:
        return null;
    }
  }, [me.data]);
  const usesSystemLocale = usesSystemChosenAdditionalLocale(policyProfile);

  const loadSettings = useCallback(async () => {
    if (!args.accountId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await accountApi.fetchJson<{
        locales?: unknown;
        policy?: {
          baseLocale?: unknown;
          ip?: { countryToLocale?: unknown };
        } | null;
      }>(`/api/account/locales?_t=${Date.now()}`, { method: 'GET' });

      const baseLocale = normalizeLocaleToken(payload.policy?.baseLocale) ?? 'en';
      const additionalLocales = normalizeAdditionalAccountLocales(payload.locales, baseLocale);
      setDraftBaseLocale(baseLocale);
      setDraftAdditionalLocales(additionalLocales);
      setSuccess(null);
    } catch (nextError) {
      setError(resolveAccountLocalesErrorCopy(nextError instanceof Error ? nextError.message : nextError, 'Failed to load account languages. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [accountApi, args.accountId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const baseLocale = normalizeLocaleToken(draftBaseLocale) ?? 'en';
  const effectiveAdditionalLocales = useMemo(
    () =>
      materializeAccountAdditionalLocales({
        profile: policyProfile,
        baseLocale,
        requestedLocales: draftAdditionalLocales,
      }),
    [baseLocale, draftAdditionalLocales, policyProfile],
  );
  const enabledLocales = useMemo(
    () => [baseLocale, ...effectiveAdditionalLocales.filter((entry) => entry !== baseLocale)],
    [baseLocale, effectiveAdditionalLocales],
  );
  const systemChosenLocale = useMemo(
    () => (usesSystemLocale ? resolveSystemChosenAdditionalLocale({ baseLocale }) : null),
    [baseLocale, usesSystemLocale],
  );
  const localeOptions = useMemo(
    () =>
      CANONICAL_LOCALES.filter((entry) => entry.code !== baseLocale).map((entry) => ({
        code: entry.code,
        label: resolveLocaleUiLabel(entry.code),
        enabled: effectiveAdditionalLocales.includes(entry.code),
      })),
    [baseLocale, effectiveAdditionalLocales],
  );
  const saveSettings = useCallback(async () => {
    if (!args.accountId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const normalizedBase = normalizeLocaleToken(draftBaseLocale) ?? 'en';
    const additionalLocales = materializeAccountAdditionalLocales({
      profile: policyProfile,
      baseLocale: normalizedBase,
      requestedLocales: draftAdditionalLocales,
    });

    const enabledLocales = [normalizedBase, ...additionalLocales];
    const payload: AccountLocalesPayload = {
      locales: additionalLocales,
      policy: {
        v: 1,
        baseLocale: normalizedBase,
        ip: {
          countryToLocale: buildDefaultCountryToLocale({ enabledLocales, baseLocale: normalizedBase }),
        },
      },
    };

    try {
      await accountApi.fetchJson(`/api/account/locales?subject=account`, {
        method: 'PUT',
        headers: accountApi.buildHeaders({ contentType: 'application/json' }),
        body: JSON.stringify(payload),
      });
      await loadSettings();
      await args.onSaved?.();
      setSuccess('Saved languages.');
    } catch (nextError) {
      setError(
        resolveAccountLocalesErrorCopy(
          nextError instanceof Error ? nextError.message : nextError,
          'Saving account languages failed. Please try again.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }, [
    args,
    accountApi,
    draftAdditionalLocales,
    draftBaseLocale,
    loadSettings,
    policyProfile,
  ]);

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
          <p className="body-s">
            {usesSystemLocale
              ? `Base language is always enabled. Free includes one system-selected additional language${systemChosenLocale ? `: ${resolveLocaleUiLabel(systemChosenLocale)}` : ''}.`
              : 'Base language is always enabled. Add the other languages that should update automatically after Save.'}
          </p>
          <div className="roma-locale-settings__list">
            {localeOptions.map((entry) => (
              <label key={entry.code} className="roma-locale-settings__option">
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  disabled={loading || saving || !args.canEdit || usesSystemLocale}
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

        <div className="roma-inline-stack">
          <div className="label-s">Widget locale behavior</div>
          <p className="body-s">
            Locale switcher visibility and IP-based locale behavior now belong to each widget in Builder.
            Settings only decide which languages this account has available and keep the country-to-locale support map up to date.
          </p>
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
