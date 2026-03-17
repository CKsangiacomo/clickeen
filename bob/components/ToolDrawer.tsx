import { useEffect, useMemo, useState } from 'react';
import type { CompiledPanel, PanelId } from '../lib/types';
import { TdMenu } from './TdMenu';
import { TdMenuContent } from './TdMenuContent';
import { CopilotPane } from './CopilotPane';
import { getIcon } from '../lib/icons';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { TdHeader } from '../bob_native_ui/tdheader/TdHeader';
import { SettingsPanel } from './SettingsPanel';
import { LocalizationControls } from './LocalizationControls';

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
  'coreui.errors.builder.open.sessionMismatch': 'Builder session expired. Please reopen this widget.',
  'coreui.errors.builder.open.failed': 'Builder could not open this widget. Please try again.',
  'coreui.errors.instance.notFound': 'This widget could not be found. It may have been deleted.',
  'coreui.errors.instance.widgetMissing': 'This widget is missing required data and cannot load right now.',
  'coreui.errors.instance.config.invalid': 'This widget has invalid saved data and cannot load right now.',
  'coreui.errors.accountId.invalid': 'This workspace context is invalid. Please reopen the widget.',
  'coreui.errors.widgetType.invalid': 'This widget type is invalid and cannot be saved right now.',
  'coreui.errors.config.invalid': 'Some widget settings are invalid. Review your changes and try again.',
  'coreui.errors.publish.nonPersistableUrl':
    'This widget contains content that cannot be saved yet. Remove the blocked URL and try again.',
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
  if (error.source === 'save') return error.committed ? 'Saved with warning' : 'Save failed';
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
        error.committed
          ? 'Saved, but some follow-up updates need attention.'
          : 'Saving changes failed. Please try again.',
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

export function ToolDrawer() {
  const session = useWidgetSession();
  const compiled = session.compiled;
  const sessionError = session.error;
  const accountId = session.meta?.accountId ? String(session.meta.accountId) : '';
  const ownerAccountId = session.meta?.ownerAccountId ? String(session.meta.ownerAccountId) : '';
  const publicId = session.meta?.publicId ? String(session.meta.publicId) : '';
  const widgetType = session.meta?.widgetname ? String(session.meta.widgetname) : '';

  const [mode, setMode] = useState<'manual' | 'copilot'>('manual');
  const [activePanel, setActivePanel] = useState<PanelId>('content');

  function readQueryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    try {
      const value = new URL(window.location.href).searchParams.get(name);
      return typeof value === 'string' ? value.trim() : '';
    } catch {
      return '';
    }
  }

  // Reset active panel when widget changes
  useEffect(() => {
    if (compiled?.panels && compiled.panels.length > 0) {
      setActivePanel(compiled.panels[0].id as PanelId);
    }
  }, [compiled?.widgetname, compiled?.panels]);

  useEffect(() => {
    if (activePanel === 'localization') return;
    if (session.locale.activeLocale === session.locale.baseLocale) return;
    session.setLocalePreview(session.locale.baseLocale);
  }, [activePanel, session, session.locale.activeLocale, session.locale.baseLocale, session.setLocalePreview]);

  useEffect(() => {
    // Keep editor upload context in one place for Dieter upload controls.
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const dataset = root.dataset as any;
    const assetApiBase = readQueryParam('assetApiBase');
    const assetUploadEndpoint = readQueryParam('assetUploadEndpoint');
    if (accountId) dataset.ckAccountId = accountId;
    else delete dataset.ckAccountId;
    if (ownerAccountId) dataset.ckOwnerAccountId = ownerAccountId;
    else delete dataset.ckOwnerAccountId;
    if (publicId) dataset.ckPublicId = publicId;
    else delete dataset.ckPublicId;
    if (widgetType) dataset.ckWidgetType = widgetType;
    else delete dataset.ckWidgetType;
    if (assetApiBase) dataset.ckAssetApiBase = assetApiBase;
    else delete dataset.ckAssetApiBase;
    if (assetUploadEndpoint) dataset.ckAssetUploadEndpoint = assetUploadEndpoint;
    else delete dataset.ckAssetUploadEndpoint;
  }, [accountId, ownerAccountId, publicId, widgetType]);

  const panelsById = useMemo(() => {
    const map: Record<string, CompiledPanel> = {};
    if (compiled?.panels) {
      for (const panel of compiled.panels) {
        map[panel.id] = panel;
      }
    }
    return map;
  }, [compiled]);

  const isLocalizationPanel = activePanel === 'localization';
  const isLocalizationReadOnly = isLocalizationPanel && session.locale.activeLocale === session.locale.baseLocale;
  const activePanelHtml =
    activePanel === 'localization' ? panelsById['content']?.html ?? null : panelsById[activePanel]?.html ?? null;
  const contentHeader = isLocalizationPanel ? (
    <div className="tdmenucontent__translate tdmenucontent__translate-top">
      <LocalizationControls mode="translate" section="selector" />
    </div>
  ) : null;
  const contentFooter = isLocalizationPanel ? (
    <div className="tdmenucontent__footer tdmenucontent__translate">
      <LocalizationControls mode="translate" section="footer" />
    </div>
  ) : null;
  const isCommittedSaveWarning = sessionError?.source === 'save' && Boolean(sessionError.committed);
  const alertBorderColor = isCommittedSaveWarning
    ? '1px solid color-mix(in oklab, var(--color-system-yellow), transparent 55%)'
    : '1px solid color-mix(in oklab, var(--color-system-red), transparent 55%)';
  const alertBackground = isCommittedSaveWarning
    ? 'color-mix(in oklab, var(--color-system-yellow-5), transparent 82%)'
    : 'color-mix(in oklab, var(--color-system-red-5), transparent 85%)';
  const alertLabelColor = isCommittedSaveWarning ? 'var(--color-system-yellow)' : 'var(--color-system-red)';
  const sessionErrorLines = sessionError ? resolveSessionErrorLines(sessionError) : [];

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
            {compiled ? (
              activePanel === 'settings' ? (
                <SettingsPanel />
              ) : (
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
                  header={contentHeader}
                  footer={contentFooter}
                  translateMode={isLocalizationPanel}
                  readOnly={isLocalizationReadOnly}
                  translateAllowlist={session.locale.allowlist}
                />
              )
            ) : (
              <div className="tdmenucontent">
                <div className="heading-3">Content</div>
                <div className="label-s label-muted">No instance selected yet. Choose one from Widgets to begin editing.</div>
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
