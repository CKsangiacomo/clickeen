import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PanelId } from '../lib/types';
import type { ApplyWidgetOpsResult, WidgetOp } from '../lib/ops';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { type DieterAssets } from './td-menu-content/dom';
import { resolvePathFromTarget } from './td-menu-content/fieldValue';
import { applyShowIfVisibility, buildShowIfEntries, type ShowIfEntry } from './td-menu-content/showIf';
import { useTdMenuBindings } from './td-menu-content/useTdMenuBindings';
import { useTdMenuHydration } from './td-menu-content/useTdMenuHydration';

type TdMenuContentProps = {
  panelId: PanelId | null;
  panelHtml: string;
  widgetKey?: string;
  instanceData: Record<string, unknown>;
  applyOps: (ops: WidgetOp[]) => ApplyWidgetOpsResult;
  lastUpdate?: { source: 'field' | 'load' | 'external' | 'ops' | 'unknown'; path: string; ts: number } | null;
  dieterAssets?: DieterAssets;
  header?: ReactNode;
  footer?: ReactNode;
};

export function TdMenuContent({
  panelId,
  panelHtml,
  widgetKey,
  instanceData,
  applyOps,
  dieterAssets,
  lastUpdate,
  header,
  footer,
}: TdMenuContentProps) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderKey, setRenderKey] = useState(0);
  const showIfEntriesRef = useRef<ShowIfEntry[]>([]);
  const instanceDataRef = useRef(instanceData);
  const activePathRef = useRef<string | null>(null);
  const lastUpdateRef = useRef<NonNullable<TdMenuContentProps['lastUpdate']> | null>(null);

  useEffect(() => {
    lastUpdateRef.current = lastUpdate ?? null;
  }, [lastUpdate]);

  useEffect(() => {
    instanceDataRef.current = instanceData;
  }, [instanceData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (event: FocusEvent) => {
      const path = resolvePathFromTarget(event.target);
      activePathRef.current = path;
    };
    const handleFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as HTMLElement | null;
      if (!next || !container.contains(next)) {
        activePathRef.current = null;
      }
    };

    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);
    return () => {
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, [panelHtml]);

  useTdMenuHydration({
    containerRef,
    panelHtml,
    widgetKey,
    widgetName: session.compiled?.widgetname ?? null,
    dieterAssets,
    instanceDataRef,
    showIfEntriesRef,
    setRenderKey,
  });

  useTdMenuBindings({
    containerRef,
    instanceData,
    applyOps,
    panelHtml,
    renderKey,
    compiled: session.compiled,
    requestUpsell: chrome.requestUpsell,
    lastUpdateRef,
    activePathRef,
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    showIfEntriesRef.current = buildShowIfEntries(container);
    applyShowIfVisibility(showIfEntriesRef.current, instanceData);
  });

  if (!panelId) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">No controls</div>
      </div>
    );
  }

  const panelTitle = `${panelId.charAt(0).toUpperCase()}${panelId.slice(1)}`;

  return (
    <div className="tdmenucontent">
      <div className="tdmenucontent__header">
        <div className="heading-3">{panelTitle}</div>
        {header}
      </div>
      <div className="tdmenucontent__fields" ref={containerRef} />
      {footer}
    </div>
  );
}
