import { useEffect, useMemo, useState } from 'react';
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
  const sessionError = session.error;
  const workspaceId = session.meta?.workspaceId ? String(session.meta.workspaceId) : '';

  const [mode, setMode] = useState<'manual' | 'copilot'>('manual');
  const [activePanel, setActivePanel] = useState<PanelId>('content');

  // Reset active panel when widget changes
  useEffect(() => {
    if (compiled?.panels && compiled.panels.length > 0) {
      setActivePanel(compiled.panels[0].id as PanelId);
    }
  }, [compiled?.widgetname, compiled?.panels]);

  useEffect(() => {
    // Provide a stable place for Dieter upload controls (dropdown-fill/dropdown-upload) to find
    // the active workspace for asset persistence. This avoids having to thread IDs through every stencil.
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!workspaceId) {
      delete (root.dataset as any).ckWorkspaceId;
      return;
    }
    (root.dataset as any).ckWorkspaceId = workspaceId;
  }, [workspaceId]);

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
        <div className="diet-segmented diet-segmented-ictxt tdheader-mode-switch" role="radiogroup" aria-label="Assist mode" data-size="lg">
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
              data-size="lg"
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
              data-size="lg"
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
            {sessionError ? (
              <div
                role="alert"
                style={{
                  margin: 'var(--space-2)',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--control-radius-md)',
                  border: '1px solid color-mix(in oklab, var(--color-system-red, #ff3b30), transparent 55%)',
                  background: 'color-mix(in oklab, var(--color-system-red-5, #ff3b30), transparent 85%)',
                }}
              >
                <div className="label-s" style={{ color: 'var(--color-system-red, #ff3b30)' }}>
                  {sessionError.source === 'load'
                    ? 'Instance load error'
                    : sessionError.source === 'publish'
                      ? 'Publish rejected'
                      : 'Edit rejected'}
                </div>
                <pre className="caption" style={{ whiteSpace: 'pre-wrap', margin: 'var(--space-1) 0 0 0' }}>
                  {sessionError.source === 'load'
                    ? sessionError.message
                    : sessionError.source === 'publish'
                      ? [sessionError.message, ...(sessionError.paths || [])].filter(Boolean).join('\n')
                      : sessionError.errors.map((e) => `${e.path ? `${e.path}: ` : ''}${e.message}`).join('\n')}
                </pre>
              </div>
            ) : null}
            {compiled ? (
              <TdMenuContent
                panelId={activePanel}
                panelHtml={activePanelHtml ?? ''}
                widgetKey={compiled.widgetname}
                instanceData={session.instanceData}
                applyOps={session.applyOps}
                undoLastOps={session.undoLastOps}
                canUndo={session.canUndo}
                lastUpdate={session.lastUpdate}
                dieterAssets={compiled.assets.dieter}
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
