'use client';

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { applyI18nToDom } from '../../lib/i18n/dom';
import {
  applyGroupHeaders,
  ensureAssets,
  getClusterBody,
  installClusterCollapseBehavior,
  resetDieterAssetCaches,
  runHydrators,
  type DieterAssets,
} from './dom';
import type { AccountAssetsClient } from '../../../dieter/components/shared/account-assets';
import {
  applyShowIfVisibility,
  autoNestShowIfDependentClusters,
  buildShowIfEntries,
  type ShowIfEntry,
} from './showIf';

export function useTdMenuHydration(args: {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  panelHtml: string;
  widgetKey?: string;
  widgetName: string | null;
  accountAssets: AccountAssetsClient;
  dieterAssets?: DieterAssets;
  instanceDataRef: MutableRefObject<Record<string, unknown>>;
  showIfEntriesRef: MutableRefObject<ShowIfEntry[]>;
  setRenderKey: Dispatch<SetStateAction<number>>;
}) {
  const {
    accountAssets,
    containerRef,
    dieterAssets,
    instanceDataRef,
    panelHtml,
    setRenderKey,
    showIfEntriesRef,
    widgetKey,
    widgetName,
  } = args;

  useEffect(() => {
    resetDieterAssetCaches();
  }, [widgetKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = panelHtml || '';
    autoNestShowIfDependentClusters(container);
    applyGroupHeaders(container);
    container.querySelectorAll<HTMLElement>('.tdmenucontent__cluster').forEach((cluster) => {
      const body = getClusterBody(cluster);
      applyGroupHeaders(body ?? cluster);
    });
    const cleanupCollapse = installClusterCollapseBehavior(container);
    showIfEntriesRef.current = buildShowIfEntries(container);
    applyShowIfVisibility(showIfEntriesRef.current, instanceDataRef.current);

    ensureAssets(dieterAssets)
      .then(() => {
        if (!container) return;
        runHydrators(container, { accountAssets });
        applyI18nToDom(container, widgetName).catch((err) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[TdMenuContent] i18n apply failed', err);
          }
        });
        showIfEntriesRef.current = buildShowIfEntries(container);
        setRenderKey((current) => current + 1);
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('[TdMenuContent] Failed to load Dieter assets', err);
        }
      });

    return () => {
      cleanupCollapse();
    };
  }, [accountAssets, containerRef, dieterAssets, instanceDataRef, panelHtml, setRenderKey, showIfEntriesRef, widgetName]);
}
