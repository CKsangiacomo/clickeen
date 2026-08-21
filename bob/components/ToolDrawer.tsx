import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { CompiledPanel, PanelId } from '../lib/types';
import { TdMenu, withPanelIcon } from './TdMenu';
import { TdMenuContent } from './TdMenuContent';
import { AccountCopilotPane } from './CopilotPane';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { useWidgetSessionCopilot } from '../lib/session/useWidgetSession';
import { TranslationsPanel } from './TranslationsPanel';
import type { TranslatedLocalesData, TranslationSetup } from './useTranslationPreviewState';
import { dieterIconStyle } from './dieterIcon';
import systemStatesCopy from '../l10n/system-states/en.json';
import toolDrawerCopy from '../l10n/tool-drawer/en.json';
import translationsCopy from '../l10n/translations/en.json';

function hasTransientEditorWork(): boolean {
  if (typeof document === 'undefined') return false;
  const drawer = document.querySelector('.tooldrawer');
  return Boolean(
    drawer?.querySelector(
      [
        '[data-uploading="true"]',
        'dialog[data-bulk-modal][open]',
        'dialog.diet-popup[data-objects-modal][open]',
      ].join(', '),
    ),
  );
}

export function ToolDrawer({
  id,
  compactOpen,
  closeButtonRef,
  onCompactClose,
  translationPreviewLocale,
  onTranslationPreviewLocaleChange,
  onRequestTranslationsRefresh,
  onPreviewModeChange,
  translationSetup,
  translatedLocales,
  savedTranslationsLoading,
  savedTranslationsError,
}: {
  id: string;
  compactOpen: boolean;
  closeButtonRef: RefObject<HTMLButtonElement>;
  onCompactClose: () => void;
  translationPreviewLocale: string;
  onTranslationPreviewLocaleChange: (locale: string) => void;
  onRequestTranslationsRefresh: () => void;
  onPreviewModeChange: (mode: 'editing' | 'translations') => void;
  translationSetup: TranslationSetup | null;
  translatedLocales: TranslatedLocalesData | null;
  savedTranslationsLoading: boolean;
  savedTranslationsError: boolean;
}) {
  const session = useWidgetSession();
  const copilot = useWidgetSessionCopilot();
  const compiled = session.compiled;
  const sessionError = session.error;
  const copilotTurnActive = copilot.activeTurnKey !== null;

  const [mode, setMode] = useState<'manual' | 'copilot'>('manual');
  const [activePanel, setActivePanel] = useState<PanelId>('content');
  const canSwitchDrawerContext = () => {
    return !hasTransientEditorWork();
  };

  const requestMode = (nextMode: 'manual' | 'copilot') => {
    if (nextMode === mode) return;
    if (copilotTurnActive) return;
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
    if (compiled) setActivePanel(compiled.panels[0]!.id);
  }, [compiled]);

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
    if (!compiled) return [];
    return compiled.panels.flatMap((panel) => [
      ...(panel.id === 'settings'
        ? [
            withPanelIcon({
              id: 'translations',
              label: translationsCopy.title,
            }),
          ]
        : []),
      withPanelIcon({ id: panel.id, label: panel.label }),
    ]);
  }, [compiled]);
  const activePanelNode = !compiled && !sessionError ? (
    <div
      className="tdmenucontent diet-loading-state"
      role="status"
      aria-label={systemStatesCopy.loading.accessibleLabel}
    >
      <span className="diet-spinner" data-size="medium" aria-hidden="true" />
    </div>
  ) : !compiled ? null : activePanel === 'translations' ? (
    <TranslationsPanel
      agentActivityTitle={compiled.toolDrawerLabels.components['agent-activity'].title}
      translationPreviewLocale={translationPreviewLocale}
      onTranslationPreviewLocaleChange={onTranslationPreviewLocaleChange}
      onRequestTranslationsRefresh={onRequestTranslationsRefresh}
      translationSetup={translationSetup!}
      translatedLocales={translatedLocales}
      savedTranslationsLoading={savedTranslationsLoading}
      savedTranslationsError={savedTranslationsError}
    />
  ) : (
    <TdMenuContent
      panelLabel={panelsById[activePanel]!.label}
      panelHtml={panelsById[activePanel]!.html}
      instanceData={session.instanceData}
      applyOps={session.applyOps}
      lastUpdate={session.lastUpdate}
    />
  );

  return (
    <aside
      id={id}
      className="tooldrawer"
      data-compact-open={compactOpen ? 'true' : 'false'}
      data-copilot-turn-active={copilotTurnActive ? 'true' : 'false'}
    >
      {/* Segmented control in the header */}
      <div className="tdheader">
        <div className="diet-segmented diet-segmented-ictxt tdheader-mode-switch" role="radiogroup" aria-label={toolDrawerCopy.mode.groupLabel} data-size="lg">
          <label className="diet-segment">
            <input
              className="diet-segment__input"
              type="radio"
              name="assist-mode"
              value="manual"
              checked={mode === 'manual'}
              disabled={copilotTurnActive}
              onChange={() => requestMode('manual')}
            />
            <span className="diet-segment__surface" aria-hidden="true" />
            <span className="diet-segment__content">
              <span
                className="diet-icon"
                data-icon="pencil"
                style={dieterIconStyle('pencil')}
                aria-hidden="true"
              />
              <span className="diet-segment__label">{toolDrawerCopy.mode.manual}</span>
            </span>
          </label>
          <label className="diet-segment">
            <input
              className="diet-segment__input"
              type="radio"
              name="assist-mode"
              value="copilot"
              checked={mode === 'copilot'}
              disabled={copilotTurnActive}
              onChange={() => requestMode('copilot')}
            />
            <span className="diet-segment__surface" aria-hidden="true" />
            <span className="diet-segment__content">
              <span
                className="diet-icon"
                data-icon="sparkles"
                style={dieterIconStyle('sparkles')}
                aria-hidden="true"
              />
              <span className="diet-segment__label">{toolDrawerCopy.mode.copilot}</span>
            </span>
          </label>
        </div>
        <button
          ref={closeButtonRef}
          className="tooldrawer-close diet-button"
          data-size="large"
          data-type="quaternary"
          type="button"
          aria-label={toolDrawerCopy.tools.close}
          onClick={onCompactClose}
        >
          <span
            className="diet-icon"
            data-size="20"
            data-icon="multiply"
            style={dieterIconStyle('multiply')}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Drawer body switches between Manual and Copilot */}
      <div className="tdcontent">
        {mode === 'manual' ? (
          <>
            {compiled ? (
              <TdMenu active={activePanel} panels={menuPanels} onSelect={requestPanel} />
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
