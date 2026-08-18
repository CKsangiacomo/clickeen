'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopDrawer } from './TopDrawer';
import { ToolDrawer } from './ToolDrawer';
import { Workspace } from './Workspace';
import { WidgetSessionProvider } from '../lib/session/useWidgetSession';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import {
  resolveSavedTranslationReadState,
  useTranslationPreviewState,
} from './useTranslationPreviewState';
import { listPreviewableLocales } from '../lib/translations-preview';

function BuilderShell() {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const instanceId = chrome.meta?.instanceId ?? '';
  const baseLocale = chrome.meta?.baseLocale ?? '';
  const translationSetup = chrome.meta?.translationSetup ?? null;
  const [previewMode, setPreviewMode] = useState<'editing' | 'translations'>('editing');
  const [translationPreviewLocale, setTranslationPreviewLocale] = useState('');
  const [translationsRefreshVersion, setTranslationsRefreshVersion] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const toolsCloseButtonRef = useRef<HTMLButtonElement>(null);
  const translationsEnabled = Boolean(
    session.compiled &&
      instanceId &&
      baseLocale &&
      previewMode === 'translations',
  );
  const {
    translatedLocales,
    valuesByLocale: translationValuesByLocale,
    listState: savedTranslationListState,
    localeState: savedTranslationLocaleState,
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
    setToolsOpen(false);
  }, [instanceId]);

  useEffect(() => {
    if (!toolsOpen) return;
    toolsCloseButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setToolsOpen(false);
      toolsButtonRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toolsOpen]);

  useEffect(() => {
    const compact = window.matchMedia('(max-width: 599px), (max-height: 599px)');
    const onChange = () => {
      if (!compact.matches) setToolsOpen(false);
    };
    compact.addEventListener('change', onChange);
    return () => compact.removeEventListener('change', onChange);
  }, []);

  const closeTools = useCallback(() => {
    setToolsOpen(false);
    toolsButtonRef.current?.focus();
  }, []);

  const requestTranslationsRefresh = () => {
    setTranslationsRefreshVersion((prev) => prev + 1);
  };

  const previewableTranslationLocales = useMemo(() => {
    return listPreviewableLocales(baseLocale, translatedLocales);
  }, [baseLocale, translatedLocales]);

  useEffect(() => {
    if (previewMode !== 'translations' || !translationSetup) return;
    setTranslationPreviewLocale((current) =>
      current && previewableTranslationLocales.includes(current)
        ? current
        : translationSetup.baseLocale,
    );
  }, [previewMode, previewableTranslationLocales, translationSetup]);
  const savedTranslationReadState = resolveSavedTranslationReadState({
    list: savedTranslationListState,
    locale: savedTranslationLocaleState,
  });

  return (
    <>
      <div className="builder-app">
        <TopDrawer
          onOpenTools={() => setToolsOpen(true)}
          toolsOpen={toolsOpen}
          toolsButtonRef={toolsButtonRef}
        />

        <div className="editor-content">
          <ToolDrawer
            id="builder-tool-drawer"
            compactOpen={toolsOpen}
            closeButtonRef={toolsCloseButtonRef}
            onCompactClose={closeTools}
            translationPreviewLocale={translationPreviewLocale}
            onTranslationPreviewLocaleChange={setTranslationPreviewLocale}
            onRequestTranslationsRefresh={requestTranslationsRefresh}
            onPreviewModeChange={setPreviewMode}
            translationSetup={translationSetup}
            translatedLocales={translatedLocales}
            savedTranslationsLoading={savedTranslationReadState.loading}
            savedTranslationsError={savedTranslationReadState.error}
          />
          {toolsOpen ? (
            <button
              className="tooldrawer-scrim"
              type="button"
              aria-label="Close tools"
              onClick={closeTools}
            />
          ) : null}
          <Workspace
            baseLocale={baseLocale}
            previewMode={previewMode}
            translationPreviewLocale={translationPreviewLocale}
            onTranslationPreviewLocaleChange={setTranslationPreviewLocale}
            previewablePreviewLocales={previewableTranslationLocales}
            translationValuesByLanguage={translationValuesByLocale}
            savedTranslationsLoading={savedTranslationReadState.loading}
            savedTranslationsError={savedTranslationReadState.error}
          />
        </div>
      </div>
      <div className="builder-unsupported">
        <p className="heading-3">Rotate your device or use a larger screen</p>
      </div>
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
