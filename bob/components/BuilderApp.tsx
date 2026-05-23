'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TopDrawer } from './TopDrawer';
import { ToolDrawer } from './ToolDrawer';
import { UpsellPopup } from './UpsellPopup';
import { Workspace } from './Workspace';
import { WidgetSessionProvider } from '../lib/session/useWidgetSession';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { useTranslationPreviewState } from './useTranslationPreviewState';
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
  const [translationPreviewLocale, setTranslationPreviewLocale] = useState('');
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
    translatedLocales,
    valuesByLocale: translationValuesByLocale,
    loading: translationsLoading,
    error: translationsError,
  } = useTranslationPreviewState({
    instanceId,
    baseLocale,
    enabled: translationsEnabled,
    selectedLocale: translationPreviewLocale,
    refreshVersion: translationsRefreshVersion,
  });

  useEffect(() => {
    setPreviewMode('editing');
    setTranslationPreviewLocale('');
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
    if (previewMode === 'translations' && translationSetup?.selectedTargetLocales?.length) {
      setTranslationPollingUntil(Date.now() + TRANSLATION_SAVE_MAX_POLL_MS);
    }
  }, [previewMode, session.error?.source, session.isSaving, translationSetup?.selectedTargetLocales?.length]);
  const requestTranslationsRefresh = () => {
    setTranslationsRefreshVersion((prev) => prev + 1);
  };

  const expectedTranslationLocales = useMemo(() => {
    return new Set((translationSetup?.selectedTargetLocales ?? []).filter((locale) => locale !== baseLocale));
  }, [baseLocale, translationSetup]);
  const readyTranslationCount = useMemo(() => {
    return (translatedLocales?.translations ?? []).filter((entry) => expectedTranslationLocales.has(entry.locale)).length;
  }, [expectedTranslationLocales, translatedLocales]);
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
    return listPreviewableLocales(translatedLocales).filter(
      (locale) => locale === baseLocale || expectedTranslationLocales.has(locale),
    );
  }, [baseLocale, expectedTranslationLocales, translatedLocales]);

  useEffect(() => {
    if (!translationPreviewLocale) return;
    if (previewableTranslationLocales.includes(translationPreviewLocale)) return;
    setTranslationPreviewLocale('');
  }, [translationPreviewLocale, previewableTranslationLocales]);

  return (
    <>
      <div className="builder-app">
        <TopDrawer />

        <div className="builder-app__content">
          <ToolDrawer
            translationPreviewLocale={translationPreviewLocale}
            onTranslationPreviewLocaleChange={setTranslationPreviewLocale}
            onRequestTranslationsRefresh={requestTranslationsRefresh}
            onPreviewModeChange={setPreviewMode}
            translationSetup={translationSetup}
            translatedLocales={translatedLocales}
            translationValuesByLocale={translationValuesByLocale}
            translationsLoading={translationsLoading}
            translationsError={translationsError}
          />
          <Workspace
            baseLocale={baseLocale}
            previewMode={previewMode}
            translationPreviewLocale={translationPreviewLocale}
            onTranslationPreviewLocaleChange={setTranslationPreviewLocale}
            previewablePreviewLocales={previewableTranslationLocales}
            translationValuesByLanguage={translationValuesByLocale}
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
