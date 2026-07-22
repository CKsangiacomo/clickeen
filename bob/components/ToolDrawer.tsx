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
import type { TranslatedLocalesData, TranslationSetup } from './useTranslationPreviewState';

const BUILDER_ERROR_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again to keep editing this widget.',
  'coreui.errors.auth.forbidden': 'You do not have permission to edit this widget.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
  'coreui.errors.db.readFailed': 'Builder could not load this widget right now. Please try again.',
  'coreui.errors.db.writeFailed': 'Saving changes failed. Please try again.',
  'coreui.errors.payload.invalid': 'Builder received an invalid response. Please try again.',
  'coreui.errors.builder.command.hostUnavailable':
    'Builder lost its connection to the account host. Please reopen this widget.',
  'coreui.errors.builder.command.hostOnly':
    'Builder account editing must run through the account host. Please reopen this widget.',
  'coreui.errors.builder.command.timeout': 'Saving took too long. Please try again.',
  'coreui.errors.builder.open.invalidRequest': 'Builder received an invalid open request.',
  'coreui.errors.builder.open.failed': 'Builder could not open this widget. Please try again.',
  'coreui.errors.instance.notFound': 'This widget could not be found. It may have been deleted.',
  'coreui.errors.instance.widgetMissing': 'This widget is missing required data and cannot load right now.',
  'coreui.errors.translations.acceptanceFailed':
    'Changes were saved, but translations could not start. Try saving again.',
};

function resolveBuilderErrorCopy(reason: string, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = BUILDER_ERROR_COPY[normalized];
  if (mapped) return mapped;
  const invalidConfigPrefix = 'coreui.errors.instance.config.invalid:';
  if (normalized.startsWith(invalidConfigPrefix)) {
    const path = normalized.slice(invalidConfigPrefix.length).trim();
    return path
      ? `This widget has invalid saved data at ${path} and cannot load right now.`
      : 'This widget has invalid saved data and cannot load right now.';
  }
  if (normalized.startsWith('coreui.') || normalized.startsWith('HTTP_') || normalized.startsWith('[useWidgetSession]')) {
    return fallback;
  }
  return fallback;
}

function resolveSessionErrorTitle(error: NonNullable<ReturnType<typeof useWidgetSession>['error']>): string {
  if (error.source === 'load') return 'Builder unavailable';
  if (error.source === 'translation') return 'Translations need attention';
  if (error.source === 'save') return 'Save failed';
  return 'Edit blocked';
}

export function resolveSessionErrorLines(error: NonNullable<ReturnType<typeof useWidgetSession>['error']>): string[] {
  if (error.source === 'load') {
    return [resolveBuilderErrorCopy(error.message, 'Builder could not load this widget. Please try again.')];
  }

  if (error.source === 'save') {
    const lines = [
      resolveBuilderErrorCopy(
        error.message,
        'Saving changes failed. Please try again.',
      ),
    ];
    if (error.paths?.length) lines.push(`Paths: ${error.paths.join(', ')}`);
    return lines;
  }

  if (error.source === 'translation') {
    return [
      resolveBuilderErrorCopy(
        error.message,
        'Changes were saved, but translations could not start. Try saving again.',
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

function hasTransientEditorWork(): boolean {
  if (typeof document === 'undefined') return false;
  const drawer = document.querySelector('.tooldrawer');
  return Boolean(
    drawer?.querySelector(
      [
        '[data-uploading="true"]',
        '[data-bulk-modal]:not([hidden])',
        '.diet-object-manager__modal:not([hidden])',
      ].join(', '),
    ),
  );
}

export function ToolDrawer({
  translationPreviewLocale,
  onTranslationPreviewLocaleChange,
  onRequestTranslationsRefresh,
  onPreviewModeChange,
  translationSetup,
  translatedLocales,
  savedTranslationsLoading,
  savedTranslationsError,
}: {
  translationPreviewLocale: string;
  onTranslationPreviewLocaleChange: (locale: string) => void;
  onRequestTranslationsRefresh: () => void;
  onPreviewModeChange: (mode: 'editing' | 'translations') => void;
  translationSetup: TranslationSetup | null;
  translatedLocales: TranslatedLocalesData | null;
  savedTranslationsLoading: boolean;
  savedTranslationsError: string | null;
}) {
  const session = useWidgetSession();
  const compiled = session.compiled;
  const sessionError = session.error;

  const [mode, setMode] = useState<'manual' | 'copilot'>('manual');
  const [activePanel, setActivePanel] = useState<PanelId>('content');
  const [switchBlockMessage, setSwitchBlockMessage] = useState<string | null>(null);

  const canSwitchDrawerContext = () => {
    if (!hasTransientEditorWork()) {
      setSwitchBlockMessage(null);
      return true;
    }
    setSwitchBlockMessage('Finish the current upload or modal edit before switching panels.');
    return false;
  };

  const requestMode = (nextMode: 'manual' | 'copilot') => {
    if (nextMode === mode) return;
    if (!canSwitchDrawerContext()) return;
    setMode(nextMode);
  };

  const requestPanel = (nextPanel: PanelId) => {
    if (nextPanel === activePanel) return;
    if (!canSwitchDrawerContext()) return;
    setActivePanel(nextPanel);
  };

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
  const alertBorderColor = '1px solid color-mix(in oklab, var(--role-error), transparent 55%)';
  const alertBackground = 'color-mix(in oklab, var(--color-system-red-5), transparent 85%)';
  const alertLabelColor = 'var(--role-error)';
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
      translationPreviewLocale={translationPreviewLocale}
      onTranslationPreviewLocaleChange={onTranslationPreviewLocaleChange}
      onRequestTranslationsRefresh={onRequestTranslationsRefresh}
      translationSetup={translationSetup}
      translatedLocales={translatedLocales}
      savedTranslationsLoading={savedTranslationsLoading}
      savedTranslationsError={savedTranslationsError}
    />
  ) : (
    <TdMenuContent
      panelId={activePanel}
      panelHtml={activePanelHtml ?? ''}
      instanceData={session.instanceData}
      applyOps={session.applyOps}
      lastUpdate={session.lastUpdate}
      dieterMedia={compiled.media.dieter}
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
              onChange={() => requestMode('manual')}
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
              onChange={() => requestMode('copilot')}
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
            <TdMenu active={activePanel} panels={menuPanels} onSelect={requestPanel} />
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
            {switchBlockMessage ? (
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
                  Editor action pending
                </div>
                <pre className="caption" style={{ whiteSpace: 'pre-wrap', margin: 'var(--space-1) 0 0 0' }}>
                  {switchBlockMessage}
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
