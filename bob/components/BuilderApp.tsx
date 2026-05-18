'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TopDrawer } from './TopDrawer';
import { ToolDrawer } from './ToolDrawer';
import { UpsellPopup } from './UpsellPopup';
import { Workspace } from './Workspace';
import { WidgetSessionProvider } from '../lib/session/useWidgetSession';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { useLocaleOverlayPreviewState } from './useLocaleOverlayPreviewState';
import { listPreviewableLocales } from '../lib/translations-preview';

const TRANSLATION_SAVE_POLL_MS = 3_000;
const TRANSLATION_SAVE_MAX_POLL_MS = 120_000;

function UpsellPopupHost() {
  const session = useWidgetSessionChrome();
  const upsell = session.upsell;
  return (
    <UpsellPopup
      open={Boolean(upsell)}
      reasonKey={upsell?.reasonKey ?? ''}
      detail={upsell?.detail}
      cta={upsell?.cta ?? 'upgrade'}
      onClose={session.dismissUpsell}
    />
  );
}

function BuilderShell() {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const instanceId = chrome.meta?.instanceId ?? '';
  const baseLocale = chrome.meta?.baseLocale ?? '';
  const translationSetup = chrome.meta?.translationSetup ?? null;
  const [previewMode, setPreviewMode] = useState<'editing' | 'translations'>('editing');
  const [overlayPreviewLocale, setOverlayPreviewLocale] = useState('');
  const [translationsRefreshVersion, setTranslationsRefreshVersion] = useState(0);
  const [translationPollingUntil, setTranslationPollingUntil] = useState<number | null>(null);
  const previousSavingRef = useRef(false);
  const translationsEnabled = Boolean(
    session.compiled &&
      instanceId &&
      baseLocale &&
      previewMode === 'translations',
  );
  const {
    inventory: localeOverlayInventory,
    valuesByLocale: localeOverlayValuesByLocale,
    loading: localeOverlayLoading,
    error: localeOverlayError,
  } = useLocaleOverlayPreviewState({
    instanceId,
    baseLocale,
    enabled: translationsEnabled,
    selectedLocale: overlayPreviewLocale,
    refreshVersion: translationsRefreshVersion,
  });

  useEffect(() => {
    setPreviewMode('editing');
    setOverlayPreviewLocale('');
    setTranslationsRefreshVersion(0);
    setTranslationPollingUntil(null);
    previousSavingRef.current = false;
  }, [instanceId]);

  useEffect(() => {
    const justFinishedSave = previousSavingRef.current && !session.isSaving;
    previousSavingRef.current = session.isSaving;
    if (!justFinishedSave) return;
    if (session.error?.source === 'save') return;
    setTranslationsRefreshVersion((prev) => prev + 1);
    if (previewMode === 'translations' && translationSetup?.activeLocales?.length) {
      setTranslationPollingUntil(Date.now() + TRANSLATION_SAVE_MAX_POLL_MS);
    }
  }, [previewMode, session.error?.source, session.isSaving, translationSetup?.activeLocales?.length]);
  const requestLocaleOverlayRefresh = () => {
    setTranslationsRefreshVersion((prev) => prev + 1);
  };

  const expectedTranslationLocales = useMemo(() => {
    return new Set((translationSetup?.activeLocales ?? []).filter((locale) => locale !== baseLocale));
  }, [baseLocale, translationSetup]);
  const readyTranslationCount = useMemo(() => {
    return (localeOverlayInventory?.overlays ?? []).filter((entry) => expectedTranslationLocales.has(entry.locale)).length;
  }, [expectedTranslationLocales, localeOverlayInventory]);
  const allTranslationsReady =
    expectedTranslationLocales.size > 0 && readyTranslationCount === expectedTranslationLocales.size;

  useEffect(() => {
    if (!translationPollingUntil) return;
    if (allTranslationsReady || Date.now() > translationPollingUntil) {
      setTranslationPollingUntil(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setTranslationsRefreshVersion((prev) => prev + 1);
    }, TRANSLATION_SAVE_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [allTranslationsReady, translationPollingUntil, translationsRefreshVersion]);

  const previewableTranslationLocales = useMemo(() => {
    return listPreviewableLocales(localeOverlayInventory).filter(
      (locale) => locale === baseLocale || expectedTranslationLocales.has(locale),
    );
  }, [baseLocale, expectedTranslationLocales, localeOverlayInventory]);

  useEffect(() => {
    if (!overlayPreviewLocale) return;
    if (previewableTranslationLocales.includes(overlayPreviewLocale)) return;
    setOverlayPreviewLocale('');
  }, [overlayPreviewLocale, previewableTranslationLocales]);

  return (
    <>
      <div className="builder-app">
        <TopDrawer />

        <div className="builder-app__content">
          <ToolDrawer
            overlayPreviewLocale={overlayPreviewLocale}
            onOverlayPreviewLocaleChange={setOverlayPreviewLocale}
            onRequestLocaleOverlayRefresh={requestLocaleOverlayRefresh}
            onPreviewModeChange={setPreviewMode}
            translationSetup={translationSetup}
            localeOverlayInventory={localeOverlayInventory}
            localeOverlayValuesByLocale={localeOverlayValuesByLocale}
            localeOverlayLoading={localeOverlayLoading}
            localeOverlayError={localeOverlayError}
          />
          <Workspace
            baseLocale={baseLocale}
            previewMode={previewMode}
            overlayPreviewLocale={overlayPreviewLocale}
            onOverlayPreviewLocaleChange={setOverlayPreviewLocale}
            previewablePreviewLocales={previewableTranslationLocales}
            overlayValuesByLanguage={localeOverlayValuesByLocale}
          />
        </div>
      </div>
      <UpsellPopupHost />
    </>
  );
}

export function BuilderApp() {
  return (
    <WidgetSessionProvider>
      <BuilderShell />
    </WidgetSessionProvider>
  );
}
