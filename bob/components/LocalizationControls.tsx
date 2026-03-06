'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeLocaleToken } from '../lib/l10n/instance';
import { getIcon } from '../lib/icons';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { can } from '@clickeen/ck-policy';
import localesJson from '../../config/locales.json';
import { normalizeCanonicalLocalesFile, resolveLocaleLabel } from '@clickeen/l10n';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);
const MINIBOB_TRANSLATIONS_UPSELL_MESSAGE = 'Create a free account to see your FAQs widget in all languages.';

type LocalizationControlsProps = {
  mode?: 'translate' | 'settings';
  section?: 'full' | 'selector' | 'footer';
};

type AccountLocalesPayload = {
  locales: string[];
  policy: {
    v: 1;
    baseLocale: string;
    ip: { enabled: boolean; countryToLocale: Record<string, string> };
    switcher: { enabled: boolean };
  };
};

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
  const uiLocale = 'en';
  const normalized = normalizeLocaleToken(code) ?? code;
  const label = resolveLocaleLabel({ locales: CANONICAL_LOCALES, uiLocale, targetLocale: normalized });
  return `${label} (${normalized})`;
}

function buildDefaultCountryToLocale(args: { enabledLocales: string[]; baseLocale: string }): Record<string, string> {
  const baseLocale = normalizeLocaleToken(args.baseLocale);
  const enabledSet = new Set(
    args.enabledLocales.map((entry) => normalizeLocaleToken(entry)).filter((entry): entry is string => Boolean(entry)),
  );
  const mapping: Record<string, string> = {};

  // Only map non-base locales. Base locale is the fallback when a country isn't mapped.
  const prioritized = CANONICAL_LOCALES.map((entry) => entry.code).filter((code) => enabledSet.has(code) && code !== baseLocale);
  for (const locale of prioritized) {
    const countries = DEFAULT_COUNTRIES_BY_LOCALE[locale] ?? [];
    for (const country of countries) {
      if (!mapping[country]) mapping[country] = locale;
    }
  }

  return mapping;
}

export function LocalizationControls({ mode = 'translate', section = 'full' }: LocalizationControlsProps) {
  const session = useWidgetSession();
  const {
    meta,
    compiled,
    locale,
    policy,
    isDirty,
    isPublishing,
    save,
    setLocalePreview,
    saveLocaleOverrides,
    refreshLocaleTranslations,
    revertLocaleOverrides,
  } = session;
  const publicId = meta?.publicId ? String(meta.publicId) : '';
  const accountId = meta?.accountId ? String(meta.accountId) : '';
  const widgetType = compiled?.widgetname ?? '';
  const isTranslatePanel = mode === 'translate';
  const minibobTranslationsLocked = policy.profile === 'minibob' && session.minibobPersonalizationUsed;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showSelector = section !== 'footer';
  const showFooter = section !== 'selector';
  const accountError = locale.accountLocalesInvalid;
  const instanceLocales = locale.overlayEntries;
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [draftBaseLocale, setDraftBaseLocale] = useState(locale.accountL10nPolicy.baseLocale);
  const [draftAdditionalLocales, setDraftAdditionalLocales] = useState<string[]>([]);
  const [draftIpEnabled, setDraftIpEnabled] = useState(locale.accountL10nPolicy.ip.enabled);
  const [draftSwitcherEnabled, setDraftSwitcherEnabled] = useState(locale.accountL10nPolicy.switcher.enabled);
  const [draftCountryToLocale, setDraftCountryToLocale] = useState<Record<string, string>>({});
  const isSyncQueued = locale.sync.stage === 'queuing';
  const isSyncTranslating = locale.sync.stage === 'translating';
  const isSyncFailed = locale.sync.stage === 'failed';
  const isSyncBusy = isSyncQueued || isSyncTranslating;

  const availableLocales = useMemo(() => {
    if (!showSelector) return [locale.baseLocale];
    const baseLocale = locale.baseLocale;
    if (minibobTranslationsLocked) return [baseLocale];
    const normalized = locale.availableLocales
      .map((value) => normalizeLocaleToken(value))
      .filter((value): value is string => Boolean(value));
    const set = new Set<string>(normalized);
    const rest = Array.from(set)
      .filter((code) => code !== baseLocale)
      .sort();
    return [baseLocale, ...rest];
  }, [locale.availableLocales, locale.baseLocale, showSelector, minibobTranslationsLocked]);

  const activeLocale = locale.activeLocale;
  const baseLocale = locale.baseLocale;
  const isLocaleMode = activeLocale !== baseLocale;
  const isStale = locale.stale;
  const activeLocaleToken = normalizeLocaleToken(activeLocale);
  const materializedOverlayLocales = useMemo(() => {
    const configured = new Set(
      locale.availableLocales
        .map((value) => normalizeLocaleToken(value))
        .filter((value): value is string => Boolean(value)),
    );
    const normalized = instanceLocales
      .filter((entry) => {
        if (normalizeLocaleToken(entry.locale) === baseLocale) return false;
        if (!entry.baseFingerprint || !/^[a-f0-9]{64}$/i.test(entry.baseFingerprint)) return false;
        return entry.baseOps.length > 0 || entry.userOps.length > 0;
      })
      .map((entry) => normalizeLocaleToken(entry.locale))
      .filter((value): value is string => value !== null && configured.has(value));
    return Array.from(new Set(normalized)).sort();
  }, [instanceLocales, baseLocale, locale.availableLocales]);
  const overlayLocales = useMemo(() => {
    return [baseLocale, ...materializedOverlayLocales];
  }, [baseLocale, materializedOverlayLocales]);
  const overlayLocaleSet = useMemo(() => new Set(overlayLocales), [overlayLocales]);
  const hasInstance = Boolean(publicId && widgetType);
  const selectionDisabled =
    minibobTranslationsLocked ||
    !hasInstance ||
    locale.loading ||
    availableLocales.length <= 1;
  const publishGate = can(policy, 'instance.publish');
  const canPublish = publishGate.allow;
  const showEmptyState =
    showSelector &&
    hasInstance &&
    availableLocales.length > 1 &&
    overlayLocales.length <= 1 &&
    !accountError &&
    !minibobTranslationsLocked;

  const selectLocales = useMemo(() => {
    if (!showSelector) return [baseLocale];
    if (minibobTranslationsLocked) return [baseLocale];
    if (availableLocales.includes(activeLocale)) return availableLocales;
    const deduped = Array.from(new Set([activeLocale, ...availableLocales]));
    const rest = deduped.filter((code) => code !== baseLocale).sort();
    return [baseLocale, ...rest];
  }, [availableLocales, activeLocale, baseLocale, showSelector, minibobTranslationsLocked]);

  const localeOptions = useMemo(() => {
    const uiLocale = 'en';
    return selectLocales.map((code) => {
      const normalized = normalizeLocaleToken(code) ?? code;
      const languageLabel = resolveLocaleLabel({ locales: CANONICAL_LOCALES, uiLocale, targetLocale: normalized });
      const baseLabel = normalized === baseLocale ? `Base - ${languageLabel} (${normalized})` : `${languageLabel} (${normalized})`;
      const pending = normalized !== baseLocale && !overlayLocaleSet.has(normalized);
      const label = pending ? `${baseLabel} (Pending)` : baseLabel;
      return { value: normalized, label };
    });
  }, [selectLocales, baseLocale, overlayLocaleSet]);
  const localeOptionsKey = useMemo(() => localeOptions.map((option) => option.value).join('|'), [localeOptions]);

  const translateNote = (() => {
    if (policy.profile === 'minibob') return null;
    if (!isTranslatePanel) return null;
    if (!isLocaleMode) {
      return 'Base content is only editable in Content panel.';
    }
    return `Translation-only mode. To add or remove content, switch to Content (${baseLocale}), edit, then click "Save".`;
  })();

  const activeLocaleEntry = useMemo(() => {
    return instanceLocales.find((entry) => normalizeLocaleToken(entry.locale) === activeLocaleToken) ?? null;
  }, [instanceLocales, activeLocaleToken]);
  const hasManualOverrides = Boolean(activeLocaleEntry?.hasUserOps);
  const activeLocaleMissingOverlay =
    isLocaleMode &&
    !locale.loading &&
    !accountError &&
    !minibobTranslationsLocked &&
    !overlayLocaleSet.has(activeLocaleToken ?? '');

  const translationsStatus = useMemo(() => {
    if (minibobTranslationsLocked) {
      return { tone: 'unavailable', label: 'Upgrade required' };
    }
    if (isSyncQueued) {
      return { tone: 'pending', label: 'Queuing' };
    }
    if (isSyncTranslating) {
      return { tone: 'pending', label: 'Translating' };
    }
    if (isSyncFailed) {
      return { tone: 'unavailable', label: 'Failed' };
    }
    if (locale.loading) {
      return { tone: 'pending', label: 'Loading' };
    }
    if (accountError || locale.error) {
      return { tone: 'unavailable', label: 'Unavailable' };
    }
    if (!hasInstance) {
      return { tone: 'unavailable', label: 'No instance' };
    }
    if (isStale) {
      return { tone: 'pending', label: 'Needs save' };
    }
    if (availableLocales.length <= 1) {
      return { tone: 'unavailable', label: 'EN only' };
    }
    if (materializedOverlayLocales.length === 0) {
      return { tone: 'pending', label: 'Configured' };
    }
    return { tone: 'ready', label: 'Ready' };
  }, [
    availableLocales.length,
    hasInstance,
    isStale,
    locale.error,
    locale.loading,
    isSyncFailed,
    isSyncQueued,
    isSyncTranslating,
    minibobTranslationsLocked,
    materializedOverlayLocales.length,
    accountError,
  ]);

  const syncUpdatedAtLabel = useMemo(() => {
    if (!locale.sync.lastUpdatedAt) return null;
    const parsed = new Date(locale.sync.lastUpdatedAt);
    if (!Number.isFinite(parsed.getTime())) return null;
    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [locale.sync.lastUpdatedAt]);

  const syncDetailMessage = useMemo(() => {
    const detail = locale.sync.detail ? locale.sync.detail.trim() : '';
    if (!detail) return null;
    if (!syncUpdatedAtLabel) return detail;
    return `${detail} Last sync: ${syncUpdatedAtLabel}.`;
  }, [locale.sync.detail, syncUpdatedAtLabel]);

  useEffect(() => {
    if (!minibobTranslationsLocked) return;
    if (locale.activeLocale === locale.baseLocale) return;
    setLocalePreview(locale.baseLocale);
  }, [minibobTranslationsLocked, locale.activeLocale, locale.baseLocale, setLocalePreview]);

  useEffect(() => {
    if (!showSelector) return;
    const root = dropdownRef.current;
    if (!root || typeof window === 'undefined') return;
    const hydrate = (window as any).Dieter?.hydrateDropdownActions;
    if (typeof hydrate === 'function') {
      hydrate(root.parentElement ?? root);
    }
    root.querySelectorAll<HTMLElement>('[data-icon]').forEach((node) => {
      const name = node.getAttribute('data-icon');
      if (!name) return;
      node.innerHTML = getIcon(name);
      node.removeAttribute('data-icon');
    });
  }, [localeOptionsKey, showSelector]);

  useEffect(() => {
    if (!showSelector) return;
    const input = inputRef.current;
    if (!input) return;
    input.value = activeLocale;
    input.dispatchEvent(
      new CustomEvent('external-sync', {
        bubbles: true,
        detail: { value: activeLocale },
      }),
    );
  }, [activeLocale, showSelector]);

  useEffect(() => {
    setRefreshMessage(null);
  }, [publicId, activeLocale, locale.stale]);

  const subject = policy.profile === 'minibob' ? 'minibob' : 'account';
  const hasAccount = Boolean(accountId);
  const canEditAccountLocales = !minibobTranslationsLocked && hasAccount && policy.role !== 'viewer';

  const loadAccountLocales = useCallback(async () => {
    if (!accountId) return;
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const res = await session.apiFetch(
        `/api/accounts/${encodeURIComponent(accountId)}/locales?_t=${Date.now()}`,
        { cache: 'no-store' },
      );
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        const message =
          json?.error?.message || json?.error?.reasonKey || json?.error?.code || `Failed to load account locales (HTTP ${res.status})`;
        setSettingsError(message);
        setSettingsLoading(false);
        return;
      }

      const localesRaw: unknown[] = Array.isArray(json?.locales) ? json.locales : [];
      const additionalLocales = localesRaw
        .map((entry) => normalizeLocaleToken(entry))
        .filter((entry): entry is string => entry !== null);

      const policyRaw = json?.policy && typeof json.policy === 'object' && !Array.isArray(json.policy) ? (json.policy as any) : null;
      const nextBase = normalizeLocaleToken(policyRaw?.baseLocale) ?? locale.accountL10nPolicy.baseLocale;
      const ipEnabled = policyRaw?.ip?.enabled === true;
      const switcherEnabled = policyRaw?.switcher?.enabled !== false;
      const mappingRaw = policyRaw?.ip?.countryToLocale;
      const countryToLocale: Record<string, string> = {};
      if (mappingRaw && typeof mappingRaw === 'object' && !Array.isArray(mappingRaw)) {
        for (const [countryRaw, localeRaw] of Object.entries(mappingRaw as Record<string, unknown>)) {
          const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
          if (!/^[A-Z]{2}$/.test(country)) continue;
          const normalized = normalizeLocaleToken(localeRaw);
          if (!normalized) continue;
          countryToLocale[country] = normalized;
        }
      }

      setDraftBaseLocale(nextBase);
      setDraftAdditionalLocales(additionalLocales.filter((entry) => entry !== nextBase));
      setDraftIpEnabled(ipEnabled);
      setDraftSwitcherEnabled(switcherEnabled);
      setDraftCountryToLocale(countryToLocale);
      setSettingsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSettingsError(message);
      setSettingsLoading(false);
    }
  }, [locale.accountL10nPolicy.baseLocale, session, accountId]);

  useEffect(() => {
    if (!settingsOpen) return;
    void loadAccountLocales();
  }, [settingsOpen, loadAccountLocales]);

  const saveAccountLocales = useCallback(async () => {
    if (!accountId) return;
    setSettingsLoading(true);
    setSettingsError(null);

    const nextBase = normalizeLocaleToken(draftBaseLocale) ?? locale.accountL10nPolicy.baseLocale;
    const enabledLocales = [nextBase, ...draftAdditionalLocales]
      .map((entry) => normalizeLocaleToken(entry))
      .filter((entry): entry is string => Boolean(entry));
    const dedupedAdditional = enabledLocales
      .filter((entry) => entry !== nextBase)
      .filter((entry, index, all) => all.indexOf(entry) === index);

    const policyPayload: AccountLocalesPayload['policy'] = {
      v: 1,
      baseLocale: nextBase,
      ip: {
        enabled: Boolean(draftIpEnabled),
        countryToLocale: draftIpEnabled
          ? buildDefaultCountryToLocale({ enabledLocales: [nextBase, ...dedupedAdditional], baseLocale: nextBase })
          : { ...draftCountryToLocale },
      },
      switcher: { enabled: Boolean(draftSwitcherEnabled) },
    };

    // Keep policy.ip.countryToLocale within the enabled locale set.
    if (policyPayload.ip.enabled) {
      const enabledSet = new Set([nextBase, ...dedupedAdditional]);
      policyPayload.ip.countryToLocale = Object.fromEntries(
        Object.entries(policyPayload.ip.countryToLocale).filter(([, locale]) => enabledSet.has(locale)),
      );
    }

    const payload: AccountLocalesPayload = {
      locales: dedupedAdditional,
      policy: policyPayload,
    };

    try {
      const res = await session.apiFetch(
        `/api/accounts/${encodeURIComponent(accountId)}/locales?subject=${encodeURIComponent(subject)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          cache: 'no-store',
        },
      );
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        const message =
          json?.error?.message || json?.error?.reasonKey || json?.error?.code || `Failed to save locales (HTTP ${res.status})`;
        setSettingsError(message);
        setSettingsLoading(false);
        return;
      }

      const reloaded = await session.reloadLocalizationSnapshot();
      if (!reloaded.ok) {
        setSettingsError(reloaded.message);
        setSettingsLoading(false);
        return;
      }

      setSettingsOpen(false);
      setSettingsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSettingsError(message);
      setSettingsLoading(false);
    }
  }, [
    draftAdditionalLocales,
    draftBaseLocale,
    draftCountryToLocale,
    draftIpEnabled,
    draftSwitcherEnabled,
    locale.accountL10nPolicy.baseLocale,
    session,
    subject,
    accountId,
  ]);

  const enabledLocaleSet = useMemo(() => {
    const base = normalizeLocaleToken(draftBaseLocale) ?? locale.accountL10nPolicy.baseLocale;
    return new Set([base, ...draftAdditionalLocales].map((entry) => normalizeLocaleToken(entry)).filter(Boolean));
  }, [draftAdditionalLocales, draftBaseLocale, locale.accountL10nPolicy.baseLocale]);

  const localeToggleEntries = useMemo(() => {
    const base = normalizeLocaleToken(draftBaseLocale) ?? locale.accountL10nPolicy.baseLocale;
    return CANONICAL_LOCALES.filter((entry) => entry.code !== base).map((entry) => {
      const code = entry.code;
      return {
        code,
        label: resolveLocaleUiLabel(code),
        enabled: enabledLocaleSet.has(code),
      };
    });
  }, [draftBaseLocale, enabledLocaleSet, locale.accountL10nPolicy.baseLocale]);

  const localeSettingsModal = showSelector ? (
    <LocaleSettingsModal
      open={settingsOpen}
      loading={settingsLoading}
      error={settingsError}
      canEdit={canEditAccountLocales}
      baseLocale={draftBaseLocale}
      onChangeBaseLocale={(nextBase) => {
        const normalizedNext = normalizeLocaleToken(nextBase) ?? nextBase;
        const prevBase = normalizeLocaleToken(draftBaseLocale) ?? locale.accountL10nPolicy.baseLocale;
        const enabled = new Set<string>([prevBase, ...draftAdditionalLocales].filter(Boolean));
        enabled.add(normalizedNext);
        enabled.delete(normalizedNext);
        setDraftBaseLocale(normalizedNext);
        setDraftAdditionalLocales(Array.from(enabled).filter((entry) => entry && entry !== normalizedNext));
      }}
      locales={localeToggleEntries}
      ipEnabled={draftIpEnabled}
      switcherEnabled={draftSwitcherEnabled}
      onToggleLocale={(code, nextEnabled) => {
        const base = normalizeLocaleToken(draftBaseLocale) ?? locale.accountL10nPolicy.baseLocale;
        if (code === base) return;
        setDraftAdditionalLocales((prev) => {
          const set = new Set(prev.map((entry) => normalizeLocaleToken(entry)).filter(Boolean) as string[]);
          if (nextEnabled) set.add(code);
          else set.delete(code);
          return Array.from(set);
        });
      }}
      onToggleIp={(next) => setDraftIpEnabled(next)}
      onToggleSwitcher={(next) => setDraftSwitcherEnabled(next)}
      onClose={() => {
        setSettingsOpen(false);
        setSettingsError(null);
      }}
      onSave={() => saveAccountLocales()}
    />
  ) : null;

  if (!hasInstance) {
    return showSelector ? <div className="label-s label-muted">No instance selected yet. Choose one from Widgets to manage localization.</div> : null;
  }

  return (
    <>
      <div className="tdmenucontent__cluster">
        <div className="tdmenucontent__cluster-body">
          {showSelector && isTranslatePanel ? (
            <div className="localization-header-status" data-tone={translationsStatus.tone}>
              <span className="localization-header-status__label">Translations</span>
              <span className="localization-header-status__dot" aria-hidden="true" />
              <span className="localization-header-status__value">{translationsStatus.label}</span>
            </div>
          ) : null}
          {showSelector ? (
            <div
              role={minibobTranslationsLocked ? 'button' : undefined}
              tabIndex={minibobTranslationsLocked ? 0 : undefined}
              aria-label={minibobTranslationsLocked ? MINIBOB_TRANSLATIONS_UPSELL_MESSAGE : undefined}
              onClick={
                minibobTranslationsLocked
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      session.requestUpsell(MINIBOB_TRANSLATIONS_UPSELL_MESSAGE);
                    }
                  : undefined
              }
              onKeyDown={
                minibobTranslationsLocked
                  ? (event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      event.stopPropagation();
                      session.requestUpsell(MINIBOB_TRANSLATIONS_UPSELL_MESSAGE);
                    }
                  : undefined
              }
            >
              <div
                key={localeOptionsKey}
                ref={dropdownRef}
                className="diet-dropdown-actions diet-popover-host localization-dropdown"
                data-size="lg"
                data-state="closed"
                data-disabled={selectionDisabled ? 'true' : 'false'}
              >
                <input
                  ref={inputRef}
                  id="locale-preview"
                  type="hidden"
                  className="diet-dropdown-actions__value-field"
                  value={activeLocale}
                  data-placeholder={localeOptions[0]?.label || `Base (${baseLocale})`}
                  onInput={(event) => setLocalePreview((event.target as HTMLInputElement).value)}
                />
                <div
                  className="diet-dropdown-header diet-dropdown-actions__control"
                  role="button"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                  aria-label="Preview locale"
                  aria-disabled={selectionDisabled ? 'true' : 'false'}
                  aria-labelledby="locale-preview-label"
                >
                  <span className="diet-dropdown-header-label label-s" id="locale-preview-label">
                    Language
                  </span>
                  <span
                    className="diet-dropdown-header-value body-s"
                    data-muted="true"
                    data-placeholder={localeOptions[0]?.label || `Base (${baseLocale})`}
                  />
                </div>
                <div
                  className="diet-popover diet-dropdown-actions__popover"
                  role="listbox"
                  aria-label="Locale"
                  data-state="closed"
                >
                  <div className="diet-popover__header">
                    <span className="diet-popover__header-label label-s">Language</span>
                  </div>
                  <div className="diet-popover__body diet-dropdown-actions__menu">
                    {localeOptions.map((option) => {
                      const selected = option.value === activeLocale;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`diet-btn-menuactions diet-dropdown-actions__menuaction${selected ? ' is-selected' : ''}`}
                          data-size="lg"
                          data-variant="neutral"
                          data-value={option.value}
                          data-label={option.label}
                          role="option"
                          aria-selected={selected ? 'true' : 'false'}
                          data-selected={selected ? 'true' : undefined}
                        >
                          <span className="diet-btn-menuactions__label body-s">{option.label}</span>
                          <span className="diet-btn-menuactions__icon" aria-hidden="true">
                            <span
                              className="diet-dropdown-actions__check diet-btn-ic"
                              data-size="xs"
                              data-variant="neutral"
                              aria-hidden="true"
                            >
                              <span className="diet-btn-ic__icon" data-icon="checkmark" />
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {canEditAccountLocales ? (
                <div className="localization-settings-actions">
                  <button
                    className="diet-btn-txt"
                    data-size="md"
                    data-variant="neutral"
                    type="button"
                    disabled={locale.loading || settingsLoading}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSettingsOpen(true);
                    }}
                  >
                    <span className="diet-btn-txt__label">Language settings</span>
                  </button>
                </div>
              ) : null}
              {accountError ? <div className="settings-panel__error">{accountError}</div> : null}
              {syncDetailMessage ? (
                <div className={isSyncFailed ? 'settings-panel__error' : 'settings-panel__note'}>{syncDetailMessage}</div>
              ) : null}
              {showEmptyState ? (
                <div className="settings-panel__note">
                  No generated translations yet for configured locales. Save the base locale to generate locale overlays.
                  <button
                    className="diet-btn-txt"
                    data-size="md"
                    data-variant="primary"
                    type="button"
                    disabled={!canPublish || isPublishing || locale.loading || isSyncBusy}
                    onClick={async () => {
                      setRefreshMessage(null);
                      if (isDirty) {
                        await save();
                        return;
                      }
                      const result = await refreshLocaleTranslations();
                      if (!result.ok) return;
                      setRefreshMessage(
                        result.queued > 0
                          ? `Queued ${result.queued} translation job${result.queued === 1 ? '' : 's'}.`
                          : null,
                      );
                    }}
                  >
                    <span className="diet-btn-txt__label">
                      {isSyncQueued
                        ? 'Queuing...'
                        : isSyncTranslating
                          ? 'Translating...'
                          : isDirty
                            ? 'Save to generate translations'
                            : 'Generate translations'}
                    </span>
                  </button>
                </div>
              ) : null}
              {activeLocaleMissingOverlay ? (
                <div className="settings-panel__warning">
                  No generated translation for {activeLocale} yet. Preview is currently showing base content.
                </div>
              ) : null}
            </div>
          ) : null}

          {showFooter ? (
            <>
              {isLocaleMode ? (
                <>
                  <div className="settings-panel__actions">
                    <button
                      className="diet-btn-txt"
                      data-size="lg"
                      data-variant="primary"
                      type="button"
                      disabled={locale.loading || (!locale.dirty && !locale.stale)}
                      onClick={() => saveLocaleOverrides()}
                    >
                      <span className="diet-btn-txt__label">Save overrides</span>
                    </button>
                    <button
                      className="diet-btn-txt"
                      data-size="lg"
                      data-variant="neutral"
                      type="button"
                      disabled={locale.userOps.length === 0 || locale.loading}
                      onClick={() => revertLocaleOverrides()}
                    >
                      <span className="diet-btn-txt__label">Revert to auto-translate</span>
                    </button>
                  </div>
                  {isStale ? (
                    <div className="settings-panel__warning">
                      {isDirty
                        ? `Base content changed. ${activeLocale} is showing the previous translation. Click "Save" to refresh translations.`
                        : `Base content changed. ${activeLocale} is showing the previous translation.`}
                      {!isDirty ? (
                        <div className="settings-panel__fullwidth">
                          <button
                            className="diet-btn-txt"
                            data-size="md"
                            data-variant="primary"
                            type="button"
                            disabled={locale.loading || isPublishing || isSyncBusy}
                            onClick={async () => {
                              setRefreshMessage(null);
                              const result = await refreshLocaleTranslations();
                              if (!result.ok) return;
                              setRefreshMessage(
                                result.queued > 0
                                  ? `Queued ${result.queued} translation job${result.queued === 1 ? '' : 's'}.`
                                  : null,
                              );
                            }}
                          >
                            <span className="diet-btn-txt__label">
                              {isSyncQueued
                                ? 'Queuing...'
                                : isSyncTranslating
                                  ? 'Translating...'
                                  : locale.loading
                                    ? 'Refreshing...'
                                    : 'Refresh translations'}
                            </span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
              {refreshMessage ? <div className="settings-panel__success">{refreshMessage}</div> : null}
              {isLocaleMode && hasManualOverrides ? (
                <div className="settings-panel__success">
                  Manual edits saved for {activeLocale}. Auto-translation won&apos;t replace those fields. Click &quot;Revert
                  to auto-translate&quot; to remove overrides.
                </div>
              ) : null}
              {minibobTranslationsLocked ? (
                <div
                  className="settings-panel__note settings-panel__note--upsell"
                  onClick={() => session.requestUpsell(MINIBOB_TRANSLATIONS_UPSELL_MESSAGE)}
                >
                  <div className="label-s">{MINIBOB_TRANSLATIONS_UPSELL_MESSAGE}</div>
                  <div className="settings-panel__fullwidth">
                    <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button">
                      <span className="diet-btn-txt__label">Create free account</span>
                    </button>
                  </div>
                </div>
              ) : null}
              {locale.error ? <div className="settings-panel__error">{locale.error}</div> : null}
              {translateNote ? <div className="settings-panel__note">{translateNote}</div> : null}
            </>
          ) : null}
        </div>
      </div>
      {localeSettingsModal}
    </>
  );
}

type LocaleSettingsModalProps = {
  open: boolean;
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  baseLocale: string;
  locales: Array<{ code: string; label: string; enabled: boolean }>;
  ipEnabled: boolean;
  switcherEnabled: boolean;
  onChangeBaseLocale: (next: string) => void;
  onToggleLocale: (code: string, enabled: boolean) => void;
  onToggleIp: (enabled: boolean) => void;
  onToggleSwitcher: (enabled: boolean) => void;
  onClose: () => void;
  onSave: () => void;
};

function LocaleSettingsModal({
  open,
  loading,
  error,
  canEdit,
  baseLocale,
  locales,
  ipEnabled,
  switcherEnabled,
  onChangeBaseLocale,
  onToggleLocale,
  onToggleIp,
  onToggleSwitcher,
  onClose,
  onSave,
}: LocaleSettingsModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const baseLocaleNormalized = normalizeLocaleToken(baseLocale) ?? baseLocale;
  const baseLocaleLabel = resolveLocaleUiLabel(baseLocaleNormalized);

  return (
    <div className="ck-localeOverlay" role="presentation" onMouseDown={onClose}>
      <div
        className="ck-localeModal"
        role="dialog"
        aria-modal="true"
        aria-label="Language settings"
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <div className="ck-localeModal__header">
          <div className="heading-3">Language settings</div>
          <div className="label-s label-muted">Choose base language, enabled languages, and how locale is picked on the web.</div>
        </div>

        <div className="ck-localeModal__body">
          <div className="ck-localeModal__section">
            <div className="label-s">Base language</div>
            <div className="diet-textfield" data-size="md">
              <label className="diet-textfield__control">
                <span className="diet-textfield__display-label label-s">Base</span>
                <select
                  className="diet-textfield__field body-s ck-localeSelect"
                  value={baseLocaleNormalized}
                  onChange={(event) => onChangeBaseLocale(event.target.value)}
                  disabled={!canEdit || loading}
                  aria-label="Base language"
                >
                  {CANONICAL_LOCALES.map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {resolveLocaleUiLabel(entry.code)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="settings-panel__note">Current base: {baseLocaleLabel}</div>
          </div>

          <div className="ck-localeModal__section">
            <div className="label-s">Enabled languages</div>
            <div className="ck-localeModal__locales">
              {locales.map((entry) => {
                const id = `ck-locale-enable-${entry.code}`;
                return (
                  <div key={entry.code} className="diet-toggle diet-toggle--block ck-localeModal__toggle" data-size="md">
                    <span className="diet-toggle__label label-s" id={`${id}-label`}>
                      {entry.label}
                    </span>
                    <input
                      id={id}
                      className="diet-toggle__input sr-only"
                      type="checkbox"
                      role="switch"
                      aria-labelledby={`${id}-label`}
                      checked={entry.enabled}
                      disabled={!canEdit || loading}
                      onChange={(event) => onToggleLocale(entry.code, event.target.checked)}
                    />
                    <label className="diet-toggle__switch" htmlFor={id} aria-hidden="true">
                      <span className="diet-toggle__knob" />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ck-localeModal__section">
            <div className="label-s">Locale picking</div>
            <div className="diet-toggle diet-toggle--block" data-size="md">
              <span className="diet-toggle__label label-s" id="ck-locale-ip-label">
                Auto-detect by visitor IP
              </span>
              <input
                id="ck-locale-ip"
                className="diet-toggle__input sr-only"
                type="checkbox"
                role="switch"
                aria-labelledby="ck-locale-ip-label"
                checked={ipEnabled}
                disabled={!canEdit || loading}
                onChange={(event) => onToggleIp(event.target.checked)}
              />
              <label className="diet-toggle__switch" htmlFor="ck-locale-ip" aria-hidden="true">
                <span className="diet-toggle__knob" />
              </label>
            </div>

            <div className="diet-toggle diet-toggle--block" data-size="md">
              <span className="diet-toggle__label label-s" id="ck-locale-switcher-label">
                Show language switcher in widget
              </span>
              <input
                id="ck-locale-switcher"
                className="diet-toggle__input sr-only"
                type="checkbox"
                role="switch"
                aria-labelledby="ck-locale-switcher-label"
                checked={switcherEnabled}
                disabled={!canEdit || loading}
                onChange={(event) => onToggleSwitcher(event.target.checked)}
              />
              <label className="diet-toggle__switch" htmlFor="ck-locale-switcher" aria-hidden="true">
                <span className="diet-toggle__knob" />
              </label>
            </div>
          </div>

          {error ? <div className="settings-panel__error">{error}</div> : null}
        </div>

        <div className="ck-localeModal__actions">
          <button
            className="diet-btn-txt"
            data-size="lg"
            data-variant="primary"
            type="button"
            disabled={!canEdit || loading}
            onClick={onSave}
          >
            <span className="diet-btn-txt__label">{loading ? 'Saving…' : 'Save'}</span>
          </button>
          <button
            ref={closeButtonRef}
            className="diet-btn-txt"
            data-size="lg"
            data-variant="neutral"
            type="button"
            disabled={loading}
            onClick={onClose}
          >
            <span className="diet-btn-txt__label">Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
