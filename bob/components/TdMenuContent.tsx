import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { type PanelId } from '../lib/types';
import type { ApplyWidgetOpsResult, WidgetOp } from '../lib/ops';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { resolvePathFromTarget } from './td-menu-content/fieldValue';
import { type ShowIfEntry } from './td-menu-content/showIf';
import { useTdMenuBindings } from './td-menu-content/useTdMenuBindings';
import { useTdMenuHydration } from './td-menu-content/useTdMenuHydration';

type TdMenuContentProps = {
  panelId: PanelId | null;
  panelLabel: string;
  panelHtml: string;
  instanceData: Record<string, unknown>;
  applyOps: (ops: WidgetOp[]) => ApplyWidgetOpsResult;
  lastUpdate?: {
    source: 'field' | 'load' | 'external' | 'ops' | 'unknown';
    path: string;
    paths: string[];
    ts: number;
  } | null;
  header?: ReactNode;
  footer?: ReactNode;
};

export function TdMenuContent({
  panelId,
  panelLabel,
  panelHtml,
  instanceData,
  applyOps,
  lastUpdate,
  header,
  footer,
}: TdMenuContentProps) {
  const session = useWidgetSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderKey, setRenderKey] = useState(0);
  const showIfEntriesRef = useRef<ShowIfEntry[]>([]);
  const instanceDataRef = useRef(instanceData);
  const activePathRef = useRef<string | null>(null);

  useLayoutEffect(() => {
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
    accountAssets: session.accountAssets,
    fontLibrary: session.fontLibrary,
    instanceDataRef,
    showIfEntriesRef,
    setRenderKey,
  });

  useTdMenuBindings({
    containerRef,
    instanceData,
    instanceDataRef,
    applyOps,
    panelHtml,
    renderKey,
    compiled: session.compiled,
    fontLibrary: session.fontLibrary,
    requestUpsell: session.requestSystemUpsell,
    lastUpdate: lastUpdate ?? null,
    activePathRef,
    showIfEntriesRef,
  });

  if (!panelId) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">No controls</div>
      </div>
    );
  }

  return (
    <div className="tdmenucontent">
      <div className="tdmenucontent__header">
        <div className="heading-3">{panelLabel}</div>
        {header}
      </div>
      <div className="tdmenucontent__fields" ref={containerRef} />
      {footer}
    </div>
  );
}
