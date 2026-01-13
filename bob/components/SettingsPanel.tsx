'use client';

import { useEffect, useMemo, useState } from 'react';
import supportedLocalesRaw from '../../config/locales.json';
import { normalizeLocaleToken } from '../lib/l10n/instance';
import { useWidgetSession } from '../lib/session/useWidgetSession';

function normalizeSupportedLocales(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const locales = raw
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean);
  return Array.from(new Set(locales));
}

function isCuratedPublicId(publicId: string): boolean {
  if (/^wgt_web_/.test(publicId)) return true;
  return /^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*)$/.test(publicId);
}

function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ');
}

export function SettingsPanel() {
  const session = useWidgetSession();
  const { meta, compiled, locale, policy, setLocalePreview, saveLocaleOverrides, revertLocaleOverrides } = session;
  const publicId = meta?.publicId ? String(meta.publicId) : '';
  const workspaceId = meta?.workspaceId ? String(meta.workspaceId) : '';
  const widgetType = compiled?.widgetname ?? '';
  const curated = publicId ? isCuratedPublicId(publicId) : false;

  const [workspaceLocales, setWorkspaceLocales] = useState<string[] | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const supportedLocales = useMemo(() => normalizeSupportedLocales(supportedLocalesRaw), []);

  useEffect(() => {
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
  }, [workspaceId, curated]);

  const availableLocales = useMemo(() => {
    const baseLocale = locale.baseLocale;
    const list = curated ? supportedLocales : workspaceLocales ?? [];
    const normalized = list
      .map((value) => normalizeLocaleToken(value))
      .filter((value): value is string => Boolean(value));
    const set = new Set<string>(normalized);
    const rest = Array.from(set)
      .filter((code) => code !== baseLocale)
      .sort();
    return [baseLocale, ...rest];
  }, [curated, supportedLocales, workspaceLocales, locale.baseLocale]);

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
    availableLocales.length <= 1;

  const selectLocales = useMemo(() => {
    if (availableLocales.includes(activeLocale)) return availableLocales;
    const deduped = Array.from(new Set([activeLocale, ...availableLocales]));
    const rest = deduped.filter((code) => code !== baseLocale).sort();
    return [baseLocale, ...rest];
  }, [availableLocales, activeLocale, baseLocale]);

  const sourceLabel = (() => {
    if (!isLocaleMode) return 'Base';
    if (locale.dirty) return 'Unsaved changes';
    if (locale.stale) return 'Stale';
    if (locale.source) return titleCase(locale.source);
    return 'Auto';
  })();

  return (
    <div className="tdmenucontent">
      <div className="heading-3">Settings</div>
      {!hasInstance ? (
        <div className="label-s label-muted">Load an instance from DevStudio to manage localization.</div>
      ) : (
        <div className="tdmenucontent__fields">
          <div className="tdmenucontent__cluster">
            <div className="label-s">Localization</div>
            <label className="diet-input" data-size="lg">
              <span className="diet-input__label">Preview locale</span>
              <div className="diet-input__inner">
                <select
                  className="diet-input__field"
                  value={activeLocale}
                  onChange={(event) => setLocalePreview(event.target.value)}
                  disabled={selectionDisabled}
                >
                  {selectLocales.map((code) => (
                    <option key={code} value={code}>
                      {code === baseLocale ? `Base (${code})` : code}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <div className="label-s label-muted">
              {curated
                ? 'Curated instances preview every supported locale.'
                : l10nEnabled
                  ? 'Switch locales to review and edit translations.'
                  : 'Localization preview is available on Tier 2+.'}
            </div>
            <div className="label-s label-muted">
              {isLocaleMode ? `Editing locale: ${activeLocale}` : `Editing base (${baseLocale})`}
            </div>
            {workspaceLoading ? <div className="label-s label-muted">Loading workspace locales…</div> : null}
            {workspaceError ? <div className="settings-panel__error">{workspaceError}</div> : null}

            <div className="settings-panel__status">
              <span className="label-s">Status</span>
              <span className="label-s label-muted">{sourceLabel}</span>
            </div>

            <div className="settings-panel__actions">
              <button
                className="diet-btn-txt"
                data-size="lg"
                data-variant="primary"
                type="button"
                disabled={!isLocaleMode || locale.loading || (!locale.dirty && !locale.stale)}
                onClick={() => saveLocaleOverrides()}
              >
                <span className="diet-btn-txt__label">Save overrides</span>
              </button>
              <button
                className="diet-btn-txt"
                data-size="lg"
                data-variant="neutral"
                type="button"
                disabled={!isLocaleMode || locale.source !== 'user' || locale.loading}
                onClick={() => revertLocaleOverrides()}
              >
                <span className="diet-btn-txt__label">Revert to auto-translate</span>
              </button>
            </div>
            {isStale ? (
              <div className="settings-panel__warning">
                Base content changed since this translation was generated. Save to refresh the locale overlay.
              </div>
            ) : null}
            {locale.error ? <div className="settings-panel__error">{locale.error}</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}
