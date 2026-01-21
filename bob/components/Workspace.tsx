import { useEffect, useMemo, useRef, useState } from 'react';
import { getIcon } from '../lib/icons';
import { useWidgetSession } from '../lib/session/useWidgetSession';

export function Workspace() {
  const session = useWidgetSession();
  const { compiled, instanceData, preview, setPreview, meta } = session;
  const device = preview.device;
  const theme = preview.theme;
  const host = preview.host;
  const hasWidget = Boolean(compiled);
  const seoGeoEnabled = Boolean((instanceData as any)?.seoGeo?.enabled);
  const stageMode = String((instanceData as any)?.stage?.canvas?.mode || 'viewport');
  const stageFixedWidth = Number((instanceData as any)?.stage?.canvas?.width || 0);
  const stageFixedHeight = Number((instanceData as any)?.stage?.canvas?.height || 0);
  const publicId = meta?.publicId ? String(meta.publicId) : '';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeHasState, setIframeHasState] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const latestRef = useRef({ compiled, instanceData, device, theme });
  useEffect(() => {
    latestRef.current = { compiled, instanceData, device, theme };
  }, [compiled, instanceData, device, theme]);

  const iframeSrc = useMemo(() => {
    if (!hasWidget || !compiled) return 'about:blank';
    if (seoGeoEnabled && publicId) {
      return `/bob/preview-shadow?publicId=${encodeURIComponent(publicId)}&theme=${encodeURIComponent(
        theme,
      )}&device=${encodeURIComponent(device)}`;
    }
    return compiled.assets.htmlUrl;
  }, [hasWidget, compiled, seoGeoEnabled, publicId, theme, device]);

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

    setIframeLoaded(false);
    setIframeHasState(false);
    iframe.src = iframeSrc;
    if (iframeSrc === 'about:blank') return;

    let readyTimeout: number | null = null;
    const handleLoad = () => {
      setIframeLoaded(true);
      const snapshot = latestRef.current;
      const nextCompiled = snapshot.compiled;
      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow || !nextCompiled) return;
      iframeWindow.postMessage(
        {
          type: 'ck:state-update',
          widgetname: nextCompiled.widgetname,
          state: snapshot.instanceData,
          device: snapshot.device,
          theme: snapshot.theme,
        },
        '*',
      );

      // Fail-safe: if the widget runtime doesn't emit `ck:ready`, don't stay hidden forever.
      if (readyTimeout != null) window.clearTimeout(readyTimeout);
      readyTimeout = window.setTimeout(() => setIframeHasState(true), 1000);
    };
    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
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
      state: instanceData,
      device,
      theme,
    };

    iframeWindow.postMessage(message, '*');
  }, [hasWidget, compiled, instanceData, device, theme, iframeLoaded]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) return;
      if (event.source !== iframeWindow) return;
      const data = event.data as any;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'ck:ready') {
        setIframeHasState(true);
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
