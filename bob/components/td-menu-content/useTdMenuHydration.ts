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
  dieterAssets?: DieterAssets;
  instanceDataRef: MutableRefObject<Record<string, unknown>>;
  showIfEntriesRef: MutableRefObject<ShowIfEntry[]>;
  setRenderKey: Dispatch<SetStateAction<number>>;
}) {
  useEffect(() => {
    resetDieterAssetCaches();
  }, [args.widgetKey]);

  useEffect(() => {
    const container = args.containerRef.current;
    if (!container) return;

    container.innerHTML = args.panelHtml || '';
    autoNestShowIfDependentClusters(container);
    applyGroupHeaders(container);
    container.querySelectorAll<HTMLElement>('.tdmenucontent__cluster').forEach((cluster) => {
      const body = getClusterBody(cluster);
      applyGroupHeaders(body ?? cluster);
    });
    const cleanupCollapse = installClusterCollapseBehavior(container);
    args.showIfEntriesRef.current = buildShowIfEntries(container);
    applyShowIfVisibility(args.showIfEntriesRef.current, args.instanceDataRef.current);

    ensureAssets(args.dieterAssets)
      .then(() => {
        if (!container) return;
        runHydrators(container);
        applyI18nToDom(container, args.widgetName).catch((err) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[TdMenuContent] i18n apply failed', err);
          }
        });
        args.showIfEntriesRef.current = buildShowIfEntries(container);
        args.setRenderKey((current) => current + 1);
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('[TdMenuContent] Failed to load Dieter assets', err);
        }
      });

    return () => {
      cleanupCollapse();
    };
  }, [args.containerRef, args.dieterAssets, args.instanceDataRef, args.panelHtml, args.setRenderKey, args.showIfEntriesRef, args.widgetName]);
}
