'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TopDrawer } from './TopDrawer';
import { ToolDrawer } from './ToolDrawer';
import { UpsellPopup } from './UpsellPopup';
import { Workspace } from './Workspace';
import { WidgetSessionProvider } from '../lib/session/useWidgetSession';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { useTranslationsPreviewState } from './useTranslationsPreviewState';
import { listPreviewableLanguages } from '../lib/translations-preview';

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
  const [previewMode, setPreviewMode] = useState<'editing' | 'translations'>('editing');
  const [overlayPreviewLocale, setOverlayPreviewLocale] = useState('');
  const [translationsRefreshVersion, setTranslationsRefreshVersion] = useState(0);
  const previousSavingRef = useRef(false);
  const translationsEnabled = Boolean(
    session.compiled &&
      instanceId &&
      previewMode === 'translations' &&
      !session.isDirty &&
      !session.isSaving,
  );
  const {
    data: translationsData,
    loading: translationsLoading,
    error: translationsError,
  } = useTranslationsPreviewState({
    instanceId,
    bootBaseLocale: baseLocale,
    enabled: translationsEnabled,
    refreshVersion: translationsRefreshVersion,
  });

  useEffect(() => {
    setPreviewMode('editing');
    setOverlayPreviewLocale('');
    setTranslationsRefreshVersion(0);
    previousSavingRef.current = false;
  }, [instanceId]);

  useEffect(() => {
    if (session.isDirty && overlayPreviewLocale) {
      setOverlayPreviewLocale('');
    }
  }, [overlayPreviewLocale, session.isDirty]);

  useEffect(() => {
    const justFinishedSave = previousSavingRef.current && !session.isSaving;
    previousSavingRef.current = session.isSaving;
    if (!justFinishedSave) return;
    if (session.error?.source === 'save') return;
    setTranslationsRefreshVersion((prev) => prev + 1);
  }, [session.error?.source, session.isSaving]);

  const previewableTranslationLocales = useMemo(() => {
    return listPreviewableLanguages(translationsData);
  }, [translationsData]);
  const translationOverlayValuesByLanguage = useMemo(() => {
    return translationsData?.valuesByLanguage ?? {};
  }, [translationsData]);

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
            onPreviewModeChange={setPreviewMode}
            translationsData={translationsData}
            translationsLoading={translationsLoading}
            translationsError={translationsError}
          />
          <Workspace
            baseLocale={baseLocale}
            previewMode={previewMode}
            overlayPreviewLocale={overlayPreviewLocale}
            onOverlayPreviewLocaleChange={setOverlayPreviewLocale}
            previewablePreviewLocales={previewableTranslationLocales}
            overlayValuesByLanguage={translationOverlayValuesByLanguage}
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
