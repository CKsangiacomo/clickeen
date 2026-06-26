'use client';

import { useEffect, useMemo, useState } from 'react';
import { TopDrawer } from './TopDrawer';
import { ToolDrawer } from './ToolDrawer';
import { UpsellPopup } from './UpsellPopup';
import { Workspace } from './Workspace';
import { WidgetSessionProvider } from '../lib/session/useWidgetSession';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { useTranslationPreviewState } from './useTranslationPreviewState';
import { listPreviewableLocales } from '../lib/translations-preview';

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
  const translationsEnabled = Boolean(
    session.compiled &&
      instanceId &&
      baseLocale &&
      previewMode === 'translations',
  );
  const {
    translatedLocales,
    valuesByLocale: translationValuesByLocale,
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
  }, [instanceId]);

  const requestTranslationsRefresh = () => {
    setTranslationsRefreshVersion((prev) => prev + 1);
  };

  const previewableTranslationLocales = useMemo(() => {
    return listPreviewableLocales(translatedLocales);
  }, [translatedLocales]);

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
