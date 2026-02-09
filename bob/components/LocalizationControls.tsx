'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { isCuratedPublicId, normalizeLocaleToken } from '../lib/l10n/instance';
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
  const { meta, compiled, locale, policy, isPublishing, publish, setLocalePreview, saveLocaleOverrides, revertLocaleOverrides } = session;
  const publicId = meta?.publicId ? String(meta.publicId) : '';
  const workspaceId = meta?.workspaceId ? String(meta.workspaceId) : '';
  const widgetType = compiled?.widgetname ?? '';
  const curated = publicId ? isCuratedPublicId(publicId) : false;
  const isTranslatePanel = mode === 'translate';
  const minibobTranslationsLocked = policy.profile === 'minibob' && session.minibobPersonalizationUsed;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showSelector = section !== 'footer';
  const showFooter = section !== 'selector';
  const subject = useMemo(() => {
    if (policy.profile === 'devstudio') return 'devstudio';
    if (policy.profile === 'minibob') return 'minibob';
    return 'workspace';
  }, [policy.profile]);

  const [workspaceLocales, setWorkspaceLocales] = useState<string[] | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const [instanceLocales, setInstanceLocales] = useState<
    Array<{ locale: string; source?: string | null; hasUserOps?: boolean }> | null
  >(null);
  const [instanceError, setInstanceError] = useState<string | null>(null);
  const [instanceLoading, setInstanceLoading] = useState(false);

  useEffect(() => {
    if (!showSelector) return;
    if (minibobTranslationsLocked) {
      setWorkspaceLocales(null);
      setWorkspaceError(null);
      setWorkspaceLoading(false);
      return;
    }
    if (!workspaceId || curated) {
      setWorkspaceLocales(null);
      setWorkspaceError(null);
      setWorkspaceLoading(false);
      return;
    }

    let cancelled = false;
    setWorkspaceLoading(true);
    fetch(`/api/paris/workspaces/${encodeURIComponent(workspaceId)}/locales?subject=${encodeURIComponent(subject)}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          const message = json?.error?.reasonKey || json?.error?.message || 'Failed to load workspace locales';
          throw new Error(message);
        }
        const locales = Array.isArray(json?.locales) ? json.locales : [];
        return locales.filter((l: unknown) => typeof l === 'string').map((l: string) => l.trim().toLowerCase());
      })
      .then((locales) => {
        if (cancelled) return;
        setWorkspaceLocales(Array.from(new Set(locales)));
        setWorkspaceError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setWorkspaceLocales([]);
        setWorkspaceError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setWorkspaceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, curated, showSelector, subject, minibobTranslationsLocked]);

  useEffect(() => {
    if (!publicId || !workspaceId || (!showSelector && !showFooter)) {
      setInstanceLocales(null);
      setInstanceError(null);
      setInstanceLoading(false);
      return;
    }

    if (minibobTranslationsLocked) {
      setInstanceLocales(null);
      setInstanceError(null);
      setInstanceLoading(false);
      return;
    }

    let cancelled = false;
    setInstanceLoading(true);
    fetch(
      `/api/paris/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
        publicId
      )}/layers?subject=${encodeURIComponent(subject)}`,
      { cache: 'no-store' }
    )
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          const message = json?.error?.message || json?.error?.code || 'Failed to load locale overlays';
          throw new Error(message);
        }
        const layers = Array.isArray(json?.layers) ? json.layers : [];
        const localeLayers = layers
          .filter((item: any) => item?.layer === 'locale')
          .map((item: any) => ({
            locale: typeof item?.layerKey === 'string' ? item.layerKey.trim().toLowerCase() : '',
            source: typeof item?.source === 'string' ? item.source : null,
            hasUserOps: typeof item?.hasUserOps === 'boolean' ? item.hasUserOps : false,
          }))
          .filter((item: { locale: string }) => Boolean(item.locale));
        return { localeLayers };
      })
      .then(({ localeLayers }) => {
        if (cancelled) return;
        setInstanceLocales(localeLayers);
        setInstanceError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setInstanceLocales([]);
        setInstanceError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setInstanceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publicId, workspaceId, showSelector, showFooter, subject, minibobTranslationsLocked]);

  const availableLocales = useMemo(() => {
    if (!showSelector) return [locale.baseLocale];
    const baseLocale = locale.baseLocale;
    if (minibobTranslationsLocked) return [baseLocale];
    const list = curated ? instanceLocales ?? [] : workspaceLocales ?? [];
    const normalized = Array.isArray(list)
      ? list
          .map((value: any) => {
            const raw = typeof value === 'string' ? value : value?.locale;
            return normalizeLocaleToken(raw);
          })
          .filter((value: unknown): value is string => Boolean(value))
      : [];
    const set = new Set<string>(normalized);
    const rest = Array.from(set)
      .filter((code) => code !== baseLocale)
      .sort();
    return [baseLocale, ...rest];
  }, [curated, instanceLocales, workspaceLocales, locale.baseLocale, showSelector, minibobTranslationsLocked]);

  const activeLocale = locale.activeLocale;
  const baseLocale = locale.baseLocale;
  const isLocaleMode = activeLocale !== baseLocale;
  const isStale = locale.stale;
  const activeLocaleToken = normalizeLocaleToken(activeLocale);
  const hasInstance = Boolean(publicId && widgetType);
  const selectionDisabled =
    minibobTranslationsLocked ||
    !hasInstance ||
    locale.loading ||
    (curated ? instanceLoading : workspaceLoading) ||
    availableLocales.length <= 1;
  const publishGate = can(policy, 'instance.publish');
  const canPublish = publishGate.allow;
  const showEmptyState =
    showSelector &&
    hasInstance &&
    !instanceLoading &&
    !workspaceLoading &&
    availableLocales.length <= 1 &&
    !instanceError &&
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
      const label = normalized === baseLocale ? `Base — ${languageLabel} (${normalized})` : `${languageLabel} (${normalized})`;
      return { value: normalized, label };
    });
  }, [selectLocales, baseLocale]);
  const localeOptionsKey = useMemo(() => localeOptions.map((option) => option.value).join('|'), [localeOptions]);

  const translateNote = (() => {
    if (policy.profile === 'minibob') return null;
    if (!isTranslatePanel) return null;
    if (!isLocaleMode) {
      return 'Base content is only editable in Content panel.';
    }
    return `Translation-only mode. To add or remove content, switch to Content (${baseLocale}), edit, then publish to regenerate translations.`;
  })();

  const activeLocaleEntry = useMemo(() => {
    if (!instanceLocales) return null;
    return instanceLocales.find((entry) => normalizeLocaleToken(entry.locale) === activeLocaleToken) ?? null;
  }, [instanceLocales, activeLocaleToken]);
  const hasManualOverrides = Boolean(activeLocaleEntry?.hasUserOps);

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

  if (!hasInstance) {
    return showSelector ? <div className="label-s label-muted">Load an instance from DevStudio to manage localization.</div> : null;
  }

  return (
    <div className="tdmenucontent__cluster">
      <div className="tdmenucontent__cluster-body">
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
            {workspaceLoading ? <div className="label-s label-muted">Loading workspace locales…</div> : null}
            {curated && instanceLoading ? <div className="label-s label-muted">Loading locale overlays…</div> : null}
            {workspaceError ? <div className="settings-panel__error">{workspaceError}</div> : null}
            {curated && instanceError ? <div className="settings-panel__error">{instanceError}</div> : null}
            {showEmptyState ? (
              <div className="settings-panel__note">
                No translations found yet. Publish the base locale to generate locale overlays.
                <button
                  className="diet-btn-txt"
                  data-size="md"
                  data-variant="primary"
                  type="button"
                  disabled={!canPublish || isPublishing}
                  onClick={() => publish()}
                >
                  <span className="diet-btn-txt__label">Generate translations</span>
                </button>
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
                  Base content changed. {activeLocale} is showing the previous translation. Click &quot;Publish&quot; to update
                  translations.
                </div>
              ) : null}
              </>
            ) : null}
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
