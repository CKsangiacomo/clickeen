'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TopDrawer } from './TopDrawer';
import { ToolDrawer } from './ToolDrawer';
import { UpsellPopup } from './UpsellPopup';
import { Workspace } from './Workspace';
import { WidgetSessionProvider } from '../lib/session/useWidgetSession';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { useTranslationsPreviewState } from './useTranslationsPreviewState';

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
  const publicId = chrome.meta?.publicId ?? '';
  const baseLocale = chrome.meta?.baseLocale ?? '';
  const [previewMode, setPreviewMode] = useState<'editing' | 'translations'>('editing');
  const [overlayPreviewLocale, setOverlayPreviewLocale] = useState('');
  const [translationsRefreshVersion, setTranslationsRefreshVersion] = useState(0);
  const translationRefreshAttemptsRef = useRef(0);
  const previousSavingRef = useRef(false);
  const translationsEnabled = Boolean(session.compiled && publicId && previewMode === 'translations');
  const {
    data: translationsData,
    loading: translationsLoading,
    error: translationsError,
  } = useTranslationsPreviewState({
    publicId,
    bootBaseLocale: baseLocale,
    enabled: translationsEnabled,
    refreshVersion: translationsRefreshVersion,
  });

  useEffect(() => {
    setPreviewMode('editing');
    setOverlayPreviewLocale('');
    setTranslationsRefreshVersion(0);
    translationRefreshAttemptsRef.current = 0;
    previousSavingRef.current = false;
  }, [publicId]);

  useEffect(() => {
    const justFinishedSave = previousSavingRef.current && !session.isSaving;
    previousSavingRef.current = session.isSaving;
    if (!justFinishedSave) return;
    if (session.error?.source === 'save') return;
    translationRefreshAttemptsRef.current = 0;
    setTranslationsRefreshVersion((prev) => prev + 1);
  }, [session.error?.source, session.isSaving]);

  useEffect(() => {
    if (!translationsEnabled || translationsLoading) return undefined;
    if (translationsData?.status !== 'accepted' && translationsData?.status !== 'working') {
      translationRefreshAttemptsRef.current = 0;
      return undefined;
    }
    if (translationRefreshAttemptsRef.current >= 4) return undefined;

    const timer = window.setTimeout(() => {
      translationRefreshAttemptsRef.current += 1;
      setTranslationsRefreshVersion((prev) => prev + 1);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [translationsData?.status, translationsEnabled, translationsLoading]);

  const previewableTranslationLocales = useMemo(() => {
    if (translationsData?.status !== 'ready') return [];
    return translationsData.readyLocales;
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
            readyPreviewLocales={previewableTranslationLocales}
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
