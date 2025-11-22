import { useMemo, useState } from 'react';
import type { CompiledPanel, PanelId } from '../lib/types';
import { TdMenu } from './TdMenu';
import { TdMenuContent } from './TdMenuContent';
import { CopilotPane } from './CopilotPane';
import { getIcon } from '../lib/icons';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { TdHeader } from '../bob_native_ui/tdheader/TdHeader';

export function ToolDrawer() {
  const session = useWidgetSession();
  const compiled = session.compiled;
  const hasWidget = Boolean(compiled);

  const [mode, setMode] = useState<'manual' | 'copilot'>('manual');
  const [activePanel, setActivePanel] = useState<PanelId>('content');

  const panelsById = useMemo(() => {
    const map: Record<string, CompiledPanel> = {};
    if (compiled?.panels) {
      for (const panel of compiled.panels) {
        map[panel.id] = panel;
      }
    }
    return map;
  }, [compiled]);

  const activePanelHtml = activePanel ? panelsById[activePanel]?.html ?? null : null;

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
              data-size="sm"
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
              <span className="diet-btn-ictxt__label body-s">Manual</span>
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
              data-size="sm"
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
              <span className="diet-btn-ictxt__label body-s">Copilot</span>
            </button>
          </label>
        </div>
      </TdHeader>

      {/* Drawer body switches between Manual and Copilot */}
      <div className="tdcontent">
        {mode === 'manual' ? (
          <>
            <TdMenu active={activePanel} onSelect={(id) => setActivePanel(id)} />
            {hasWidget ? (
              <TdMenuContent
                panelId={activePanel}
                panelHtml={activePanelHtml ?? ''}
                instanceData={session.instanceData}
                setValue={session.setValue}
                defaults={compiled?.defaults}
                dieterAssets={compiled?.assets.dieter}
              />
            ) : (
              <div className="tdmenucontent">
                <div className="heading-3">Content</div>
                <div className="label-s label-muted">Load an instance from DevStudio to begin editing.</div>
              </div>
            )}
          </>
        ) : (
          <div className="tooldrawer-copilot">
            <CopilotPane />
          </div>
        )}
      </div>
    </aside>
  );
}
