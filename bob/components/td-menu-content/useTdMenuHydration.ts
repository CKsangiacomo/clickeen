'use client';

import { useLayoutEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  applyClusterGroupHeaders,
  applyGroupHeaders,
  installClusterCollapseBehavior,
  runHydrators,
} from './dom';
import { serializeBobJsonFieldValue } from './fieldValue';
import { getAt } from '../../lib/utils/paths';
import type { AccountAssetsClient } from '../../../dieter/components/shared/account-assets';
import type { AccountFontLibrary } from '@clickeen/widget-foundation';
import { applyAccountFontLibraryToTypographyMenus } from './accountFonts';
import { applyShowIfVisibility, buildShowIfEntries, type ShowIfEntry } from './showIf';

export function useTdMenuHydration(args: {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  panelHtml: string;
  accountAssets: AccountAssetsClient;
  fontLibrary: AccountFontLibrary | null;
  instanceDataRef: MutableRefObject<Record<string, unknown>>;
  showIfEntriesRef: MutableRefObject<ShowIfEntry[]>;
  setRenderKey: Dispatch<SetStateAction<number>>;
}) {
  const {
    accountAssets,
    containerRef,
    fontLibrary,
    instanceDataRef,
    panelHtml,
    setRenderKey,
    showIfEntriesRef,
  } = args;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = panelHtml || '';
    applyGroupHeaders(container);
    container.querySelectorAll<HTMLElement>('.tdmenucontent__cluster').forEach((cluster) => {
      applyClusterGroupHeaders(cluster);
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

    try {
      applyAccountFontLibraryToTypographyMenus({ container, fontLibrary });
      container
        .querySelectorAll<HTMLInputElement>('input[data-bob-path][data-bob-json]')
        .forEach((field) => {
          const path = field.getAttribute('data-bob-path')!;
          field.value = serializeBobJsonFieldValue(field, getAt(instanceDataRef.current, path));
        });
      runHydrators(container, { accountAssets });
      showIfEntriesRef.current = buildShowIfEntries(container);
      applyShowIfVisibility(showIfEntriesRef.current, instanceDataRef.current);
      setRenderKey((current) => current + 1);
    } catch {
      container.innerHTML =
        '<div class="settings-panel__error" role="alert">Builder controls failed to load.</div>';
      showIfEntriesRef.current = [];
      setRenderKey((current) => current + 1);
    }

    return () => {
      container.removeEventListener('dieter-controls-rendered', handleControlsRendered);
      if (controlsRenderedFrame != null) {
        window.cancelAnimationFrame(controlsRenderedFrame);
      }
      cleanupCollapse();
    };
  }, [
    accountAssets,
    containerRef,
    fontLibrary,
    instanceDataRef,
    panelHtml,
    setRenderKey,
    showIfEntriesRef,
  ]);
}
