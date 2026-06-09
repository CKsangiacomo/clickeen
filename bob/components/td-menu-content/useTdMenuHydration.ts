'use client';

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { applyI18nToDom } from '../../lib/i18n/dom';
import { getAt } from '../../lib/utils/paths';
import {
  applyGroupHeaders,
  ensureMedia,
  getClusterBody,
  installClusterCollapseBehavior,
  resetDieterMediaCaches,
  runHydrators,
  type DieterMedia,
} from './dom';
import type { AccountAssetsClient } from '../../../dieter/components/shared/account-assets';
import { applyShowIfVisibility, buildShowIfEntries, type ShowIfEntry } from './showIf';

type AccountInstanceOption = {
  instanceId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
};

export function hydrateInstancePickers(args: {
  container: HTMLElement;
  accountInstances: AccountInstanceOption[];
  currentInstanceId?: string | null;
  instanceData: Record<string, unknown>;
}) {
  const currentInstanceId = String(args.currentInstanceId || '').trim().toUpperCase();
  args.container.querySelectorAll<HTMLSelectElement>('select[data-bob-instance-picker="true"]').forEach((select) => {
    const path = select.getAttribute('data-bob-path') || '';
    const basePlaceholder = select.getAttribute('data-placeholder') || 'Select instance';
    const options = args.accountInstances.filter((instance) => instance.instanceId.toUpperCase() !== currentInstanceId);
    const placeholder = options.length ? basePlaceholder : 'No other instances';
    select.replaceChildren(new Option(placeholder, ''));
    options.forEach((instance) => {
      const label = `${instance.displayName || instance.instanceId} (${instance.widgetType})`;
      const option = new Option(label, instance.instanceId);
      option.dataset.status = instance.status;
      select.appendChild(option);
    });
    const current = path ? getAt(args.instanceData, path) : '';
    select.value = typeof current === 'string' ? current : '';
    select.disabled = options.length === 0;
  });
}

export function useTdMenuHydration(args: {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  panelHtml: string;
  widgetKey?: string;
  widgetName: string | null;
  accountAssets: AccountAssetsClient;
  accountInstances?: AccountInstanceOption[];
  currentInstanceId?: string | null;
  dieterMedia?: DieterMedia;
  instanceDataRef: MutableRefObject<Record<string, unknown>>;
  showIfEntriesRef: MutableRefObject<ShowIfEntry[]>;
  setRenderKey: Dispatch<SetStateAction<number>>;
}) {
  const {
    accountAssets,
    accountInstances = [],
    containerRef,
    currentInstanceId,
    dieterMedia,
    instanceDataRef,
    panelHtml,
    setRenderKey,
    showIfEntriesRef,
    widgetKey,
    widgetName,
  } = args;

  useEffect(() => {
    resetDieterMediaCaches();
  }, [widgetKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = panelHtml || '';
    hydrateInstancePickers({
      container,
      accountInstances,
      currentInstanceId,
      instanceData: instanceDataRef.current,
    });
    applyGroupHeaders(container);
    container.querySelectorAll<HTMLElement>('.tdmenucontent__cluster').forEach((cluster) => {
      const body = getClusterBody(cluster);
      applyGroupHeaders(body ?? cluster);
    });
    const cleanupCollapse = installClusterCollapseBehavior(container);
    showIfEntriesRef.current = buildShowIfEntries(container);
    applyShowIfVisibility(showIfEntriesRef.current, instanceDataRef.current);

    ensureMedia(dieterMedia)
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
          console.error('[TdMenuContent] Failed to load Dieter media', err);
        }
      });

    return () => {
      cleanupCollapse();
    };
  }, [
    accountAssets,
    accountInstances,
    containerRef,
    currentInstanceId,
    dieterMedia,
    instanceDataRef,
    panelHtml,
    setRenderKey,
    showIfEntriesRef,
    widgetName,
  ]);
}
