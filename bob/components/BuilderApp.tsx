'use client';

import { useEffect, useState } from 'react';
import { TopDrawer } from './TopDrawer';
import { ToolDrawer } from './ToolDrawer';
import { UpsellPopup } from './UpsellPopup';
import { Workspace } from './Workspace';
import { WidgetSessionProvider } from '../lib/session/useWidgetSession';
import { useWidgetSessionChrome } from '../lib/session/useWidgetSession';

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
  const chrome = useWidgetSessionChrome();
  const publicId = chrome.meta?.publicId ?? '';
  const baseLocale = chrome.meta?.baseLocale ?? '';
  const [previewMode, setPreviewMode] = useState<'editing' | 'translations'>('editing');
  const [overlayPreviewLocale, setOverlayPreviewLocale] = useState('');

  useEffect(() => {
    setPreviewMode('editing');
    setOverlayPreviewLocale('');
  }, [publicId]);

  return (
    <>
      <div className="builder-app">
        <TopDrawer />

        <div className="builder-app__content">
          <ToolDrawer
            overlayPreviewLocale={overlayPreviewLocale}
            onOverlayPreviewLocaleChange={setOverlayPreviewLocale}
            onPreviewModeChange={setPreviewMode}
          />
          <Workspace
            baseLocale={baseLocale}
            previewMode={previewMode}
            overlayPreviewLocale={overlayPreviewLocale}
            onOverlayPreviewLocaleChange={setOverlayPreviewLocale}
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
