import { useEffect, useMemo, useState } from 'react';
import type { CompiledPanel, PanelId } from '../lib/types';
import { DEFAULT_PANELS, TdMenu } from './TdMenu';
import { TdMenuContent } from './TdMenuContent';
import { AccountCopilotPane } from './CopilotPane';
import { getIcon } from '../lib/icons';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { TdHeader } from '../bob_native_ui/tdheader/TdHeader';
import { SettingsPanel } from './SettingsPanel';
import { TranslationsPanel } from './TranslationsPanel';
import type { TranslationsPreviewData } from './useTranslationsPreviewState';

const BUILDER_ERROR_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again to keep editing this widget.',
  'coreui.errors.auth.forbidden': 'You do not have permission to edit this widget.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
  'coreui.errors.db.readFailed': 'Builder could not load this widget right now. Please try again.',
  'coreui.errors.db.writeFailed': 'Saving changes failed. Please try again.',
  'coreui.errors.payload.invalid': 'Builder received an invalid response. Please try again.',
  'coreui.errors.builder.command.hostUnavailable':
    'Builder lost its connection to the workspace. Please reopen this widget.',
  'coreui.errors.builder.command.hostOnly':
    'Builder account editing must run through the workspace host. Please reopen this widget.',
  'coreui.errors.builder.command.timeout': 'Saving took too long. Please try again.',
  'coreui.errors.builder.open.invalidRequest': 'Builder received an invalid open request.',
  'coreui.errors.builder.open.failed': 'Builder could not open this widget. Please try again.',
  'coreui.errors.instance.notFound': 'This widget could not be found. It may have been deleted.',
  'coreui.errors.instance.widgetMissing': 'This widget is missing required data and cannot load right now.',
};

function resolveBuilderErrorCopy(reason: string, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = BUILDER_ERROR_COPY[normalized];
  if (mapped) return mapped;
  if (normalized.startsWith('coreui.') || normalized.startsWith('HTTP_') || normalized.startsWith('[useWidgetSession]')) {
    return fallback;
  }
  return normalized;
}

function resolveSessionErrorTitle(error: NonNullable<ReturnType<typeof useWidgetSession>['error']>): string {
  if (error.source === 'load') return 'Builder unavailable';
  if (error.source === 'save') return 'Save failed';
  return 'Edit blocked';
}

function resolveSessionErrorLines(error: NonNullable<ReturnType<typeof useWidgetSession>['error']>): string[] {
  if (error.source === 'load') {
    return [resolveBuilderErrorCopy(error.message, 'Builder could not load this widget. Please try again.')];
  }

  if (error.source === 'save') {
    return [
      resolveBuilderErrorCopy(
        error.message,
        'Saving changes failed. Please try again.',
      ),
    ];
  }

  const deduped = new Set(
    error.errors
      .map((entry) => resolveBuilderErrorCopy(entry.message, 'Some widget edits are blocked by current limits or settings.'))
      .filter(Boolean),
  );
  return deduped.size > 0 ? Array.from(deduped) : ['Some widget edits are blocked by current limits or settings.'];
}

export function ToolDrawer({
  overlayPreviewLocale,
  onOverlayPreviewLocaleChange,
  onPreviewModeChange,
  translationsData,
  translationsLoading,
  translationsError,
}: {
  overlayPreviewLocale: string;
  onOverlayPreviewLocaleChange: (locale: string) => void;
  onPreviewModeChange: (mode: 'editing' | 'translations') => void;
  translationsData: TranslationsPreviewData | null;
  translationsLoading: boolean;
  translationsError: string | null;
}) {
  const session = useWidgetSession();
  const compiled = session.compiled;
  const sessionError = session.error;

  const [mode, setMode] = useState<'manual' | 'copilot'>('manual');
  const [activePanel, setActivePanel] = useState<PanelId>('content');

  // Reset active panel when widget changes
  useEffect(() => {
    if (compiled?.panels && compiled.panels.length > 0) {
      setActivePanel(compiled.panels[0].id as PanelId);
    }
  }, [compiled?.widgetname, compiled?.panels]);

  useEffect(() => {
    onPreviewModeChange(mode === 'manual' && activePanel === 'translations' ? 'translations' : 'editing');
  }, [activePanel, mode, onPreviewModeChange]);

  const panelsById = useMemo(() => {
    const map: Record<string, CompiledPanel> = {};
    if (compiled?.panels) {
      for (const panel of compiled.panels) {
        map[panel.id] = panel;
      }
    }
    return map;
  }, [compiled]);
  const menuPanels = useMemo(() => {
    if (!compiled?.panels?.length) {
      return DEFAULT_PANELS.filter((panel) => panel.id !== 'translations');
    }
    const availableIds = new Set(compiled.panels.map((panel) => panel.id));
    return DEFAULT_PANELS.filter((panel) => {
      if (panel.id === 'translations') return true;
      return availableIds.has(panel.id);
    });
  }, [compiled?.panels]);
  const activePanelHtml = panelsById[activePanel]?.html ?? null;
  const alertBorderColor = '1px solid color-mix(in oklab, var(--color-system-red), transparent 55%)';
  const alertBackground = 'color-mix(in oklab, var(--color-system-red-5), transparent 85%)';
  const alertLabelColor = 'var(--color-system-red)';
  const sessionErrorLines = sessionError ? resolveSessionErrorLines(sessionError) : [];
  const activePanelNode = !compiled ? (
    <div className="tdmenucontent">
      <div className="heading-3">Content</div>
      <div className="label-s label-muted">No instance selected yet. Choose one from Widgets to begin editing.</div>
    </div>
  ) : activePanel === 'settings' ? (
    <SettingsPanel />
  ) : activePanel === 'translations' ? (
    <TranslationsPanel
      overlayPreviewLocale={overlayPreviewLocale}
      onOverlayPreviewLocaleChange={onOverlayPreviewLocaleChange}
      translationsData={translationsData}
      translationsLoading={translationsLoading}
      translationsError={translationsError}
    />
  ) : (
    <TdMenuContent
      panelId={activePanel}
      panelHtml={activePanelHtml ?? ''}
      widgetKey={compiled.widgetname}
      instanceData={session.instanceData}
      applyOps={session.applyOps}
      lastUpdate={session.lastUpdate}
      dieterAssets={compiled.assets.dieter}
    />
  );

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
            <TdMenu active={activePanel} panels={menuPanels} onSelect={(id) => setActivePanel(id)} />
            {sessionError ? (
              <div
                role="alert"
                style={{
                  margin: 'var(--space-2)',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--control-radius-md)',
                  border: alertBorderColor,
                  background: alertBackground,
                }}
              >
                <div className="label-s" style={{ color: alertLabelColor }}>
                  {resolveSessionErrorTitle(sessionError)}
                </div>
                <pre className="caption" style={{ whiteSpace: 'pre-wrap', margin: 'var(--space-1) 0 0 0' }}>
                  {sessionErrorLines.join('\n')}
                </pre>
              </div>
            ) : null}
            {activePanelNode}
          </>
        ) : (
          <div className="tooldrawer-copilot">
            <AccountCopilotPane />
          </div>
        )}
      </div>
    </aside>
  );
}
