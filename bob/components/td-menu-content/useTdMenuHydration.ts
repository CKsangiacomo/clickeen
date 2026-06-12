'use client';

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { applyI18nToDom } from '../../lib/i18n/dom';
import {
  applyGroupHeaders,
  ensureMedia,
  getClusterBody,
  installClusterCollapseBehavior,
  runHydrators,
  type DieterMedia,
} from './dom';
import type { AccountAssetsClient } from '../../../dieter/components/shared/account-assets';
import { applyShowIfVisibility, buildShowIfEntries, type ShowIfEntry } from './showIf';

export function useTdMenuHydration(args: {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  panelHtml: string;
  widgetName: string | null;
  accountAssets: AccountAssetsClient;
  dieterMedia?: DieterMedia;
  instanceDataRef: MutableRefObject<Record<string, unknown>>;
  showIfEntriesRef: MutableRefObject<ShowIfEntry[]>;
  setRenderKey: Dispatch<SetStateAction<number>>;
}) {
  const {
    accountAssets,
    containerRef,
    dieterMedia,
    instanceDataRef,
    panelHtml,
    setRenderKey,
    showIfEntriesRef,
    widgetName,
  } = args;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    container.innerHTML = panelHtml || '';
    applyGroupHeaders(container);
    container.querySelectorAll<HTMLElement>('.tdmenucontent__cluster').forEach((cluster) => {
      const body = getClusterBody(cluster);
      applyGroupHeaders(body ?? cluster);
    });
    const cleanupCollapse = installClusterCollapseBehavior(container);
    showIfEntriesRef.current = buildShowIfEntries(container);
    applyShowIfVisibility(showIfEntriesRef.current, instanceDataRef.current);
    let controlsRenderedFrame: number | null = null;
    const refreshDynamicControls = () => {
      controlsRenderedFrame = null;
      showIfEntriesRef.current = buildShowIfEntries(container);
      applyShowIfVisibility(showIfEntriesRef.current, instanceDataRef.current);
      setRenderKey((current) => current + 1);
    };
    const handleControlsRendered = () => {
      if (controlsRenderedFrame != null) return;
      controlsRenderedFrame = window.requestAnimationFrame(refreshDynamicControls);
    };
    container.addEventListener('dieter-controls-rendered', handleControlsRendered);

    ensureMedia(dieterMedia)
      .then(() => {
        if (cancelled) return;
        runHydrators(container, { accountAssets });
        applyI18nToDom(container, widgetName).catch((err) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[TdMenuContent] i18n apply failed', err);
          }
        });
        showIfEntriesRef.current = buildShowIfEntries(container);
        applyShowIfVisibility(showIfEntriesRef.current, instanceDataRef.current);
        setRenderKey((current) => current + 1);
      })
      .catch(() => {
        if (cancelled) return;
        container.innerHTML = '<div class="settings-panel__error" role="alert">Builder controls failed to load.</div>';
        showIfEntriesRef.current = [];
        setRenderKey((current) => current + 1);
      });

    return () => {
      cancelled = true;
      container.removeEventListener('dieter-controls-rendered', handleControlsRendered);
      if (controlsRenderedFrame != null) {
        window.cancelAnimationFrame(controlsRenderedFrame);
      }
      cleanupCollapse();
    };
  }, [
    accountAssets,
    containerRef,
    dieterMedia,
    instanceDataRef,
    panelHtml,
    setRenderKey,
    showIfEntriesRef,
    widgetName,
  ]);
}
