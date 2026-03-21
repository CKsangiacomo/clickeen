import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { getIcon } from '../lib/icons';
import { setAt } from '../lib/utils/paths';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';

type PreviewTranslationPayload = {
  baseLocale: string;
  selectedLocale: string;
  translatedOutput: Array<{ path: string; value: string }>;
};

function normalizePreviewTranslationPayload(payload: unknown): PreviewTranslationPayload | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const baseLocale = typeof record.baseLocale === 'string' ? record.baseLocale.trim() : '';
  const selectedLocale = typeof record.selectedLocale === 'string' ? record.selectedLocale.trim() : '';
  const translatedOutput = Array.isArray(record.translatedOutput)
    ? record.translatedOutput.reduce<Array<{ path: string; value: string }>>((entries, entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entries;
        const item = entry as Record<string, unknown>;
        const path = typeof item.path === 'string' ? item.path.trim() : '';
        const value = typeof item.value === 'string' ? item.value : '';
        if (!path) return entries;
        entries.push({ path, value });
        return entries;
      }, [])
    : [];
  if (!baseLocale) return null;
  return {
    baseLocale,
    selectedLocale: selectedLocale || baseLocale,
    translatedOutput,
  };
}

function applyTranslationPreview(
  state: Record<string, unknown>,
  translatedOutput: Array<{ path: string; value: string }>,
): Record<string, unknown> {
  if (!Array.isArray(translatedOutput) || translatedOutput.length === 0) return state;
  let next =
    typeof structuredClone === 'function'
      ? structuredClone(state)
      : (JSON.parse(JSON.stringify(state)) as Record<string, unknown>);
  for (const entry of translatedOutput) {
    if (!entry?.path) continue;
    next = setAt(next, entry.path, entry.value) as Record<string, unknown>;
  }
  return next;
}

export function Workspace() {
  const session = useWidgetSession();
  const apiFetch = session.apiFetch;
  const chrome = useWidgetSessionChrome();
  const { compiled, instanceData } = session;
  const { preview, setPreview, meta } = chrome;
  const device = preview.device;
  const theme = preview.theme;
  const host = preview.host;
  const hasWidget = Boolean(compiled);
  const stageMode = String((instanceData as any)?.stage?.canvas?.mode || 'viewport');
  const stageFixedWidth = Number((instanceData as any)?.stage?.canvas?.width || 0);
  const stageFixedHeight = Number((instanceData as any)?.stage?.canvas?.height || 0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeHasState, setIframeHasState] = useState(false);
  const [iframeLoadError, setIframeLoadError] = useState<string | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [translationPreview, setTranslationPreview] = useState<PreviewTranslationPayload | null>(null);
  const resolvedPreviewLocale = normalizeLocaleToken(preview.locale) ?? '';
  const latestRef = useRef({
    compiled,
    instanceData,
    previewState: instanceData,
    locale: resolvedPreviewLocale,
    device,
    theme,
  });

  useEffect(() => {
    setPreview({ locale: '' });
  }, [meta?.publicId, setPreview]);

  useEffect(() => {
    if (!compiled || !meta?.publicId || !resolvedPreviewLocale) {
      setTranslationPreview(null);
      return;
    }
    const controller = new AbortController();
    const url = `/api/account/instances/${encodeURIComponent(meta.publicId)}/translations?locale=${encodeURIComponent(
      resolvedPreviewLocale,
    )}`;

    setTranslationPreview(null);
    apiFetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const payload = normalizePreviewTranslationPayload(await response.json());
        if (!payload) throw new Error('coreui.errors.translations.invalid');
        setTranslationPreview(payload);
      })
      .catch(() => {
        if (!controller.signal.aborted) setTranslationPreview(null);
      });

    return () => controller.abort();
  }, [apiFetch, compiled, meta?.publicId, resolvedPreviewLocale]);

  const translatedPreviewPayload =
    translationPreview &&
    translationPreview.selectedLocale !== translationPreview.baseLocale &&
    translationPreview.translatedOutput.length > 0
      ? translationPreview
      : null;

  const previewState = useMemo(() => {
    if (!translatedPreviewPayload) return instanceData;
    return applyTranslationPreview(instanceData, translatedPreviewPayload.translatedOutput);
  }, [instanceData, translatedPreviewPayload]);

  const runtimeLocale = translatedPreviewPayload?.selectedLocale || '';

  useEffect(() => {
    latestRef.current = {
      compiled,
      instanceData,
      previewState,
      locale: runtimeLocale,
      device,
      theme,
    };
  }, [compiled, instanceData, previewState, runtimeLocale, device, theme]);

  const iframeSrc = useMemo(() => {
    if (!hasWidget || !compiled) return 'about:blank';
    return compiled.assets.htmlUrl;
  }, [hasWidget, compiled]);

  const iframeBackdrop = (() => {
    const raw = (instanceData as any)?.stage?.background;
    if (typeof raw !== 'string') return undefined;
    const value = raw.trim();
    if (!value) return undefined;

    // If the background is an image fill with a fallback layer like:
    //   url("...") center / cover no-repeat, linear-gradient(<fallback>, <fallback>)
    // use the fallback for the iframe element background to avoid a grey flash before the iframe receives state.
    if (/\burl\(\s*/i.test(value)) {
      const fallbackMatch = value.match(/,\s*linear-gradient\(\s*([^,]+?)\s*,/i);
      if (fallbackMatch?.[1]) {
        const fallback = fallbackMatch[1].trim();
        return fallback === 'transparent' ? 'var(--color-system-white)' : fallback;
      }
      return 'var(--color-system-white)';
    }

    // Plain colors/gradients can be applied directly.
    if (
      /^(?:#|var\(|rgba?\(|hsla?\(|color-mix\(|-?(?:repeating-)?(?:linear|radial|conic)-gradient\()/i.test(value)
    ) {
      return value === 'transparent' ? 'var(--color-system-white)' : value;
    }

    return undefined;
  })();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const visibilityFallbackTimeout = window.setTimeout(() => setIframeHasState(true), 1500);
    let readyTimeout: number | null = null;
    const handleLoad = () => {
      setIframeLoaded(true);
      setIframeLoadError(null);
      const snapshot = latestRef.current;
      const nextCompiled = snapshot.compiled;
      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow || !nextCompiled) return;
      iframeWindow.postMessage(
        {
          type: 'ck:state-update',
          widgetname: nextCompiled.widgetname,
          state: snapshot.previewState,
          locale: snapshot.locale,
          device: snapshot.device,
          theme: snapshot.theme,
        },
        '*',
      );

      // Fail-safe: if the widget runtime doesn't emit `ck:ready`, don't stay hidden forever.
      if (readyTimeout != null) window.clearTimeout(readyTimeout);
      readyTimeout = window.setTimeout(() => setIframeHasState(true), 1000);
    };
    const handleError = () => {
      setIframeLoadError('Failed to load preview runtime');
      setIframeHasState(true);
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);
    setIframeLoaded(false);
    setIframeHasState(false);
    setIframeLoadError(null);
    iframe.src = iframeSrc;

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
      window.clearTimeout(visibilityFallbackTimeout);
      if (readyTimeout != null) window.clearTimeout(readyTimeout);
    };
  }, [iframeSrc]);

  useEffect(() => {
    if (!hasWidget || !compiled) return;
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    if (!iframeLoaded) return;

    const message = {
      type: 'ck:state-update',
      widgetname: compiled.widgetname,
      state: previewState,
      locale: runtimeLocale,
      device,
      theme,
    };

    iframeWindow.postMessage(message, '*');
  }, [hasWidget, compiled, previewState, runtimeLocale, device, theme, iframeLoaded]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) return;
      if (event.source !== iframeWindow) return;
      const data = event.data as any;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'ck:ready') {
        setIframeHasState(true);
        setIframeLoadError(null);
        return;
      }
      if (data.type !== 'ck:resize') return;
      const h = Number(data.height);
      if (!Number.isFinite(h) || h <= 0) return;
      const next = Math.min(6000, Math.max(120, Math.round(h)));
      setMeasuredHeight((prev) => {
        if (prev != null && Math.abs(prev - next) <= 1) return prev;
        return next;
      });
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    // When switching instances/devices/modes, allow the iframe to re-measure.
    setMeasuredHeight(null);
  }, [meta?.publicId, device, theme, host]);

  const isDesktopCanvas = host === 'canvas' && device === 'desktop';
  const shouldResizeCanvas = isDesktopCanvas && (stageMode === 'wrap' || stageMode === 'fixed');
  const resolvedCanvasHeight =
    isDesktopCanvas && stageMode === 'fixed' && Number.isFinite(stageFixedHeight) && stageFixedHeight > 0
      ? stageFixedHeight
      : measuredHeight;
  const canvasHeightPx = shouldResizeCanvas && resolvedCanvasHeight ? `${resolvedCanvasHeight}px` : null;
  const canvasWidthPx =
    shouldResizeCanvas && stageMode === 'fixed' && Number.isFinite(stageFixedWidth) && stageFixedWidth > 0
      ? `${stageFixedWidth}px`
      : null;
  const shouldRenderCanvasCard = Boolean(shouldResizeCanvas && (canvasHeightPx || canvasWidthPx));

  return (
    <section
      className="workspace"
      data-device={device}
      data-host={host}
      data-widget-ready={hasWidget && iframeHasState ? 'true' : undefined}
      data-canvas-resize={shouldRenderCanvasCard ? 'true' : undefined}
      style={
        shouldRenderCanvasCard
          ? ({
              ...(canvasHeightPx ? { ['--workspace-canvas-height' as any]: canvasHeightPx } : null),
              ...(canvasWidthPx ? { ['--workspace-canvas-width' as any]: canvasWidthPx } : null),
            } as any)
          : undefined
      }
    >
      <iframe
        ref={iframeRef}
        title="Widget preview"
        className="workspace-iframe"
        sandbox="allow-scripts allow-same-origin"
        style={iframeBackdrop ? ({ background: iframeBackdrop } as any) : undefined}
      />
      {hasWidget && !iframeHasState ? (
        <div className="workspace-status-overlay" role="status" aria-live="polite">
          <span className="label-s">Loading preview...</span>
        </div>
      ) : null}
      {hasWidget && iframeLoadError ? (
        <div className="workspace-status-overlay workspace-status-overlay--error" role="alert">
          <span className="label-s">{iframeLoadError}</span>
        </div>
      ) : null}

      <div className="workspace-overlay" aria-hidden={!hasWidget}>
        <div
          className="workspace-device-toggle diet-segmented diet-segmented-ic"
          role="radiogroup"
          aria-label="Device"
          data-size="lg"
        >
          <label className="diet-segment">
            <input
              className="diet-segment__input"
              type="radio"
              name="workspace-device"
              value="desktop"
              checked={device === 'desktop'}
              onChange={() => setPreview({ device: 'desktop' })}
            />
            <span className="diet-segment__surface" />
            <button
              className="diet-btn-ic"
              data-size="lg"
              data-variant="neutral"
              tabIndex={-1}
              type="button"
              aria-pressed={device === 'desktop'}
            >
              <span
                className="diet-btn-ic__icon"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: getIcon('desktopcomputer') }}
              />
            </button>
            <span className="diet-segment__sr">Desktop</span>
          </label>
          <label className="diet-segment">
            <input
              className="diet-segment__input"
              type="radio"
              name="workspace-device"
              value="mobile"
              checked={device === 'mobile'}
              onChange={() => setPreview({ device: 'mobile' })}
            />
            <span className="diet-segment__surface" />
            <button
              className="diet-btn-ic"
              data-size="lg"
              data-variant="neutral"
              tabIndex={-1}
              type="button"
              aria-pressed={device === 'mobile'}
            >
              <span
                className="diet-btn-ic__icon"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: getIcon('iphone') }}
              />
            </button>
            <span className="diet-segment__sr">Mobile</span>
          </label>
        </div>
      </div>
    </section>
  );
}
