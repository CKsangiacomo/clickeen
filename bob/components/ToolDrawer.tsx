import { useEffect, useMemo, useState } from 'react';
import type { PanelId } from '../lib/types';
import { TdMenu, type Panel } from './TdMenu';
import { TdMenuContent } from './TdMenuContent';
import { CopilotPane } from './CopilotPane';
import { getIcon } from '../lib/icons';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import type { CompiledPanel } from '../lib/types';
import { TdHeader } from '../bob_native_ui/tdheader/TdHeader';

const PANEL_ICON_META: Record<PanelId, string> = {
  content: 'square.and.pencil',
  layout: 'circle.grid.2x2',
  typography: 'character.circle',
  appearance: 'circle.dotted',
  settings: 'gearshape',
  advanced: 'slider.vertical.3',
  actions: 'bolt',
};

export function ToolDrawer() {
  const session = useWidgetSession();
  const compiledPanels = session.compiled?.panels ?? [];
  const hasWidget = Boolean(session.compiled);

  const [mode, setMode] = useState<'manual' | 'copilot'>('manual');
  const [activePanel, setActivePanel] = useState<PanelId>('content');

  const navPanels: Panel[] = useMemo(() => {
    if (!hasWidget) {
      return [];
    }

    return compiledPanels.map((panel) => ({
      id: panel.id,
      label: panel.label,
      icon: PANEL_ICON_META[panel.id] ?? 'circle.dotted',
    }));
  }, [compiledPanels, hasWidget]);

  useEffect(() => {
    if (!navPanels.length) return;
    if (!navPanels.some((panel) => panel.id === activePanel)) {
      setActivePanel(navPanels[0]?.id ?? 'content');
    }
  }, [navPanels, activePanel]);

  const currentPanel: CompiledPanel | undefined = useMemo(
    () => compiledPanels.find((panel) => panel.id === activePanel),
    [compiledPanels, activePanel]
  );

  return (
    <aside className="tooldrawer">
      {/* Segmented control in the header */}
      <TdHeader>
        <div className="diet-segmented-ictxt tdheader-mode-switch" role="radiogroup" aria-label="Assist mode" data-size="md">
          <label className="diet-segment">
            <input
              className="diet-segment__input"
              type="radio"
              name="assist-mode"
              value="manual"
              checked={mode === 'manual'}
              onChange={() => setMode('manual')}
            />
            <span className="diet-segment__surface" />
            <button
              className="diet-btn-ictxt"
              data-size="md"
              data-variant="neutral"
              tabIndex={-1}
              type="button"
              aria-pressed={mode === 'manual'}
            >
              <span
                className="diet-btn-ictxt__icon"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: getIcon('pencil') }}
              />
              <span className="diet-btn-ictxt__label">Manual</span>
            </button>
          </label>
          <label className="diet-segment">
            <input
              className="diet-segment__input"
              type="radio"
              name="assist-mode"
              value="copilot"
              checked={mode === 'copilot'}
              onChange={() => setMode('copilot')}
            />
            <span className="diet-segment__surface" />
            <button
              className="diet-btn-ictxt"
              data-size="md"
              data-variant="neutral"
              tabIndex={-1}
              type="button"
              aria-pressed={mode === 'copilot'}
            >
              <span
                className="diet-btn-ictxt__icon"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: getIcon('sparkles') }}
              />
              <span className="diet-btn-ictxt__label">Copilot</span>
            </button>
          </label>
        </div>
      </TdHeader>

      {/* Drawer body switches between Manual and Copilot */}
      <div className="tdcontent">
        {mode === 'manual' ? (
          hasWidget ? (
            <>
              <TdMenu panels={navPanels} active={activePanel} onSelect={(id) => setActivePanel(id)} />
              <TdMenuContent
                panel={currentPanel ?? null}
                instanceData={session.instanceData}
                setValue={session.setValue}
              />
            </>
          ) : (
            <div className="tdmenu-empty">Load an instance from DevStudio to begin editing.</div>
          )
        ) : (
          <div className="tooldrawer-copilot">
            <CopilotPane />
          </div>
        )}
      </div>
    </aside>
  );
}
