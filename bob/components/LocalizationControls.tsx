'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { isCuratedPublicId, normalizeLocaleToken } from '../lib/l10n/instance';
import { getIcon } from '../lib/icons';
import { useWidgetSession } from '../lib/session/useWidgetSession';

type LocalizationControlsProps = {
  mode?: 'translate' | 'settings';
  section?: 'full' | 'selector' | 'footer';
};

export function LocalizationControls({ mode = 'translate', section = 'full' }: LocalizationControlsProps) {
  const session = useWidgetSession();
  const { meta, compiled, locale, policy, setLocalePreview, saveLocaleOverrides, revertLocaleOverrides } = session;
  const publicId = meta?.publicId ? String(meta.publicId) : '';
  const workspaceId = meta?.workspaceId ? String(meta.workspaceId) : '';
  const widgetType = compiled?.widgetname ?? '';
  const curated = publicId ? isCuratedPublicId(publicId) : false;
  const isTranslatePanel = mode === 'translate';
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showSelector = section !== 'footer';
  const showFooter = section !== 'selector';

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
    if (!workspaceId || curated) {
      setWorkspaceLocales(null);
      setWorkspaceError(null);
      setWorkspaceLoading(false);
      return;
    }

    let cancelled = false;
    setWorkspaceLoading(true);
    fetch(`/api/paris/workspaces/${encodeURIComponent(workspaceId)}/locales`, { cache: 'no-store' })
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
  }, [workspaceId, curated, showSelector]);

  useEffect(() => {
    if (!publicId || (!showSelector && !showFooter)) {
      setInstanceLocales(null);
      setInstanceError(null);
      setInstanceLoading(false);
      return;
    }

    let cancelled = false;
    setInstanceLoading(true);
    fetch(`/api/paris/instances/${encodeURIComponent(publicId)}/locales`, { cache: 'no-store' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          const message = json?.error?.message || json?.error?.code || 'Failed to load locale overlays';
          throw new Error(message);
        }
        const locales = Array.isArray(json?.locales) ? json.locales : [];
        const normalized = locales
          .map((item: any) => ({
            locale: typeof item?.locale === 'string' ? item.locale.trim().toLowerCase() : '',
            source: typeof item?.source === 'string' ? item.source : null,
            hasUserOps: typeof item?.hasUserOps === 'boolean' ? item.hasUserOps : false,
          }))
          .filter((item: { locale: string }) => Boolean(item.locale));
        return normalized;
      })
      .then((locales) => {
        if (cancelled) return;
        setInstanceLocales(locales);
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
  }, [publicId, showSelector, showFooter]);

  const availableLocales = useMemo(() => {
    if (!showSelector) return [locale.baseLocale];
    const baseLocale = locale.baseLocale;
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
  }, [curated, instanceLocales, workspaceLocales, locale.baseLocale, showSelector]);

  const activeLocale = locale.activeLocale;
  const baseLocale = locale.baseLocale;
  const isLocaleMode = activeLocale !== baseLocale;
  const isStale = locale.stale;
  const l10nEnabled = Boolean(policy.flags?.['l10n.enabled']);
  const hasInstance = Boolean(publicId && widgetType);
  const selectionDisabled =
    !hasInstance ||
    locale.loading ||
    (curated ? false : !l10nEnabled) ||
    (curated ? instanceLoading : workspaceLoading) ||
    availableLocales.length <= 1;

  const selectLocales = useMemo(() => {
    if (!showSelector) return [baseLocale];
    if (availableLocales.includes(activeLocale)) return availableLocales;
    const deduped = Array.from(new Set([activeLocale, ...availableLocales]));
    const rest = deduped.filter((code) => code !== baseLocale).sort();
    return [baseLocale, ...rest];
  }, [availableLocales, activeLocale, baseLocale, showSelector]);

  const localeOptions = useMemo(() => {
    return selectLocales.map((code) => ({
      value: code,
      label: code === baseLocale ? `Base (${code})` : code,
    }));
  }, [selectLocales, baseLocale]);
  const localeOptionsKey = useMemo(() => localeOptions.map((option) => option.value).join('|'), [localeOptions]);

  const translateNote = (() => {
    if (!isTranslatePanel) return null;
    if (!isLocaleMode) {
      return `Translation-only mode. Choose a locale to translate. To add or remove content, switch to Edit (${baseLocale}).`;
    }
    return `Translation-only mode. To add or remove content, switch to Edit (${baseLocale}), edit, then publish to regenerate translations.`;
  })();

  const overrideLocales = useMemo(() => {
    if (!instanceLocales || instanceLocales.length === 0) return [];
    return instanceLocales
      .filter((entry) => entry.hasUserOps)
      .map((entry) => entry.locale)
      .filter(Boolean);
  }, [instanceLocales]);
  const overrideLabel = useMemo(() => {
    if (overrideLocales.length === 0) return '';
    return Array.from(new Set(overrideLocales)).sort().join(', ');
  }, [overrideLocales]);

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
      {showSelector ? (
        <>
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
            <div className="diet-popover diet-dropdown-actions__popover" role="listbox" aria-label="Locale" data-state="closed">
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
                        <span className="diet-dropdown-actions__check diet-btn-ic" data-size="xs" data-variant="neutral" aria-hidden="true">
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
        </>
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
                  Base content changed since this translation was generated. Publish the base locale to regenerate
                  auto-translations, or edit here and save overrides to keep a manual version.
                </div>
              ) : null}
            </>
          ) : null}
          {overrideLabel ? (
            <div className="settings-panel__success">
              Manual overrides detected for {overrideLabel}. Auto-translation continues for other fields, and overridden
              fields stay manual. Click "Revert to auto-translate" to remove overrides.
            </div>
          ) : null}
          {locale.error ? <div className="settings-panel__error">{locale.error}</div> : null}
          {translateNote ? <div className="settings-panel__note">{translateNote}</div> : null}
        </>
      ) : null}
    </div>
  );
}
