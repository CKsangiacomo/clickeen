'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

export function LocalizationControls({ mode = 'translate', section = 'full' }: LocalizationControlsProps) {
  const session = useWidgetSession();
  const {
    meta,
    compiled,
    locale,
    policy,
    isDirty,
    isPublishing,
    publish,
    setLocalePreview,
    saveLocaleOverrides,
    refreshLocaleTranslations,
    revertLocaleOverrides,
  } = session;
  const publicId = meta?.publicId ? String(meta.publicId) : '';
  const widgetType = compiled?.widgetname ?? '';
  const isTranslatePanel = mode === 'translate';
  const minibobTranslationsLocked = policy.profile === 'minibob' && session.minibobPersonalizationUsed;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showSelector = section !== 'footer';
  const showFooter = section !== 'selector';
  const workspaceError = locale.workspaceLocalesInvalid;
  const instanceLocales = locale.overlayEntries;
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
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
  const overlayLocales = useMemo(() => {
    const normalized = instanceLocales
      .map((entry) => normalizeLocaleToken(entry.locale))
      .filter((value): value is string => Boolean(value));
    const set = new Set<string>(normalized);
    const rest = Array.from(set)
      .filter((code) => code !== baseLocale)
      .sort();
    return [baseLocale, ...rest];
  }, [instanceLocales, baseLocale]);
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
    !workspaceError &&
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
    !workspaceError &&
    !minibobTranslationsLocked &&
    !activeLocaleEntry;

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
    if (workspaceError || locale.error) {
      return { tone: 'unavailable', label: 'Unavailable' };
    }
    if (!hasInstance) {
      return { tone: 'unavailable', label: 'No instance' };
    }
    if (isStale) {
      return { tone: 'pending', label: 'Needs publish' };
    }
    if (availableLocales.length <= 1) {
      return { tone: 'unavailable', label: 'EN only' };
    }
    if (overlayLocales.length <= 1) {
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
    overlayLocales.length,
    workspaceError,
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

  if (!hasInstance) {
    return showSelector ? <div className="label-s label-muted">No instance selected yet. Choose one from Widgets to manage localization.</div> : null;
  }

  return (
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
            {workspaceError ? <div className="settings-panel__error">{workspaceError}</div> : null}
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
                      await publish();
                      return;
                    }
                    const result = await refreshLocaleTranslations();
                    if (!result.ok) return;
                    setRefreshMessage(
                      result.queued > 0
                        ? `Queued ${result.queued} translation job${result.queued === 1 ? '' : 's'}.`
                        : 'Translations are already up to date.',
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
                              : 'Translations are already up to date.',
                          );
                        }}
                      >
                        <span className="diet-btn-txt__label">
                          {isSyncQueued ? 'Queuing...' : isSyncTranslating ? 'Translating...' : locale.loading ? 'Refreshing...' : 'Refresh translations'}
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
                Manual edits saved for {activeLocale}. Auto-translation won&apos;t replace those fields. Click &quot;Revert to
                auto-translate&quot; to remove overrides.
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
  );
}
